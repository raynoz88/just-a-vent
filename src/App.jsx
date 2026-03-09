import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Filter,
  LayoutGrid,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Tags,
  UserRound,
  Wrench,
} from 'lucide-react'

const issuedPermitsEndpoint = 'https://data.austintexas.gov/resource/3syk-w9eu.json'
const buildingPermitsEndpoint = 'https://data.austintexas.gov/resource/3z4i-4ta5.json'

function escapeSoql(value) {
  return value.replace(/'/g, "''")
}

function buildSocrataUrl(base, { permit, address, contractor, limit = 100 }) {
  const filters = []

  if (permit?.trim()) {
    filters.push(`upper(permit_num) like upper('%${escapeSoql(permit.trim())}%')`)
  }

  if (address?.trim()) {
    filters.push(`upper(issued_address) like upper('%${escapeSoql(address.trim())}%')`)
  }

  if (contractor?.trim()) {
    filters.push(`upper(contractor_company) like upper('%${escapeSoql(contractor.trim())}%')`)
  }

  const where = filters.length ? `$where=${encodeURIComponent(filters.join(' AND '))}` : ''
  const select = `$limit=${limit}&$order=issued_date DESC`
  return `${base}?${[where, select].filter(Boolean).join('&')}`
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

function normalizeRecord(item) {
  return {
    permitNumber: item.permit_num || item.permit_number || 'Permit',
    status: item.status || item.permit_status || 'Unknown',
    address: item.issued_address || item.original_address1 || item.address || 'Address unavailable',
    issuedDate: item.issued_date || '',
    issuedDateLabel: formatDate(item.issued_date),
    permitType: item.permit_type_desc || item.permit_type || '—',
    workClass: item.work_class || item.class || '—',
    contractor: item.contractor_company || item.contractor_name || '—',
    valuation: item.total_valuation || '',
  }
}

function uniqueValues(records, key) {
  const set = new Set(records.map((r) => r[key]).filter(Boolean))
  return [...set].sort((a, b) => String(a).localeCompare(String(b)))
}

function toCsv(rows) {
  const headers = ['Permit Number', 'Status', 'Address', 'Issued Date', 'Permit Type', 'Work Class', 'Contractor', 'Valuation']
  const csvRows = rows.map((r) => [r.permitNumber, r.status, r.address, r.issuedDateLabel, r.permitType, r.workClass, r.contractor, r.valuation])
  const encode = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [headers, ...csvRows].map((row) => row.map(encode).join(',')).join('\n')
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function buildMapUrl(address) {
  if (!address) return 'https://www.google.com/maps'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Austin, TX`)}`
}

function storageGet(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function loadRecentSearches() {
  return storageGet('austin-permit-recent-searches', [])
}

function saveRecentSearch(entry) {
  const existing = loadRecentSearches()
  storageSet('austin-permit-recent-searches', [entry, ...existing.filter((x) => x.id !== entry.id)].slice(0, 8))
}

function loadSavedSearches() {
  return storageGet('austin-permit-saved-searches', [])
}

function saveSavedSearch(entry) {
  const existing = loadSavedSearches()
  storageSet('austin-permit-saved-searches', [entry, ...existing.filter((x) => x.id !== entry.id)].slice(0, 20))
}

function removeSavedSearch(id) {
  const existing = loadSavedSearches()
  storageSet('austin-permit-saved-searches', existing.filter((x) => x.id !== id))
}

function loadPermitMeta() {
  return storageGet('austin-permit-meta', {})
}

function savePermitMeta(meta) {
  storageSet('austin-permit-meta', meta)
}

function permitKey(record) {
  return `${record?.permitNumber || ''}__${record?.address || ''}`
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function AppShell({ children }) {
  return <div style={{ minHeight: '100vh', background: '#f8fafc' }}>{children}</div>
}

function SectionCard({ title, description, children, sticky = false }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 20,
        boxShadow: '0 1px 3px rgba(15,23,42,.08)',
        position: sticky ? 'sticky' : 'static',
        top: sticky ? 24 : undefined,
      }}
    >
      {(title || description) && (
        <div style={{ padding: '20px 20px 8px 20px' }}>
          {title && <div style={{ fontSize: 22, fontWeight: 600 }}>{title}</div>}
          {description && <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>{description}</div>}
        </div>
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function SmallCard({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 16 }}>
      <div style={{ fontSize: 14, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Pill({ children, muted = false }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: muted ? '#fff' : '#eef2ff',
        color: muted ? '#334155' : '#334155',
        border: '1px solid #cbd5e1',
      }}
    >
      {children}
    </span>
  )
}

function ActionButton({ icon: Icon, children, href, onClick, disabled = false, secondary = false, small = false }) {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    padding: small ? '8px 12px' : '10px 14px',
    border: secondary ? '1px solid #cbd5e1' : '1px solid #0f172a',
    background: secondary ? '#fff' : '#0f172a',
    color: secondary ? '#0f172a' : '#fff',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    textDecoration: 'none',
  }

  const content = (
    <>
      {Icon ? <Icon size={16} /> : null}
      <span>{children}</span>
    </>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={style}>
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>
      {content}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {children}
    </label>
  )
}

function TextInput(props) {
  return <input {...props} style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff' }} />
}

function TextArea(props) {
  return <textarea {...props} style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', minHeight: 120, resize: 'vertical' }} />
}

function SelectBox({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff' }}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#e2e8f0', margin: '16px 0' }} />
}

function SearchChip({ icon: Icon, title, subtitle, actions }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: '#f1f5f9', borderRadius: 12, padding: 10 }}>{Icon ? <Icon size={16} /> : null}</div>
          <div>
            <div style={{ fontWeight: 600 }}>{title}</div>
            <div style={{ marginTop: 4, fontSize: 14, color: '#64748b' }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
      </div>
    </div>
  )
}

function CopyButton({ value, label = 'Copy', copyState, setCopyState }) {
  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopyState(String(value))
      window.setTimeout(() => setCopyState(''), 1500)
    } catch {}
  }

  const copied = copyState === String(value)
  return <ActionButton icon={copied ? Check : Copy} secondary small onClick={handleCopy}>{copied ? 'Copied' : label}</ActionButton>
}

function StatRow({ label, value, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 14, color: '#64748b' }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div style={{ fontWeight: 600, textAlign: 'right' }}>{value || '—'}</div>
        {action}
      </div>
    </div>
  )
}

function Tabs({ current, setCurrent }) {
  const tabs = [
    ['lookup', 'Permit Lookup'],
    ['dashboard', 'Contractor Dashboard'],
    ['contractors', 'Contractors'],
    ['resources', 'Resources'],
  ]
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setCurrent(value)}
          style={{
            padding: '10px 14px',
            borderRadius: 16,
            border: '1px solid #cbd5e1',
            background: current === value ? '#0f172a' : '#fff',
            color: current === value ? '#fff' : '#0f172a',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('lookup')
  const [permit, setPermit] = useState('')
  const [address, setAddress] = useState('')
  const [contractor, setContractor] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourceUsed, setSourceUsed] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('issued_desc')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [recentSearches, setRecentSearches] = useState([])
  const [savedSearches, setSavedSearches] = useState([])
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [permitMeta, setPermitMeta] = useState({})
  const [copyState, setCopyState] = useState('')
  const [contractorViewSort, setContractorViewSort] = useState('permits_desc')

  useEffect(() => {
    setRecentSearches(loadRecentSearches())
    setSavedSearches(loadSavedSearches())
    setPermitMeta(loadPermitMeta())
  }, [])

  useEffect(() => {
    if (!address.trim()) {
      setAddressSuggestions([])
      return
    }
    const unique = [...new Set(records.map((r) => r.address).filter((a) => a && a.toLowerCase().includes(address.toLowerCase())))].slice(0, 6)
    setAddressSuggestions(unique)
  }, [address, records])

  function snapshotSearch() {
    return { permit, address, contractor, statusFilter, typeFilter, sortBy }
  }

  function applySearchSnapshot(snapshot) {
    setPermit(snapshot.permit || '')
    setAddress(snapshot.address || '')
    setContractor(snapshot.contractor || '')
    setStatusFilter(snapshot.statusFilter || 'all')
    setTypeFilter(snapshot.typeFilter || 'all')
    setSortBy(snapshot.sortBy || 'issued_desc')
  }

  async function runSearch(activeSnapshot) {
    const snap = activeSnapshot || snapshotSearch()
    setLoading(true)
    setError('')
    setRecords([])
    setSourceUsed('')
    setSelectedRecord(null)

    try {
      let res = await fetch(buildSocrataUrl(issuedPermitsEndpoint, { ...snap, limit: 100 }))
      if (!res.ok) throw new Error('Primary dataset lookup failed.')
      let data = await res.json()

      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map(normalizeRecord)
        setRecords(normalized)
        setSourceUsed('Issued Construction Permits dataset')
        setSelectedRecord(normalized[0] || null)
      } else {
        res = await fetch(buildSocrataUrl(buildingPermitsEndpoint, { ...snap, limit: 100 }))
        if (!res.ok) throw new Error('Backup dataset lookup failed.')
        data = await res.json()
        const normalized = Array.isArray(data) ? data.map(normalizeRecord) : []
        setRecords(normalized)
        setSourceUsed('Building Permits dataset')
        setSelectedRecord(normalized[0] || null)
      }

      const titleBits = [snap.permit, snap.address, snap.contractor].filter(Boolean)
      const label = titleBits.length ? titleBits.join(' • ') : 'Permit search'
      saveRecentSearch({ id: `${slugify(label)}-${Date.now()}`, label, createdAt: new Date().toLocaleString(), snapshot: snap })
      setRecentSearches(loadRecentSearches())
    } catch (err) {
      setError(err?.message || 'Unable to fetch permit data.')
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    setStatusFilter('all')
    setTypeFilter('all')
    setSortBy('issued_desc')
  }

  function clearSearch() {
    setPermit('')
    setAddress('')
    setContractor('')
    setRecords([])
    setError('')
    setSourceUsed('')
    setSelectedRecord(null)
    resetFilters()
  }

  function saveCurrentSearch() {
    const snap = snapshotSearch()
    const titleBits = [snap.permit, snap.address, snap.contractor].filter(Boolean)
    const label = titleBits.length ? titleBits.join(' • ') : 'Permit search'
    saveSavedSearch({ id: `${slugify(label)}-${Date.now()}`, label, createdAt: new Date().toLocaleString(), snapshot: snap })
    setSavedSearches(loadSavedSearches())
  }

  function updateSelectedMeta(partial) {
    if (!selectedRecord) return
    const key = permitKey(selectedRecord)
    const next = { ...permitMeta, [key]: { ...(permitMeta[key] || { tags: '', notes: '' }), ...partial } }
    setPermitMeta(next)
    savePermitMeta(next)
  }

  const statusOptions = useMemo(() => uniqueValues(records, 'status'), [records])
  const typeOptions = useMemo(() => uniqueValues(records, 'permitType'), [records])

  const filteredRecords = useMemo(() => {
    let next = [...records]
    if (statusFilter !== 'all') next = next.filter((r) => r.status === statusFilter)
    if (typeFilter !== 'all') next = next.filter((r) => r.permitType === typeFilter)

    next.sort((a, b) => {
      switch (sortBy) {
        case 'issued_asc':
          return new Date(a.issuedDate || 0).getTime() - new Date(b.issuedDate || 0).getTime()
        case 'permit_asc':
          return a.permitNumber.localeCompare(b.permitNumber)
        case 'permit_desc':
          return b.permitNumber.localeCompare(a.permitNumber)
        default:
          return new Date(b.issuedDate || 0).getTime() - new Date(a.issuedDate || 0).getTime()
      }
    })
    return next
  }, [records, statusFilter, typeFilter, sortBy])

  useEffect(() => {
    if (!filteredRecords.length) {
      setSelectedRecord(null)
      return
    }
    const stillExists = filteredRecords.find((r) => r.permitNumber === selectedRecord?.permitNumber && r.address === selectedRecord?.address)
    setSelectedRecord(stillExists || filteredRecords[0])
  }, [filteredRecords])

  const totalValuation = useMemo(() => filteredRecords.reduce((sum, r) => sum + (Number(r.valuation) || 0), 0), [filteredRecords])

  const contractorSummary = useMemo(() => {
    if (!filteredRecords.length) return null
    const contractorCounts = filteredRecords.reduce((acc, row) => {
      const key = row.contractor || 'Unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    const topContractor = Object.entries(contractorCounts).sort((a, b) => b[1] - a[1])[0]
    return { uniqueContractors: Object.keys(contractorCounts).length, topContractor: topContractor?.[0] || '—', topCount: topContractor?.[1] || 0 }
  }, [filteredRecords])

  const contractorDashboard = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, row) => {
      const key = row.contractor || 'Unknown'
      if (!acc[key]) {
        acc[key] = { contractor: key, permitCount: 0, totalValuation: 0, addresses: new Set(), latestIssuedDate: '', latestIssuedLabel: '—' }
      }
      acc[key].permitCount += 1
      acc[key].totalValuation += Number(row.valuation) || 0
      if (row.address) acc[key].addresses.add(row.address)
      if (!acc[key].latestIssuedDate || new Date(row.issuedDate).getTime() > new Date(acc[key].latestIssuedDate).getTime()) {
        acc[key].latestIssuedDate = row.issuedDate
        acc[key].latestIssuedLabel = row.issuedDateLabel
      }
      return acc
    }, {})

    const rows = Object.values(grouped).map((row) => ({ ...row, uniqueAddresses: row.addresses.size }))
    rows.sort((a, b) => {
      switch (contractorViewSort) {
        case 'valuation_desc':
          return b.totalValuation - a.totalValuation
        case 'name_asc':
          return a.contractor.localeCompare(b.contractor)
        default:
          return b.permitCount - a.permitCount
      }
    })
    return rows
  }, [filteredRecords, contractorViewSort])

  const selectedMeta = selectedRecord ? permitMeta[permitKey(selectedRecord)] || { tags: '', notes: '' } : { tags: '', notes: '' }

  const statusSelectOptions = [{ value: 'all', label: 'All statuses' }, ...statusOptions.map((v) => ({ value: v, label: v }))]
  const typeSelectOptions = [{ value: 'all', label: 'All permit types' }, ...typeOptions.map((v) => ({ value: v, label: v }))]

  return (
    <AppShell>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={24} />
              <h1 style={{ margin: 0, fontSize: 34 }}>Austin Permit & Contractor Lookup</h1>
            </div>
            <p style={{ color: '#64748b', maxWidth: 860, marginTop: 10 }}>
              Search City of Austin permit information by permit number, project address, or contractor company. This Vercel-ready version includes notes, tags, copy tools, saved searches, quick map access, and a contractor dashboard.
            </p>
          </div>

          <SectionCard>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#334155', fontWeight: 600 }}>
              <ShieldCheck size={18} />
              <span>Public-data-first workflow</span>
            </div>
            <div style={{ marginTop: 8, color: '#64748b', fontSize: 14 }}>
              This app is built around public City data and the official AB+C Public Search page. It avoids fragile account scraping and is suited for regular field use.
            </div>
          </SectionCard>

          <Tabs current={tab} setCurrent={setTab} />

          {tab === 'lookup' && (
            <div style={{ display: 'grid', gap: 24 }}>
              <SectionCard title="Search permits" description="Run a broad lookup, then narrow results with filters below.">
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <Field label="Permit Number">
                    <TextInput value={permit} onChange={(e) => setPermit(e.target.value)} placeholder="EX: 2024-123456 BP" />
                  </Field>
                  <Field label="Address">
                    <TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="EX: 123 Main St" />
                  </Field>
                  <Field label="Contractor Company">
                    <TextInput value={contractor} onChange={(e) => setContractor(e.target.value)} placeholder="EX: Texas Grand Plumbing" />
                  </Field>
                </div>

                {addressSuggestions.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    {addressSuggestions.map((suggestion) => (
                      <ActionButton key={suggestion} icon={MapPin} secondary small onClick={() => setAddress(suggestion)}>{suggestion}</ActionButton>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                  <ActionButton icon={Search} onClick={() => runSearch()} disabled={loading}>{loading ? 'Searching...' : 'Search Permits'}</ActionButton>
                  <ActionButton icon={RefreshCw} secondary onClick={clearSearch}>Clear</ActionButton>
                  <ActionButton icon={Download} secondary onClick={() => downloadCsv('austin-permit-results.csv', toCsv(filteredRecords))} disabled={!filteredRecords.length}>Export CSV</ActionButton>
                  <ActionButton icon={Star} secondary onClick={saveCurrentSearch}>Save Search</ActionButton>
                </div>

                {error && (
                  <div style={{ marginTop: 16, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 16, padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Filters and summary" description="Refine the result set without re-running the search.">
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <Field label="Status"><SelectBox value={statusFilter} onChange={setStatusFilter} options={statusSelectOptions} /></Field>
                  <Field label="Permit Type"><SelectBox value={typeFilter} onChange={setTypeFilter} options={typeSelectOptions} /></Field>
                  <Field label="Sort">
                    <SelectBox
                      value={sortBy}
                      onChange={setSortBy}
                      options={[
                        { value: 'issued_desc', label: 'Issued date: newest first' },
                        { value: 'issued_asc', label: 'Issued date: oldest first' },
                        { value: 'permit_asc', label: 'Permit number: A–Z' },
                        { value: 'permit_desc', label: 'Permit number: Z–A' },
                      ]}
                    />
                  </Field>
                  <div style={{ display: 'flex', alignItems: 'end' }}><ActionButton icon={Filter} secondary onClick={resetFilters}>Reset Filters</ActionButton></div>
                </div>

                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginTop: 16 }}>
                  <SmallCard label="Matching permits" value={filteredRecords.length} />
                  <SmallCard label="Data source used" value={sourceUsed || '—'} />
                  <SmallCard label="Total valuation shown" value={`$${totalValuation.toLocaleString()}`} />
                  <SmallCard label="Unique contractors" value={contractorSummary?.uniqueContractors || 0} />
                </div>
              </SectionCard>

              <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0,1.2fr) minmax(320px,.8fr)' }}>
                <div style={{ display: 'grid', gap: 16 }}>
                  {!filteredRecords.length && !loading && (
                    <SectionCard>
                      <div style={{ color: '#64748b' }}>No results yet. Run a search to view matching permits.</div>
                    </SectionCard>
                  )}

                  {filteredRecords.map((item, idx) => {
                    const meta = permitMeta[permitKey(item)] || { tags: '', notes: '' }
                    return (
                      <div key={`${item.permitNumber}-${idx}`} style={{ border: selectedRecord?.permitNumber === item.permitNumber && selectedRecord?.address === item.address ? '2px solid #94a3b8' : '1px solid #e2e8f0', borderRadius: 20, background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.08)' }}>
                        <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 22, fontWeight: 700 }}>{item.permitNumber}</div>
                              <Pill>{item.status}</Pill>
                              {meta.tags ? <Pill muted>{meta.tags}</Pill> : null}
                            </div>
                            <div style={{ color: '#334155' }}>{item.address}</div>
                            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', color: '#64748b', fontSize: 14 }}>
                              <div><strong style={{ color: '#0f172a' }}>Issued:</strong> {item.issuedDateLabel}</div>
                              <div><strong style={{ color: '#0f172a' }}>Type:</strong> {item.permitType}</div>
                              <div><strong style={{ color: '#0f172a' }}>Work Class:</strong> {item.workClass}</div>
                              <div><strong style={{ color: '#0f172a' }}>Contractor:</strong> {item.contractor}</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
                            <div style={{ color: '#64748b' }}>{item.valuation ? `Valuation: $${Number(item.valuation).toLocaleString()}` : ''}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <ActionButton secondary onClick={() => setSelectedRecord(item)}>View Details</ActionButton>
                              <ActionButton href={buildMapUrl(item.address)} icon={MapPin} secondary>Map</ActionButton>
                              <CopyButton value={item.permitNumber} copyState={copyState} setCopyState={setCopyState} label="Permit" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'grid', gap: 16 }}>
                  <SectionCard sticky title="Permit detail" description="Focused summary for the currently selected permit.">
                    {selectedRecord ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>{selectedRecord.contractor}</div>
                        <div style={{ marginTop: 4, color: '#64748b' }}>{selectedRecord.permitNumber}</div>
                        <Divider />
                        <div style={{ display: 'grid', gap: 12 }}>
                          <StatRow label="Project address" value={selectedRecord.address} action={<CopyButton value={selectedRecord.address} copyState={copyState} setCopyState={setCopyState} label="Address" />} />
                          <StatRow label="Permit status" value={selectedRecord.status} />
                          <StatRow label="Permit type" value={selectedRecord.permitType} />
                          <StatRow label="Work class" value={selectedRecord.workClass} />
                          <StatRow label="Issued date" value={selectedRecord.issuedDateLabel} />
                          <StatRow label="Permit number" value={selectedRecord.permitNumber} action={<CopyButton value={selectedRecord.permitNumber} copyState={copyState} setCopyState={setCopyState} label="Permit" />} />
                          <StatRow label="Valuation" value={selectedRecord.valuation ? `$${Number(selectedRecord.valuation).toLocaleString()}` : '—'} />
                        </div>
                        <Divider />
                        <div style={{ display: 'grid', gap: 12 }}>
                          <SearchChip icon={Wrench} title="Open selected address in maps" subtitle="Useful for quick field review and area context." actions={<ActionButton href={buildMapUrl(selectedRecord.address)} secondary>Open Map</ActionButton>} />
                          <SearchChip icon={UserRound} title="Contractor snapshot" subtitle={`Top contractor in filtered results: ${contractorSummary?.topContractor || '—'} (${contractorSummary?.topCount || 0})`} actions={<Pill>{contractorSummary?.uniqueContractors || 0} contractors</Pill>} />
                        </div>
                        <Divider />
                        <div style={{ display: 'grid', gap: 14 }}>
                          <Field label={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Tags size={16} /> Tags</span>}>
                            <TextInput value={selectedMeta.tags} onChange={(e) => updateSelectedMeta({ tags: e.target.value })} placeholder="ex: plumbing, priority, follow-up" />
                          </Field>
                          <Field label="Notes">
                            <TextArea value={selectedMeta.notes} onChange={(e) => updateSelectedMeta({ notes: e.target.value })} placeholder="Store your permit notes here..." />
                          </Field>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#64748b' }}>Select a result to see its permit details.</div>
                    )}
                  </SectionCard>

                  <SectionCard title="Recent searches" description="Last searches run on this device.">
                    <div style={{ display: 'grid', gap: 12 }}>
                      {recentSearches.length ? recentSearches.map((item) => (
                        <SearchChip key={item.id} icon={Clock3} title={item.label} subtitle={item.createdAt} actions={<ActionButton secondary onClick={() => { applySearchSnapshot(item.snapshot); runSearch(item.snapshot) }}>Run Again</ActionButton>} />
                      )) : <div style={{ color: '#64748b' }}>No recent searches yet.</div>}
                    </div>
                  </SectionCard>

                  <SectionCard title="Saved searches" description="Stored search presets for repeat use.">
                    <div style={{ display: 'grid', gap: 12 }}>
                      {savedSearches.length ? savedSearches.map((item) => (
                        <SearchChip
                          key={item.id}
                          icon={Star}
                          title={item.label}
                          subtitle={item.createdAt}
                          actions={(
                            <>
                              <ActionButton secondary onClick={() => { applySearchSnapshot(item.snapshot); runSearch(item.snapshot) }}>Load</ActionButton>
                              <ActionButton secondary onClick={() => { removeSavedSearch(item.id); setSavedSearches(loadSavedSearches()) }}>Remove</ActionButton>
                            </>
                          )}
                        />
                      )) : <div style={{ color: '#64748b' }}>No saved searches yet.</div>}
                    </div>
                  </SectionCard>
                </div>
              </div>
            </div>
          )}

          {tab === 'dashboard' && (
            <SectionCard title="Contractor dashboard" description="Grouped contractor view from the current filtered permit result set.">
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '240px 1fr', alignItems: 'end' }}>
                <Field label="Sort contractors">
                  <SelectBox
                    value={contractorViewSort}
                    onChange={setContractorViewSort}
                    options={[
                      { value: 'permits_desc', label: 'Most permits' },
                      { value: 'valuation_desc', label: 'Highest valuation' },
                      { value: 'name_asc', label: 'Name A–Z' },
                    ]}
                  />
                </Field>
                <div style={{ color: '#64748b', fontSize: 14 }}>This dashboard updates based on the current search and filters in the Permit Lookup tab.</div>
              </div>

              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: 16 }}>
                {contractorDashboard.length ? contractorDashboard.map((row) => (
                  <div key={row.contractor} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><LayoutGrid size={16} /><strong>{row.contractor}</strong></div>
                        <div style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Latest issued: {row.latestIssuedLabel}</div>
                      </div>
                      <Pill>{row.permitCount} permits</Pill>
                    </div>
                    <Divider />
                    <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Unique addresses</span><strong>{row.uniqueAddresses}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Total valuation</span><strong>${row.totalValuation.toLocaleString()}</strong></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <ActionButton secondary onClick={() => { setContractor(row.contractor); setTab('lookup') }}>Use in Search</ActionButton>
                      <CopyButton value={row.contractor} copyState={copyState} setCopyState={setCopyState} />
                    </div>
                  </div>
                )) : <div style={{ color: '#64748b' }}>Run a permit search first to populate the contractor dashboard.</div>}
              </div>
            </SectionCard>
          )}

          {tab === 'contractors' && (
            <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
              <SectionCard title="Contractor registration" description="Quick access to the City’s official contractor registration information.">
                <p style={{ color: '#475569', marginTop: 0 }}>Use this page to review registration requirements and account setup steps for contractor-related permit activity.</p>
                <ActionButton href="https://www.austintexas.gov/page/contractor-registration" icon={ExternalLink}>Open Contractor Registration</ActionButton>
              </SectionCard>
              <SectionCard title="Recommended lookup process" description="Designed to be practical for day-to-day permit research.">
                <div style={{ display: 'grid', gap: 14, color: '#475569' }}>
                  <div style={{ display: 'flex', gap: 10 }}><FileSearch size={16} style={{ marginTop: 3 }} /><span>Search permits broadly by address or company using public data.</span></div>
                  <div style={{ display: 'flex', gap: 10 }}><UserRound size={16} style={{ marginTop: 3 }} /><span>Use the official AB+C Public Search page for a second check when needed.</span></div>
                  <div style={{ display: 'flex', gap: 10 }}><ShieldCheck size={16} style={{ marginTop: 3 }} /><span>Reserve authenticated account access for records tied to your own authorized use.</span></div>
                </div>
              </SectionCard>
            </div>
          )}

          {tab === 'resources' && (
            <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
              <SectionCard title="AB+C Public Search" description="Official City lookup page."><ActionButton href="https://abc.austintexas.gov/web/permit/public-search-other" icon={ExternalLink}>Open Public Search</ActionButton></SectionCard>
              <SectionCard title="Open Data Portal" description="City datasets for broader searching."><ActionButton href="https://data.austintexas.gov/" icon={ExternalLink}>Open Data Portal</ActionButton></SectionCard>
              <SectionCard title="Contractor Registration" description="Registration requirements and guidance."><ActionButton href="https://www.austintexas.gov/page/contractor-registration" icon={ExternalLink}>Open Registration Page</ActionButton></SectionCard>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
