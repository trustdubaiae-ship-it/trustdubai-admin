import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const LEAD_STATUSES = [
  { value: 'new',            label: 'New',             color: '#03C1F5', bg: '#e0f9ff' },
  { value: 'qualified',      label: 'Qualified',       color: '#8b5cf6', bg: '#f5f3ff' },
  { value: 'in_conversation',label: 'In Conversation', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'proposal_given', label: 'Proposal Given',  color: '#f59e0b', bg: '#fef9ed' },
  { value: 'won',            label: 'Won',             color: '#10b981', bg: '#ecfdf5' },
  { value: 'lost',           label: 'Lost',            color: '#ef4444', bg: '#fef2f2' },
]

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [companies, setCompanies] = useState([])
  const [period, setPeriod] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: leadsData } = await supabase
      .from('lead_submissions')
      .select('*, companies(name, category, owner_email)')
      .order('created_at', { ascending: false })

    setLeads(leadsData || [])

    // Unique companies
    const uniqueCompanies = []
    const seen = new Set()
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
    if (period === 'today') {
      const today = now.toISOString().split('T')[0]
      return data.filter(l => l.created_at?.startsWith(today))
    }
    if (period === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      return data.filter(l => l.created_at >= weekAgo)
    }
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      return data.filter(l => l.created_at >= monthStart)
    }
    return data
  }

  const filtered = filterByPeriod(leads)
    .filter(l => statusFilter === 'all' ? true : (l.status || 'new') === statusFilter)
    .filter(l => companyFilter === 'all' ? true : l.company_id === companyFilter)
    .filter(l => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        l.name?.toLowerCase().includes(s) ||
        l.phone?.toLowerCase().includes(s) ||
        l.email?.toLowerCase().includes(s) ||
        l.companies?.name?.toLowerCase().includes(s)
      )
    })

  const statusConfig = (status) => LEAD_STATUSES.find(s => s.value === status) || LEAD_STATUSES[0]

  // Stats
  const totalLeads = filtered.length
  const wonLeads = filtered.filter(l => l.status === 'won').length
  const newLeads = filtered.filter(l => !l.status || l.status === 'new').length
  const activeLeads = filtered.filter(l => !['won', 'lost'].includes(l.status || 'new')).length
  const wonRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  // Company wise breakdown
  const companyBreakdown = companies.map(c => {
    const cLeads = filtered.filter(l => l.company_id === c.id)
    const cWon = cLeads.filter(l => l.status === 'won').length
    return { ...c, total: cLeads.length, won: cWon, rate: cLeads.length > 0 ? Math.round((cWon / cLeads.length) * 100) : 0 }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>All Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>All leads from all companies — read only view</p>
        </div>
        {/* Period filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'week',  label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'all',   label: 'All Time' },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500,
              background: period === p.key ? 'var(--primary)' : 'var(--bg)',
              color: period === p.key ? '#fff' : 'var(--text2)',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Leads', value: totalLeads, color: '#03C1F5' },
          { label: 'New', value: newLeads, color: '#8b5cf6' },
          { label: 'Active', value: activeLeads, color: '#f59e0b' },
          { label: 'Won', value: wonLeads, color: '#10b981' },
          { label: 'Won Rate', value: wonRate + '%', color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Company breakdown */}
      {companyBreakdown.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>Company-wise Conversion</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {companyBreakdown.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: c.rate + '%', height: '100%', background: c.rate >= 50 ? '#10b981' : c.rate >= 25 ? '#f59e0b' : '#03C1F5', borderRadius: 99, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', width: 80, textAlign: 'right' }}>
                  {c.won}/{c.total} · <strong style={{ color: '#10b981' }}>{c.rate}%</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, company..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          <option value="all">All Status</option>
          {LEAD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', maxWidth: 200 }}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Leads table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No leads found</div>
          <div style={{ fontSize: 13 }}>Try adjusting your filters</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Customer', 'Contact', 'Company', 'Answers', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const sc = statusConfig(lead.status || 'new')
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Customer */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e0f9ff', color: '#03C1F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                          {(lead.name || 'A')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.name || 'Anonymous'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.email || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td style={{ padding: '12px 16px' }}>
                      {lead.phone ? (
                        <a href={'https://wa.me/' + lead.phone.replace(/[^0-9]/g, '')} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#10b981', fontSize: 12, fontWeight: 500, padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
                          💬 {lead.phone}
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                      )}
                    </td>

                    {/* Company */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.companies?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.companies?.category || ''}</div>
                    </td>

                    {/* Answers */}
                    <td style={{ padding: '12px 16px', maxWidth: 200 }}>
                      {lead.answers && Object.keys(lead.answers).length > 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
                          {Object.entries(lead.answers).slice(0, 2).map(([q, a]) => (
                            <div key={q}>
                              <span style={{ color: 'var(--text3)' }}>{q.slice(0, 20)}:</span>{' '}
                              <strong>{String(a).slice(0, 25)}</strong>
                            </div>
                          ))}
                          {Object.keys(lead.answers).length > 2 && (
                            <div style={{ color: 'var(--text3)' }}>+{Object.keys(lead.answers).length - 2} more</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                      )}
                    </td>

                    {/* Status — Read only badge */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 20,
                        border: '1.5px solid ' + sc.color,
                        background: sc.bg, color: sc.color,
                        fontSize: 11, fontWeight: 600,
                        display: 'inline-block', whiteSpace: 'nowrap'
                      }}>
                        {sc.label}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {new Date(lead.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>
            {filtered.length} leads found
          </div>
        </div>
      )}
    </div>
  )
}
