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

export default function Leads() {
  const [leads, setLeads]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
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

  function filterByPeriod(data) {
    const now = new Date()
    if (period === 'today') return data.filter(l => l.created_at?.startsWith(now.toISOString().split('T')[0]))
    if (period === 'week')  return data.filter(l => l.created_at >= new Date(now - 7*24*60*60*1000).toISOString())
    if (period === 'month') return data.filter(l => l.created_at >= new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
    return data
  }

  const filtered = filterByPeriod(leads)
    .filter(l => statusFilter === 'all' ? true : (l.status || 'new') === statusFilter)
    .filter(l => companyFilter === 'all' ? true : l.company_id === companyFilter)
    .filter(l => {
      if (!search) return true
      const s = search.toLowerCase()
      return l.name?.toLowerCase().includes(s) || l.phone?.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s) || l.companies?.name?.toLowerCase().includes(s)
    })

  const statusConfig = (status) => LEAD_STATUSES.find(s => s.value === status) || LEAD_STATUSES[0]

  const totalLeads  = filtered.length
  const wonLeads    = filtered.filter(l => l.status === 'won').length
  const newLeads    = filtered.filter(l => !l.status || l.status === 'new').length
  const activeLeads = filtered.filter(l => !['won','lost'].includes(l.status || 'new')).length
  const wonRate     = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  const companyBreakdown = companies.map(c => {
    const cLeads = filtered.filter(l => l.company_id === c.id)
    const cWon   = cLeads.filter(l => l.status === 'won').length
    return { ...c, total: cLeads.length, won: cWon, rate: cLeads.length > 0 ? Math.round((cWon/cLeads.length)*100) : 0 }
  }).filter(c => c.total > 0).sort((a,b) => b.total - a.total)

  const text      = isDark ? '#f1f5f9' : '#0f172a'
  const textSub   = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>All Leads</h1>
          <p style={{ fontSize: 13, color: textSub }}>All leads from all companies · {totalLeads} total</p>
        </div>
        {/* Period Filter */}
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
              color: period === p.key ? '#fff' : textSub,
              transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Leads', value: totalLeads,       color: '#03C1F5', icon: 'ti-address-book' },
          { label: 'New',         value: newLeads,         color: '#8b5cf6', icon: 'ti-sparkles' },
          { label: 'Active',      value: activeLeads,      color: '#f59e0b', icon: 'ti-activity' },
          { label: 'Won',         value: wonLeads,         color: '#10b981', icon: 'ti-trophy' },
          { label: 'Win Rate',    value: wonRate + '%',    color: '#10b981', icon: 'ti-chart-bar' },
        ].map(s => (
          <div key={s.label} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + borderCol, flexShrink: 0 }}>
              <i className={'ti ' + s.icon} style={{ fontSize: 16, color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: textSub, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Company Breakdown */}
      {companyBreakdown.length > 0 && (
        <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 14 }}>📊 Company-wise Conversion</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {companyBreakdown.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: text, width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ flex: 1, height: 6, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: c.rate + '%', height: '100%', background: c.rate >= 50 ? '#10b981' : c.rate >= 25 ? '#f59e0b' : '#03C1F5', borderRadius: 99, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: textSub, width: 90, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.won}/{c.total} · <strong style={{ color: '#10b981' }}>{c.rate}%</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, company..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, cursor: 'pointer', outline: 'none' }}>
          <option value="all">All Status</option>
          {LEAD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, cursor: 'pointer', maxWidth: 200, outline: 'none' }}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Leads List */}
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
                {['Customer', 'Contact', 'Company', 'Answers', 'Status', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: textSub, borderBottom: '1px solid ' + borderCol }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const sc = statusConfig(lead.status || 'new')
                const isExpanded = expandedId === lead.id
                return (
                  <>
                    <tr key={lead.id} style={{ borderBottom: '1px solid ' + borderCol, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = bgRow}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Customer */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {(lead.name || 'A')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{lead.name || 'Anonymous'}</div>
                            <div style={{ fontSize: 11, color: textMuted }}>{lead.email || '—'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '12px 16px' }}>
                        {lead.phone ? (
                          <a href={'https://wa.me/' + lead.phone.replace(/[^0-9]/g, '')} target="_blank" rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4', color: '#10b981', fontSize: 12, fontWeight: 500, padding: '4px 8px', borderRadius: 6, textDecoration: 'none', border: '1px solid ' + (isDark ? 'rgba(16,185,129,0.2)' : '#a7f3d0') }}>
                            💬 {lead.phone}
                          </a>
                        ) : <span style={{ fontSize: 12, color: textMuted }}>—</span>}
                      </td>

                      {/* Company */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: text }}>{lead.companies?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: textMuted }}>{lead.companies?.category || ''}</div>
                      </td>

                      {/* Answers preview */}
                      <td style={{ padding: '12px 16px', maxWidth: 180 }}>
                        {lead.answers && Object.keys(lead.answers).length > 0 ? (
                          <div style={{ fontSize: 11, color: textSub, lineHeight: 1.6 }}>
                            {Object.entries(lead.answers).slice(0, 2).map(([q, a]) => (
                              <div key={q}>
                                <span style={{ color: textMuted }}>{q.slice(0, 15)}:</span>{' '}
                                <strong style={{ color: text }}>{String(a).slice(0, 20)}</strong>
                              </div>
                            ))}
                            {Object.keys(lead.answers).length > 2 && (
                              <div style={{ color: textMuted }}>+{Object.keys(lead.answers).length - 2} more</div>
                            )}
                          </div>
                        ) : <span style={{ fontSize: 12, color: textMuted }}>—</span>}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid ' + sc.color, background: isDark ? sc.color + '22' : sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, display: 'inline-block', whiteSpace: 'nowrap' }}>
                          {sc.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: textMuted, whiteSpace: 'nowrap' }}>
                        {new Date(lead.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Expand */}
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => setExpandedId(isExpanded ? null : lead.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 12 }}>
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Row — Full Answers */}
                    {isExpanded && (
                      <tr key={lead.id + '_expanded'} style={{ background: isDark ? 'rgba(3,193,245,0.04)' : '#f0fdff' }}>
                        <td colSpan={7} style={{ padding: '14px 16px', borderBottom: '1px solid ' + borderCol }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: textSub, marginBottom: 10 }}>📋 Full Lead Details</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                            {lead.answers && Object.entries(lead.answers).map(([q, a]) => (
                              <div key={q} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 8, padding: '8px 12px' }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 2 }}>{q}</div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: text }}>{String(a)}</div>
                              </div>
                            ))}
                            {lead.source_url && (
                              <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 8, padding: '8px 12px' }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 2 }}>Source URL</div>
                                <div style={{ fontSize: 12, color: '#03C1F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.source_url}</div>
                              </div>
                            )}
                          </div>
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
