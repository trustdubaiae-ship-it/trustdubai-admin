// trustdubai-admin/supabase/functions/gsc-insights/index.ts
// Brings Google Search Console data (clicks / impressions / CTR / position +
// top queries + daily trend) into the admin Analytics page.
//
// Secrets (set in Supabase):
//   GSC_SA_JSON  = the full service-account JSON key (one line)
//   GSC_SITE_URL = the Search Console property, e.g. "sc-domain:quvera.ae"
//                  (or "https://www.quvera.ae/" for a URL-prefix property)
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

// ---- base64url helpers ----
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const pemToDer = (pem: string) => {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(body); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

// ---- mint a Google OAuth access token from the service account (RS256 JWT) ----
async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  };
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("token: " + (data.error_description || data.error || res.status));
  return data.access_token as string;
}

async function gscQuery(token: string, siteUrl: string, body: unknown) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = await res.json();
  if (!res.ok) throw new Error("gsc: " + (data?.error?.message || res.status));
  return data;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // --- admin gate ---
  const authHeader = req.headers.get("Authorization") || "";
  const URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: u } = await asUser.auth.getUser();
    const email = u?.user?.email?.toLowerCase();
    if (!email) return json({ error: "Not signed in." }, 401);
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: row } = await admin.from("admin_users").select("email").eq("is_active", true).ilike("email", email).maybeSingle();
    if (!row) return json({ error: "Admins only." }, 403);
  } catch (_e) { return json({ error: "Auth check failed." }, 401); }

  // --- config ---
  const saRaw = Deno.env.get("GSC_SA_JSON");
  const siteUrl = Deno.env.get("GSC_SITE_URL");
  if (!saRaw || !siteUrl) {
    const missing = [];
    if (!saRaw) missing.push("GSC_SA_JSON");
    if (!siteUrl) missing.push("GSC_SITE_URL");
    // Show which env-var names the function CAN see that look related (names only,
    // never values) so a typo'd secret name is obvious.
    const seen = Object.keys(Deno.env.toObject()).filter((k) => k.startsWith("GSC"));
    return json({ configured: false, missing, seenGscVars: seen, error: "Google Search Console isn't connected yet." });
  }

  let body: any = {}; try { body = await req.json(); } catch { /* ignore */ }
  const days = Math.min(180, Math.max(1, Number(body?.days) || 28));
  const end = new Date(); end.setDate(end.getDate() - 1);          // GSC data lags ~1 day
  const start = new Date(); start.setDate(start.getDate() - days);

  try {
    const sa = JSON.parse(saRaw);
    const token = await getAccessToken(sa);
    const range = { startDate: ymd(start), endDate: ymd(end) };

    const [totalsR, queriesR, pagesR, trendR] = await Promise.all([
      gscQuery(token, siteUrl, { ...range, dimensions: [] }),
      gscQuery(token, siteUrl, { ...range, dimensions: ["query"], rowLimit: 25, orderBy: [{ field: "impressions", descending: true }] }),
      gscQuery(token, siteUrl, { ...range, dimensions: ["page"], rowLimit: 15, orderBy: [{ field: "clicks", descending: true }] }),
      gscQuery(token, siteUrl, { ...range, dimensions: ["date"], rowLimit: 200 }),
    ]);

    const t = (totalsR.rows && totalsR.rows[0]) || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const mapRow = (r: any, key: string) => ({
      [key]: r.keys?.[0] || "", clicks: r.clicks || 0, impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 1000) / 10, position: Math.round((r.position || 0) * 10) / 10,
    });

    return json({
      configured: true,
      range: { ...range, days },
      totals: { clicks: t.clicks || 0, impressions: t.impressions || 0, ctr: Math.round((t.ctr || 0) * 1000) / 10, position: Math.round((t.position || 0) * 10) / 10 },
      topQueries: (queriesR.rows || []).map((r: any) => mapRow(r, "query")),
      topPages: (pagesR.rows || []).map((r: any) => mapRow(r, "page")),
      trend: (trendR.rows || []).map((r: any) => ({ date: r.keys?.[0] || "", clicks: r.clicks || 0, impressions: r.impressions || 0 })),
    });
  } catch (e) {
    const detail = String((e as any)?.message || e);
    console.error("gsc-insights", detail);
    // Admin-only function, so it's safe to surface the real Google error here to
    // make setup problems (bad key / no property access / wrong site URL) obvious.
    return json({ configured: true, error: "Couldn't load Search Console data. Check the service account + property access.", detail }, 502);
  }
});
