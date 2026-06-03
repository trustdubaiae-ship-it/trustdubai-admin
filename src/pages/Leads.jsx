import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const LEAD_STATUSES = [
  { value: 'new',             label: 'New',             color: '#03C1F5', bg: '#e0f9ff' },
  { value: 'qualified',       label: 'Qualified',       color: '#8b5cf6', bg: '#f5f3ff' },
  { value: 'in_conversation', label: 'In Conversation', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'proposal_given',  label: 'Proposal Given',  color: '#f59e0b', bg: '#fef9ed' },
  { value: 'won',             label: 'Won',             color: '#10b981', bg: '#ecfdf5' },
  { value: 'lost',            label: 'Lost',            color: '#ef4444', bg: '#fef2f2' },
]

// distribution status -> page status (what company set on a platform lead)
const DIST_TO_PAGE = { assigned:'new', viewed:'qualified', contacted:'in_conversation', quoted:'proposal_given', won:'won', lost:'lost', transferred:'lost' }

const SOURCES = [
  { key: 'platform', label: 'Platform',       color: '#0077aa', bg: '#e0f9ff', icon: 'ti-world' },
  { key: 'meta',     label: 'Meta',           color: '#1877f2', bg: '#eff6ff', icon: 'ti-brand-meta' },
  { key: 'whatsapp', label: 'WhatsApp',       color: '#0f7a52', bg: '#f0fdf4', icon: 'ti-brand-whatsapp' },
  { key: 'own',      label: 'Own / Referral', color: '#7c3aed', bg: '#f5f3ff', icon: 'ti-user-plus' },
]

function sourceBucket(raw) {
  const s = (raw || 'platform').toLowerCase()
  if (s.includes('meta') || s.includes('facebook') || s.includes('instagram')) return 'meta'
  if (s.includes('whatsapp') || s.includes('wati')) return 'whatsapp'
  if (s.includes('referral') || s.includes('own') || s.includes('manual')) return 'own'
  if (s.includes('platform') || s === '' || s === 'home') return 'platform'
  return 'own'
}

export default function Leads() {
  const [leads, setLeads]               = useState([])
  const [dists, setDists]               = useState({})
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [quickFilter, setQuickFilter]   = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [companies, setCompanies]       = useState([])
  const [period, setPeriod]             = useState('all')
  const [expandedId, setExpandedId]     = useState(null)
  const [, forceUpdate]                 = useState(0)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  useEffect(() => {
    fetchAll()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: leadsData } = await supabase
      .from('lead_submissions')
      .select('*, companies(name, category, owner_email)')
      .order('created_at', { ascending: false })
    setLeads(leadsData || [])

    // distribution: include status + follow-up so admin sees what each company did
    const { data: distData } = await supabase
      .from('lead_distributions')
      .select('lead_id, rank, status, follow_up_date, companies(name)')
      .order('rank', { ascending: true })
    const map = {}
    for (const d of distData || []) {
      if (!map[d.lead_id]) map[d.lead_id] = []
      map[d.lead_id].push({ name: d.companies?.name || '—', rank: d.rank, status: d.status || 'assigned', follow_up_date: d.follow_up_date })
    }
    setDists(map)

    const uniqueCompanies = [], seen = new Set()
    for (const l of leadsData || []) {
      if (l.company_id && !seen.has(l.company_id)) {
        seen.add(l.company_id)
        uniqueCompanies.push({ id: l.company_id, name: l.companies?.name || 'Unknown' })
      }
    }
    setCompanies(uniqueCompanies)
    setLoading(false)
  }

  async function changeStatus(leadId, newStatus) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    await supabase.from('lead_submissions').update({ status: newStatus }).eq('id', leadId)
  }

  function filterByPeriod(data) {
    const now = new Date()
    if (period === 'today') return data.filter(l => l.created_at?.startsWith(now.toISOString().split('T')[0]))
    if (period === 'week')  return data.filter(l => l.created_at >= new Date(now - 7*24*60*60*1000).toISOString())
    if (period === 'month') return data.filter(l => l.created_at >= new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
    return data
  }

  // for a platform lead, the "effective" status is the best (most advanced) distribution status
  const STAGE_ORDER = ['new','qualified','in_conversation','proposal_given','won','lost']
  function effectiveStatus(lead) {
    const isPlatform = sourceBucket(lead.source) === 'platform'
    const leadDists = dists[lead.id] || []
    if (isPlatform && leadDists.length > 0) {
      // pick most advanced stage among companies (won beats proposal beats ... )
      let best = 'new', bestIdx = -1
      for (const d of leadDists) {
        const pageSt = DIST_TO_PAGE[d.status] || 'new'
        const idx = STAGE_ORDER.indexOf(pageSt)
        if (idx > bestIdx && pageSt !== 'lost') { bestIdx = idx; best = pageSt }
      }
      // if all lost, show lost
      if (bestIdx === -1) return 'lost'
      return best
    }
    return lead.status || 'new'
  }

  const periodLeads = filterByPeriod(leads)

  function matchesQuick(l) {
    const st = effectiveStatus(l)
    if (quickFilter === 'distributed') return !!l.distributed
    if (quickFilter === 'new')         return st === 'new'
    if (quickFilter === 'active')      return !['won','lost'].includes(st)
    if (quickFilter === 'won')         return st === 'won'
    return true
  }

  const filtered = periodLeads
    .filter(matchesQuick)
    .filter(l => statusFilter === 'all' ? true : effectiveStatus(l) === statusFilter)
    .filter(l => companyFilter === 'all' ? true : l.company_id === companyFilter)
    .filter(l => sourceFilter === 'all' ? true : sourceBucket(l.source) === sourceFilter)
    .filter(l => {
      if (!search) return true
      const s = search.toLowerCase()
      return l.name?.toLowerCase().includes(s) || l.phone?.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s) || l.companies?.name?.toLowerCase().includes(s)
    })

  const statusConfig = (status) => LEAD_STATUSES.find(s => s.value === status) || LEAD_STATUSES[0]
  const sourceConfig = (key) => SOURCES.find(s => s.key === key) || SOURCES[0]

  const totalLeads   = periodLeads.length
  const wonLeads     = periodLeads.filter(l => effectiveStatus(l) === 'won').length
  const newLeads     = periodLeads.filter(l => effectiveStatus(l) === 'new').length
  const activeLeads  = periodLeads.filter(l => !['won','lost'].includes(effectiveStatus(l))).length
  const distributed  = periodLeads.filter(l => l.distributed).length
  const wonRate      = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  const srcCount = (key) => periodLeads.filter(l => sourceBucket(l.source) === key).length

  function toggleSource(key) { setSourceFilter(prev => prev === key ? 'all' : key) }
  function toggleQuick(key)  { setQuickFilter(prev => prev === key ? 'all' : key) }

  const text      = isDark ? '#f1f5f9' : '#0f172a'
  const textSub   = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  const STAT_CARDS = [
    { key: 'all',         label: 'Total',       value: totalLeads,    color: '#03C1F5', clickable: false },
    { key: 'distributed', label: 'Distributed', value: distributed,   color: '#7c3aed', clickable: true },
    { key: 'new',         label: 'New',         value: newLeads,      color: '#8b5cf6', clickable: true },
    { key: 'active',      label: 'Active',      value: activeLeads,   color: '#f59e0b', clickable: true },
    { key: 'won',         label: 'Won Rate',    value: wonRate + '%', color: '#10b981', clickable: true },
  ]

  return (
    <div style={{ maxWidth: 1180 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>All Leads</h1>
          <p style={{ fontSize: 13, color: textSub }}>Every lead — platform, company-added and Meta · {totalLeads} total</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderRadius: 10, padding: 4, border: '1px solid ' + borderCol }}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'week',  label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'all',   label: 'All' },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500,
              background: period === p.key ? '#03C1F5' : 'transparent',
              color: period === p.key ? '#fff' : textSub, transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Overview stats (row 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 10 }}>
        {STAT_CARDS.map(s => {
          const active = s.clickable && quickFilter === s.key
          return (
            <div key={s.key}
              onClick={() => s.clickable && toggleQuick(s.key)}
              style={{ background: active ? (isDark ? s.color + '22' : s.color + '14') : cardBg,
                border: '1.5px solid ' + (active ? s.color : borderCol), borderRadius: 11, padding: '12px 14px',
                cursor: s.clickable ? 'pointer' : 'default', transition: 'all 0.15s', position: 'relative' }}
              onMouseEnter={e => { if (s.clickable && !active) e.currentTarget.style.borderColor = s.color }}
              onMouseLeave={e => { if (s.clickable && !active) e.currentTarget.style.borderColor = borderCol }}
            >
              <div style={{ fontSize: 11, color: textSub }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
              {active && <i className="ti ti-circle-check-filled" style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, color: s.color }} />}
            </div>
          )
        })}
      </div>

      {/* Source stats (row 2) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {SOURCES.map(s => {
          const active = sourceFilter === s.key
          return (
            <div key={s.key} onClick={() => toggleSource(s.key)}
              style={{ flex: 1, minWidth: 150, background: active ? (isDark ? s.color + '22' : s.bg) : cardBg,
                border: '1.5px solid ' + (active ? s.color : borderCol), borderRadius: 11, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = s.color }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = borderCol }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, background: isDark ? 'rgba(255,255,255,0.05)' : s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={'ti ' + s.icon} style={{ fontSize: 17, color: s.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: text, lineHeight: 1.1 }}>{srcCount(s.key)}</div>
                <div style={{ fontSize: 11, color: textSub }}>{s.label}</div>
              </div>
              {active && <i className="ti ti-circle-check-filled" style={{ fontSize: 16, color: s.color }} />}
            </div>
          )
        })}
      </div>

      {/* active filter hint */}
      {(sourceFilter !== 'all' || quickFilter !== 'all') ? (
        <div style={{ marginBottom: 14, fontSize: 12, color: textSub, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Filtered:</span>
          {quickFilter !== 'all' && <strong style={{ color: STAT_CARDS.find(s=>s.key===quickFilter)?.color }}>{STAT_CARDS.find(s=>s.key===quickFilter)?.label}</strong>}
          {sourceFilter !== 'all' && <strong style={{ color: sourceConfig(sourceFilter).color }}>{sourceConfig(sourceFilter).label}</strong>}
          <button onClick={() => { setSourceFilter('all'); setQuickFilter('all') }} style={{ fontSize: 11, color: '#03C1F5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear all</button>
        </div>
      ) : <div style={{ marginBottom: 14 }} />}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, company..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, cursor: 'pointer', outline: 'none' }}>
          <option value="all">All Status</option>
          {LEAD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, cursor: 'pointer', maxWidth: 180, outline: 'none' }}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Leads list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: textMuted, fontSize: 13 }}>Loading leads...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14 }}>
          <i className="ti ti-inbox" style={{ fontSize: 48, color: textMuted, display: 'block', marginBottom: 12 }} />
          <div style={{ fontWeight: 600, color: text, marginBottom: 4 }}>No leads found</div>
          <div style={{ fontSize: 13, color: textMuted }}>Try adjusting your filters</div>
        </div>
      ) : (
        <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: bgRow }}>
                {['Customer', 'Source', 'Company / Distribution', 'Rank', 'Answers', 'Status', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: textSub, borderBottom: '1px solid ' + borderCol, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const isPlatform = sourceBucket(lead.source) === 'platform'
                const effSt = effectiveStatus(lead)
                const sc  = statusConfig(effSt)
                const src = sourceConfig(sourceBucket(lead.source))
                const isExpanded = expandedId === lead.id
                const leadDists = dists[lead.id] || []
                return (
                  <>
                    <tr key={lead.id} style={{ borderBottom: '1px solid ' + borderCol }}
                      onMouseEnter={e => e.currentTarget.style.background = bgRow}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {(lead.name || 'A')[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: text }}>{lead.name || 'Anonymous'}</div>
                            <div style={{ fontSize: 10.5, color: textMuted }}>
                              {lead.phone ? (
                                <a href={'https://wa.me/' + lead.phone.replace(/[^0-9]/g, '')} target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'none' }}>💬 {lead.phone}</a>
                              ) : (lead.email || '—')}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: isDark ? src.color + '22' : src.bg, color: src.color, whiteSpace: 'nowrap' }}>
                          <i className={'ti ' + src.icon} style={{ fontSize: 12 }} /> {src.label}
                        </span>
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        {isPlatform && leadDists.length > 0 ? (
                          <div style={{ fontSize: 12, color: text }}>
                            {leadDists[0].name}
                            {leadDists.length > 1 && <span style={{ color: textMuted }}> +{leadDists.length - 1} more</span>}
                          </div>
                        ) : lead.companies?.name ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: text }}>{lead.companies.name}</div>
                            <div style={{ fontSize: 10.5, color: textMuted }}>{lead.companies.category || ''}</div>
                          </div>
                        ) : isPlatform ? (
                          <span style={{ fontSize: 11, color: textMuted }}>Not distributed</span>
                        ) : <span style={{ fontSize: 12, color: textMuted }}>—</span>}
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        {isPlatform && leadDists.length > 0
                          ? <span style={{ fontSize: 11, color: textSub }}>#{leadDists[0].rank} of {leadDists.length}</span>
                          : <span style={{ fontSize: 11, color: textMuted }}>—</span>}
                      </td>

                      <td style={{ padding: '11px 14px', maxWidth: 160 }}>
                        {lead.answers && Object.keys(lead.answers).length > 0 ? (
                          <div style={{ fontSize: 10.5, color: textSub, lineHeight: 1.5 }}>
                            {Object.entries(lead.answers).slice(0, 2).map(([q, a]) => (
                              <div key={q} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ color: textMuted }}>{q.slice(0, 14)}:</span>{' '}
                                <strong style={{ color: text }}>{String(a).slice(0, 18)}</strong>
                              </div>
                            ))}
                            {Object.keys(lead.answers).length > 2 && (
                              <div style={{ color: textMuted }}>+{Object.keys(lead.answers).length - 2} more</div>
                            )}
                          </div>
                        ) : <span style={{ fontSize: 11, color: textMuted }}>—</span>}
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        {isPlatform ? (
                          // platform lead: read-only — shows what the company set
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: '1.5px solid ' + sc.color, background: isDark ? sc.color + '22' : sc.bg, color: sc.color, fontSize: 11, fontWeight: 600 }}>
                            {sc.label}
                            {leadDists.length > 1 && <span style={{ fontSize: 9, opacity: 0.7 }}>(best)</span>}
                          </span>
                        ) : (
                          <select value={lead.status || 'new'} onChange={e => changeStatus(lead.id, e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: 20, border: '1.5px solid ' + sc.color, background: isDark ? sc.color + '22' : sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none', appearance: 'none' }}>
                            {LEAD_STATUSES.map(s => <option key={s.value} value={s.value} style={{ background: cardBg, color: text }}>{s.label}</option>)}
                          </select>
                        )}
                      </td>

                      <td style={{ padding: '11px 14px', fontSize: 11.5, color: textMuted, whiteSpace: 'nowrap' }}>
                        {new Date(lead.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        <button onClick={() => setExpandedId(isExpanded ? null : lead.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 12 }}>
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={lead.id + '_expanded'} style={{ background: isDark ? 'rgba(3,193,245,0.04)' : '#f0fdff' }}>
                        <td colSpan={8} style={{ padding: '14px 16px', borderBottom: '1px solid ' + borderCol }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textSub, marginBottom: 10 }}>📋 Full Lead Details</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: leadDists.length > 0 ? 12 : 0 }}>
                            {lead.answers && Object.entries(lead.answers).map(([q, a]) => (
                              <div key={q} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 8, padding: '8px 12px' }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 2 }}>{q}</div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: text }}>{String(a)}</div>
                              </div>
                            ))}
                          </div>
                          {leadDists.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: textSub, marginBottom: 6 }}>Distributed to (with each company's progress):</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {leadDists.map((d, i) => {
                                  const dPage = DIST_TO_PAGE[d.status] || 'new'
                                  const dsc = statusConfig(dPage)
                                  return (
                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 8, background: cardBg, border: '1px solid ' + borderCol, color: text }}>
                                      <strong>#{d.rank} {d.name}</strong>
                                      <span style={{ padding: '1px 7px', borderRadius: 99, background: isDark ? dsc.color + '22' : dsc.bg, color: dsc.color, fontSize: 10, fontWeight: 600 }}>{dsc.label}</span>
                                      {d.follow_up_date && <span style={{ fontSize: 9.5, color: textMuted }}>F/U {new Date(d.follow_up_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</span>}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', background: bgRow, borderTop: '1px solid ' + borderCol, fontSize: 12, color: textSub }}>
            {filtered.length} leads found
          </div>
        </div>
      )}
    </div>
  )
}
