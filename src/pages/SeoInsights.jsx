// trustdubai-admin/src/pages/SeoInsights.jsx
// SEO Insights cockpit — checks quvera.ae's Google ranking keywords (GSC),
// runs PageSpeed Insights on the top pages, and gets a Claude "deep research"
// report with prioritised issues + ready-to-use fixes. Report only — no site
// changes are applied. Super-admin only.
import { useState } from 'react'
import { supabase } from '../supabase'

const SITE = 'https://www.quvera.ae/'

export default function SeoInsights({ theme = 'dark' }) {
  const isDark = theme !== 'light'
  const C = {
    bg: isDark ? '#0b0f17' : '#f5f7fa',
    card: isDark ? '#131a26' : '#ffffff',
    card2: isDark ? '#0f1622' : '#f8fafc',
    text: isDark ? '#e6edf5' : '#0f2741',
    sub: isDark ? '#8b99ac' : '#64748b',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    accent: isDark ? '#3ba7ff' : '#0099cc',
  }
  const SEV = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }

  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [err, setErr] = useState('')
  const [notConfigured, setNotConfigured] = useState(null)
  const [gsc, setGsc] = useState(null)
  const [ps, setPs] = useState(null)
  const [report, setReport] = useState(null)
  const [ranAt, setRanAt] = useState(null)
  const [copied, setCopied] = useState(-1)

  async function run() {
    setBusy(true); setErr(''); setNotConfigured(null); setReport(null); setPs(null)
    try {
      setStage('Fetching Google Search Console keywords…')
      const { data: g, error: gErr } = await supabase.functions.invoke('gsc-insights', { body: { days: 90 } })
      if (gErr) throw new Error(gErr.message || 'Could not reach Search Console')
      if (g && g.configured === false) { setNotConfigured(g); setGsc(null); setBusy(false); setStage(''); return }
      if (g && g.error && !g.topQueries) throw new Error(g.detail || g.error)
      setGsc(g)

      const urls = (Array.isArray(g?.topPages) && g.topPages.length)
        ? g.topPages.slice(0, 3).map(p => p.page).filter(Boolean)
        : [SITE]

      setStage('Running PageSpeed + deep research (this can take ~30s)…')
      const { data: s, error: sErr } = await supabase.functions.invoke('seo-insights', { body: { gsc: g, urls } })
      if (sErr) {
        // supabase-js puts the function's JSON body on error.context (a Response);
        // read it so the REAL reason (bad model, timeout, etc.) is shown, not the
        // generic "non-2xx status code".
        let detail = sErr.message || 'Analysis failed'
        try { const b = await sErr.context.json(); if (b?.pagespeed) setPs(b.pagespeed); detail = b?.detail || b?.error || detail } catch { /* body not JSON */ }
        throw new Error(detail)
      }
      if (s?.pagespeed) setPs(s.pagespeed)
      if (s?.error && !s.report) throw new Error(s.detail || s.error)
      setReport(s?.report || null)
      setRanAt(new Date())
    } catch (e) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false); setStage('')
    }
  }

  const copy = (text, i) => { try { navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(-1), 1500) } catch { /* ignore */ } }

  const panel = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }
  const h2 = { fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }
  const th = { textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', color: C.sub, fontWeight: 700, padding: '8px 10px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }
  const td = { fontSize: 12.5, color: C.text, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }

  const scoreColor = v => v == null ? C.sub : v >= 90 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 'clamp(14px, 3vw, 26px)', color: C.text }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <i className="ti ti-seo" style={{ color: C.accent }} /> SEO Insights
          </div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>Rank & keyword check, Google PageSpeed, and an AI deep-research report for <b style={{ color: C.text }}>quvera.ae</b>.</div>
        </div>
        <button onClick={run} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, border: 'none', background: busy ? C.sub : C.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
          <i className={'ti ' + (busy ? 'ti-loader-2' : 'ti-radar-2')} style={{ animation: busy ? 'spin 1s linear infinite' : 'none' }} /> {busy ? 'Analysing…' : (report ? 'Re-run analysis' : 'Run SEO Analysis')}
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {busy && stage && <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: 10, color: C.sub, fontSize: 13 }}><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite', color: C.accent }} /> {stage}</div>}
      {err && <div style={{ ...panel, borderColor: '#ef4444', color: '#ef4444', fontSize: 13 }}><i className="ti ti-alert-triangle" /> {err}</div>}

      {notConfigured && (
        <div style={panel}>
          <div style={h2}><i className="ti ti-plug-connected-x" style={{ color: '#f59e0b' }} /> Google Search Console not connected</div>
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
            Ranking keywords need Search Console. Missing secrets: <b style={{ color: C.text }}>{(notConfigured.missing || []).join(', ') || '—'}</b>.
            Set them in Supabase → Edge Functions secrets, then run again.
          </div>
        </div>
      )}

      {!report && !busy && !notConfigured && !err && (
        <div style={{ ...panel, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Run a full SEO analysis</div>
          <div style={{ fontSize: 13, color: C.sub, maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
            Pulls your real Google ranking keywords, checks page speed & on-page SEO, and gives a prioritised report with ready-to-use fixes. Nothing on the site is changed — you review and apply.
          </div>
        </div>
      )}

      {/* AI Deep Research */}
      {report && (
        <div style={panel}>
          <div style={h2}><i className="ti ti-brain" style={{ color: C.accent }} /> Deep Research {ranAt && <span style={{ fontSize: 11, fontWeight: 500, color: C.sub }}>· {ranAt.toLocaleString()}</span>}</div>
          {report.summary && <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>{report.summary}</div>}

          {Array.isArray(report.issues) && report.issues.map((it, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${SEV[it.severity] || C.sub}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: '#fff', background: SEV[it.severity] || C.sub, padding: '2px 8px', borderRadius: 99 }}>{it.severity || 'info'}</span>
                {it.area && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '.5px' }}>{it.area}</span>}
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{it.title}</span>
              </div>
              {it.problem && <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, marginBottom: 4 }}>{it.problem}</div>}
              {it.impact && <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 8 }}><b style={{ color: C.text }}>Impact:</b> {it.impact}</div>}
              {it.fix && (
                <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: '#22c55e' }}>✓ Ready fix</span>
                    <button onClick={() => copy(it.fix, i)} style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}><i className="ti ti-copy" /> {copied === i ? 'Copied!' : 'Copy'}</button>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{it.fix}</div>
                </div>
              )}
            </div>
          ))}

          {Array.isArray(report.opportunities) && report.opportunities.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Quick-win keywords (striking distance)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.opportunities.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{o.keyword}</span>
                    {o.position != null && <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>pos {Number(o.position).toFixed(1)}</span>}
                    {o.impressions != null && <span style={{ fontSize: 11, color: C.sub }}>{Number(o.impressions).toLocaleString()} impr</span>}
                    {o.action && <span style={{ fontSize: 12, color: C.sub, flex: 1, minWidth: 160 }}>→ {o.action}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PageSpeed */}
      {ps && ps.length > 0 && (
        <div style={panel}>
          <div style={h2}><i className="ti ti-gauge" style={{ color: C.accent }} /> Google PageSpeed (mobile)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {ps.map((p, i) => (
              <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: C.sub, wordBreak: 'break-all', marginBottom: 8 }}>{(p.url || '').replace(/^https?:\/\//, '')}</div>
                {p.error ? (
                  <div style={{ fontSize: 12, color: '#ef4444' }}><i className="ti ti-alert-triangle" /> {p.error}</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      <div><div style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px' }}>SEO</div><div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(p.seo) }}>{p.seo ?? '—'}</div></div>
                      <div><div style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px' }}>Speed</div><div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(p.performance) }}>{p.performance ?? '—'}</div></div>
                    </div>
                    {p.metrics && (p.metrics.lcp || p.metrics.cls) && <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>LCP {p.metrics.lcp || '—'} · CLS {p.metrics.cls || '—'} · TBT {p.metrics.tbt || '—'}</div>}
                    {Array.isArray(p.issues) && p.issues.slice(0, 5).map((a, j) => (
                      <div key={j} style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>• {a.title}{a.display ? ` (${a.display})` : ''}</div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking keywords */}
      {gsc && Array.isArray(gsc.topQueries) && (
        <div style={panel}>
          <div style={h2}><i className="ti ti-search" style={{ color: C.accent }} /> Ranking Keywords <span style={{ fontSize: 11, fontWeight: 500, color: C.sub }}>· last {gsc.range?.days || 90} days · pos 4–20 = quick wins</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead><tr>
                <th style={th}>Keyword</th><th style={{ ...th, textAlign: 'right' }}>Position</th><th style={{ ...th, textAlign: 'right' }}>Impressions</th><th style={{ ...th, textAlign: 'right' }}>Clicks</th><th style={{ ...th, textAlign: 'right' }}>CTR</th>
              </tr></thead>
              <tbody>
                {gsc.topQueries.map((q, i) => {
                  const strike = q.position >= 4 && q.position <= 20
                  return (
                    <tr key={i}>
                      <td style={td}>{strike && <span title="Striking distance — quick win" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: '#f59e0b', marginRight: 7 }} />}{q.query}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: q.position <= 3 ? '#22c55e' : strike ? '#f59e0b' : C.text }}>{q.position}</td>
                      <td style={{ ...td, textAlign: 'right', color: C.sub }}>{Number(q.impressions).toLocaleString()}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{Number(q.clicks).toLocaleString()}</td>
                      <td style={{ ...td, textAlign: 'right', color: C.sub }}>{q.ctr}%</td>
                    </tr>
                  )
                })}
                {gsc.topQueries.length === 0 && <tr><td style={{ ...td, color: C.sub }} colSpan={5}>No keyword data yet for this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
