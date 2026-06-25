// Quvera Platform Manager AI — a chief-of-staff for the superadmin.
// Verifies the caller is an active admin, pulls a live platform snapshot (companies,
// revenue, leads, reviews, partners, pending actions) and lets Claude analyze, advise,
// flag what needs attention, and write marketing/social content.
// Secret: ANTHROPIC_API_KEY. SUPABASE_* auto-injected. Deploy: supabase functions deploy admin-ai
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const PLAN_PRICE = 399; // AED/mo for a paid plan (single price for now)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI not configured (ANTHROPIC_API_KEY)" }, 500);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") || "";
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // gate: caller must be an active admin
  const { data: ures } = await caller.auth.getUser();
  const email = ures?.user?.email;
  if (!email) return json({ error: "Not signed in" }, 401);
  const { data: adm } = await admin.from("admin_users").select("role, is_active").eq("email", email).eq("is_active", true).maybeSingle();
  if (!adm) return json({ error: "Admins only" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const claudeMsgs = messages.slice(-16).filter((m: any) => m && m.text).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.text) }));
  if (!claudeMsgs.length) return json({ error: "No message" }, 400);

  // ---- live platform snapshot ----
  const isoDaysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const cnt = (q: any) => q.then((r: any) => r.count || 0).catch(() => 0);
  let snap: any = {};
  try {
    const [
      companies, verified, paying, appsPending, leadsTotal, leads7, leads30,
      reviewsApproved, reviewsPending, customers, partnersTotal, partnersActive,
    ] = await Promise.all([
      cnt(admin.from("companies").select("*", { count: "exact", head: true }).eq("status", "approved")),
      cnt(admin.from("companies").select("*", { count: "exact", head: true }).eq("status", "approved").eq("is_verified", true)),
      cnt(admin.from("companies").select("*", { count: "exact", head: true }).eq("subscription_status", "active")),
      cnt(admin.from("company_applications").select("*", { count: "exact", head: true }).eq("status", "pending")),
      cnt(admin.from("lead_submissions").select("*", { count: "exact", head: true })),
      cnt(admin.from("lead_submissions").select("*", { count: "exact", head: true }).gte("created_at", isoDaysAgo(7))),
      cnt(admin.from("lead_submissions").select("*", { count: "exact", head: true }).gte("created_at", isoDaysAgo(30))),
      cnt(admin.from("reviews").select("*", { count: "exact", head: true }).eq("is_approved", true)),
      cnt(admin.from("reviews").select("*", { count: "exact", head: true }).eq("is_approved", false)),
      cnt(admin.from("customers").select("*", { count: "exact", head: true })),
      cnt(admin.from("qv_partners").select("*", { count: "exact", head: true })),
      cnt(admin.from("qv_partners").select("*", { count: "exact", head: true }).eq("status", "active")),
    ]);

    const [{ data: planRows }, { data: payoutReq }, { data: recentCo }, { data: recentApps }, { data: ratingRows }] = await Promise.all([
      admin.from("companies").select("plan").eq("status", "approved"),
      admin.from("qv_partner_payouts").select("amount").eq("status", "requested"),
      admin.from("companies").select("name, created_at, plan").eq("status", "approved").order("created_at", { ascending: false }).limit(5),
      admin.from("company_applications").select("company_name, category, applied_at").eq("status", "pending").order("applied_at", { ascending: false }).limit(8),
      admin.from("reviews").select("rating").eq("is_approved", true).limit(5000),
    ]);
    const planDist: Record<string, number> = {};
    (planRows || []).forEach((r: any) => { const p = (r.plan || "free").toLowerCase(); planDist[p] = (planDist[p] || 0) + 1; });
    const payoutPending = (payoutReq || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const avgRating = (ratingRows && ratingRows.length) ? (ratingRows.reduce((s: number, r: any) => s + (Number(r.rating) || 0), 0) / ratingRows.length).toFixed(2) : "0";

    snap = {
      currency: "AED",
      companies: { approved: companies, verified, claimed_or_paying: paying, plan_distribution: planDist },
      revenue: { paying_companies: paying, plan_price_monthly: PLAN_PRICE, estimated_MRR: paying * PLAN_PRICE, estimated_ARR: paying * PLAN_PRICE * 12 },
      leads: { total: leadsTotal, last_7_days: leads7, last_30_days: leads30 },
      reviews: { approved: reviewsApproved, pending_moderation: reviewsPending, avg_rating: avgRating },
      customers: { total: customers },
      partners: { total: partnersTotal, active: partnersActive, pending_payout_requests: (payoutReq || []).length, pending_payout_amount: payoutPending },
      pending_actions: { applications_to_review: appsPending, reviews_to_moderate: reviewsPending, partner_payouts_to_pay: (payoutReq || []).length },
      recent_companies: recentCo || [],
      pending_applications: recentApps || [],
    };
  } catch (e) {
    snap = { error: "snapshot partial: " + String((e as any)?.message || e) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = `You are the Quvera Platform Manager — an AI chief-of-staff for the SUPERADMIN of Quvera, a Dubai (UAE) verified-contractor marketplace + SaaS (companies pay AED ${PLAN_PRICE}/month).
You help run the whole business: analyze platform health, accounts/revenue (MRR/ARR), leads & growth, partner program, and flag what needs attention. You also write marketing & social-media content (Instagram/LinkedIn/TikTok/WhatsApp) for Quvera's own channels when asked.
Be concise, data-driven and action-oriented. Use AED. When useful, end with a short "Action items" list. You can recommend actions but you do not execute them — the superadmin approves and acts.

Today is ${today}. Live platform snapshot (JSON):
${JSON.stringify(snap)}

Use this real data in your answers. If the user asks for a daily briefing, give: headline health summary, key numbers, what changed/notable, what needs attention (pending approvals/moderation/payouts), and 3-5 prioritized action items.`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, system, messages: claudeMsgs }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      let detail = ""; try { detail = JSON.parse(t)?.error?.message || ""; } catch { detail = t.slice(0, 200); }
      return json({ error: "AI request failed", detail }, 502);
    }
    const data = await aiRes.json();
    const reply = (data?.content?.[0]?.text || "").trim();
    return json({ ok: true, reply, snapshot: snap });
  } catch (e) {
    return json({ error: String((e && (e as any).message) || e) }, 500);
  }
});
