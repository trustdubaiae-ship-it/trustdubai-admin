// trustdubai-admin/supabase/functions/seo-insights/index.ts
// SEO Insights: runs Google PageSpeed Insights on key pages + a Claude "deep
// research" pass over the GSC keyword data (passed in from the admin UI, which
// already fetched it via the gsc-insights function) → a prioritized report with
// ready-to-use fixes. Admin-gated. No site changes are made — report only.
//
// Secrets (set in Supabase):
//   ANTHROPIC_API_KEY   = Claude API key (already used by admin-ai)
//   PAGESPEED_API_KEY   = (optional) Google PageSpeed Insights API key. Without
//                         it PageSpeed still works but is rate-limited.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are auto-injected.
// Deploy with JWT verification ON — only active admins may call it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// ---- PageSpeed Insights for one URL (mobile) → score + failing audits ----
async function pagespeed(url: string, key?: string) {
  const call = async (useKey: boolean) => {
    const params = new URLSearchParams({ url, strategy: "mobile" });
    params.append("category", "PERFORMANCE");
    params.append("category", "SEO");
    if (useKey && key) params.append("key", key);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d?.error?.message || `PageSpeed ${res.status}`);
    return d;
  };
  let data: any;
  try { data = await call(true); }
  catch (e) {
    // An invalid / restricted PAGESPEED_API_KEY → fall back to a keyless call
    // (Google allows PageSpeed without a key at low volume) so results still load.
    if (key && /API key|key not valid|PERMISSION|forbidden|invalid/i.test(String((e as any)?.message || ""))) data = await call(false);
    else throw e;
  }
  const lh = data.lighthouseResult || {};
  const cats = lh.categories || {};
  const audits = lh.audits || {};
  const score = (c: any) => (c && typeof c.score === "number") ? Math.round(c.score * 100) : null;
  // failing / weak audits worth surfacing (score < 0.9, and it has a title)
  const issues = Object.values(audits)
    .filter((a: any) => a && typeof a.score === "number" && a.score < 0.9 && a.title && (a.scoreDisplayMode === "numeric" || a.scoreDisplayMode === "binary"))
    .map((a: any) => ({ title: a.title, display: a.displayValue || "", score: Math.round(a.score * 100) }))
    .slice(0, 8);
  return {
    url,
    performance: score(cats.performance),
    seo: score(cats.seo),
    metrics: {
      lcp: audits["largest-contentful-paint"]?.displayValue || "",
      cls: audits["cumulative-layout-shift"]?.displayValue || "",
      tbt: audits["total-blocking-time"]?.displayValue || "",
    },
    issues,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // --- admin gate (same as gsc-insights) ---
  const URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  try {
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: u } = await asUser.auth.getUser();
    const email = u?.user?.email?.toLowerCase();
    if (!email) return json({ error: "Not signed in." }, 401);
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: row } = await admin.from("admin_users").select("email").eq("is_active", true).ilike("email", email).maybeSingle();
    if (!row) return json({ error: "Admins only." }, 403);
  } catch (_e) { return json({ error: "Auth check failed." }, 401); }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured (ANTHROPIC_API_KEY missing)." }, 500);
  const psKey = Deno.env.get("PAGESPEED_API_KEY") || "";

  let body: any = {}; try { body = await req.json(); } catch { /* ignore */ }
  const gsc = body?.gsc || {};
  // Pages to PageSpeed-check: caller-supplied, capped at 3 to stay within time.
  const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter(Boolean).slice(0, 3) : [];

  // --- PageSpeed (parallel, each best-effort) ---
  const pageResults = await Promise.all(urls.map(async (u) => {
    try { return await pagespeed(u, psKey); }
    catch (e) { return { url: u, error: String((e as any)?.message || e) }; }
  }));

  // --- AI deep research over GSC + PageSpeed ---
  const topQueries = Array.isArray(gsc?.topQueries) ? gsc.topQueries.slice(0, 25) : [];
  const topPages = Array.isArray(gsc?.topPages) ? gsc.topPages.slice(0, 15) : [];
  const dataForAI = {
    site: "quvera.ae — a Dubai (UAE) verified home & interior service-company marketplace",
    range_days: gsc?.range?.days || null,
    gsc_totals: gsc?.totals || null,
    top_queries: topQueries,
    top_pages: topPages,
    pagespeed: pageResults,
  };

  const system = `You are a senior SEO consultant auditing quvera.ae (a Dubai/UAE verified-contractor marketplace). You are given real Google Search Console data (queries with average position, impressions, clicks, CTR; top pages) and PageSpeed Insights results for key pages.

Produce a PRIORITISED, ACTIONABLE SEO report. Focus on:
- Striking-distance keywords (avg position 4-20) that could reach page 1 with small changes.
- High-impression / low-CTR queries → title & meta-description rewrites (give the EXACT text to use).
- Pages/queries with ranking potential → content or on-page suggestions.
- Technical / speed issues from PageSpeed (only if clearly worth fixing).

Every "fix" must be copy-paste ready — for meta give the exact <title> and meta description text; for keywords the exact phrases to target and where; for content concrete copy to add. Give 5-8 issues (most impactful first) and up to 8 opportunities from the striking-distance queries. Be specific to the real data — no generic advice. Return the report by calling the seo_report tool.`;

  const tool = {
    name: "seo_report",
    description: "Return the prioritised SEO report for quvera.ae.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-4 sentence overview of where SEO stands and the biggest wins." },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["high", "medium", "low"] },
              area: { type: "string", enum: ["keywords", "meta", "content", "technical", "speed"] },
              title: { type: "string" },
              problem: { type: "string" },
              impact: { type: "string" },
              fix: { type: "string", description: "copy-paste-ready fix (exact meta text / keywords / content)" },
            },
            required: ["severity", "title", "fix"],
          },
        },
        opportunities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              position: { type: "number" },
              impressions: { type: "number" },
              action: { type: "string" },
            },
            required: ["keyword", "action"],
          },
        },
      },
      required: ["summary", "issues"],
    },
  };

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system,
        tools: [tool],
        tool_choice: { type: "tool", name: "seo_report" },
        messages: [{ role: "user", content: "Analyse this data and produce the report:\n" + JSON.stringify(dataForAI) }],
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      let detail = ""; try { detail = JSON.parse(t)?.error?.message || ""; } catch { detail = t.slice(0, 200); }
      return json({ pagespeed: pageResults, error: "AI request failed", detail }, 502);
    }
    const data = await aiRes.json();
    // tool_choice forces a tool_use block whose `input` the API validates against
    // the schema — guaranteed-valid JSON, no text parsing needed.
    const toolUse = (Array.isArray(data?.content) ? data.content : []).find((b: any) => b?.type === "tool_use");
    const report = toolUse?.input || null;
    if (!report) return json({ pagespeed: pageResults, error: "AI returned no report.", detail: "stop=" + (data?.stop_reason || "?") + " blocks=" + ((data?.content || []).map((b: any) => b?.type).join(",") || "none") }, 502);
    return json({ ok: true, pagespeed: pageResults, report, usedPagespeedKey: !!psKey });
  } catch (e) {
    return json({ pagespeed: pageResults, error: String((e && (e as any).message) || e) }, 500);
  }
});
