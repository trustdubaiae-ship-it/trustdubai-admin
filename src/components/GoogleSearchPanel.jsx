// trustdubai-admin/src/components/GoogleSearchPanel.jsx
// Shows Google Search Console data (clicks / impressions / CTR / position +
// top queries) inside the admin Analytics page. Fetches via the gsc-insights
// edge function. Renders a friendly "not connected" state until configured.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

export default function GoogleSearchPanel({ C, F, mobile }) {
  const [days, setDays] = useState(28)
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')   // loading | ok | unconfigured | error
  const [err, setErr] = useState('')

  const load = useCallback(async (d) => {
    setState('loading')
    try {
      const { data: res, error } = await supabase.functions.invoke('gsc-insights', { body: { days: d } })
      if (error) {
        // The function returns a JSON body (with a `detail`) even on 4xx/5xx, but
        // supabase-js hides it behind error.context — read it for the real reason.
        let detail = ''
        try { const body = await error.context?.json?.(); detail = body?.detail || body?.error || '' } catch { /* ignore */ }
        setErr(detail ? `Couldn’t reach Search Console — ${detail}` : 'Couldn’t reach Search Console.')
        setState('error'); return
      }
      if (res?.configured === false) { setData(res); setState('unconfigured'); return }
      if (res?.error) { setErr(res.detail ? `${res.error} — ${res.detail}` : res.error); setState('error'); return }
      setData(res); setState('ok')
    } catch (e) { setErr('Something went wrong.'); setState('error') }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  const card = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, boxShadow: C.glow }
  const fmt = (n) => n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n ?? 0)

  const Stat = ({ label, value, sub, color }) => (
    <div style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.t3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.t1, letterSpacing: '-0.5px', marginTop: 3 }}>{value}{sub && <span style={{ fontSize: 12, color: C.t2, fontWeight: 700 }}> {sub}</span>}</div>
    </div>
  )

  return (
    <div style={{ ...card, fontFamily: F, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#4285F4,#34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ti ti-brand-google" style={{ fontSize: 17, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, letterSpacing: '-0.3px' }}>Google Search</div>
            <div style={{ fontSize: 11, color: C.t3 }}>Clicks &amp; impressions from Google Search Console</div>
          </div>
        </div>
        {state === 'ok' && (
          <div style={{ display: 'flex', background: C.soft, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3 }}>
            {[7, 28, 90].map(r => (
              <button key={r} onClick={() => setDays(r)} style={{ border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 7, background: days === r ? `linear-gradient(135deg,${C.indigo},${C.purple})` : 'transparent', color: days === r ? '#fff' : C.t2 }}>{r}d</button>
            ))}
          </div>
        )}
      </div>

      {state === 'loading' && <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 13 }}>Loading Search Console…</div>}

      {state === 'unconfigured' && (
        <div style={{ background: C.soft, border: `1px dashed ${C.line}`, borderRadius: 12, padding: '16px 16px', fontSize: 12.5, color: C.t2, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 800, color: C.t1, marginBottom: 4 }}>Not connected yet</div>
          Add a Google service account with access to the Search Console property, then set the
          <code style={{ color: C.t1 }}> GSC_SA_JSON </code> and <code style={{ color: C.t1 }}> GSC_SITE_URL </code>
          secrets and deploy the <code style={{ color: C.t1 }}>gsc-insights</code> function.
          {data?.missing?.length > 0 && (
            <div style={{ marginTop: 8, color: C.amber }}>Missing secret(s): <b>{data.missing.join(', ')}</b></div>
          )}
          {data?.seenGscVars && (
            <div style={{ marginTop: 4, color: C.t3 }}>Secrets the function can see: {data.seenGscVars.length ? data.seenGscVars.join(', ') : '(none starting with GSC)'}</div>
          )}
        </div>
      )}

      {state === 'error' && <div style={{ padding: 16, color: C.amber, fontSize: 12.5, lineHeight: 1.6 }}>{err}</div>}

      {state === 'ok' && data && (
        <>
          {/* Left: the 4 headline stats (2×2). Right: Top queries as its own card. */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
              <Stat label="Clicks" value={fmt(data.totals.clicks)} color={C.indigo} />
              <Stat label="Impressions" value={fmt(data.totals.impressions)} color={C.cyan} />
              <Stat label="Avg CTR" value={data.totals.ctr} sub="%" color={C.green} />
              <Stat label="Avg Position" value={data.totals.position} color={C.amber} />
            </div>

            <div style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.t3, marginBottom: 8 }}>Top queries</div>
              <div className="an-scroll" style={{ maxHeight: 178, overflowY: 'auto', minHeight: 0 }}>
                {data.topQueries.length === 0 ? (
                  <div style={{ padding: '14px 4px', color: C.t3, fontSize: 12, textAlign: 'center' }}>No search data in this range yet.</div>
                ) : data.topQueries.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.t3, width: 16, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</div>
                      <div style={{ fontSize: 9.5, color: C.t3, marginTop: 1 }}>{fmt(q.impressions)} impr · {q.ctr}% CTR · pos {q.position}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.t1, flexShrink: 0 }}>{q.clicks}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: C.t3, marginTop: 12 }}>Range: {data.range.startDate} → {data.range.endDate} · Google data lags ~1–2 days.</div>
        </>
      )}
    </div>
  )
}
