import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Building2,
  UserRound,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Download,
  Filter,
  RefreshCw,
  MapPin,
  Clock3,
  Star,
  Wrench,
  Copy,
  Check,
  Tags,
  LayoutGrid,
} from "lucide-react";

const issuedPermitsEndpoint = "https://data.austintexas.gov/resource/3syk-w9eu.json";
const buildingPermitsEndpoint = "https://data.austintexas.gov/resource/3z4i-4ta5.json";

function escapeSoql(value) {
  return String(value || "").replace(/'/g, "''");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function buildSocrataUrl(base, { permit, address, contractor, limit = 100 }) {
  const filters = [];

  if (permit?.trim()) {
    filters.push(`upper(permit_num) like upper('%${escapeSoql(permit.trim())}%')`);
  }

  if (address?.trim()) {
    filters.push(`upper(issued_address) like upper('%${escapeSoql(address.trim())}%')`);
  }

  const where = filters.length ? `$where=${encodeURIComponent(filters.join(" AND "))}` : "";
  const search = contractor?.trim() ? `$q=${encodeURIComponent(contractor.trim())}` : "";
  const select = `$limit=${limit}&$order=issued_date DESC`;

  return `${base}?${[where, search, select].filter(Boolean).join("&")}`;
}

function normalizeRecord(item) {
  return {
    permitNumber: item.permit_num || item.permit_number || "Permit",
    status: item.status || item.permit_status || "Unknown",
    address: item.issued_address || item.original_address1 || item.address || "Address unavailable",
    issuedDate: item.issued_date || "",
    issuedDateLabel: formatDate(item.issued_date),
    permitType: item.permit_type_desc || item.permit_type || "—",
    workClass: item.work_class || item.class || "—",
    contractor: item.contractor_company || item.contractor_name || "—",
    valuation: item.total_valuation || "",
  };
}

function uniqueValues(records, key) {
  const set = new Set(records.map((r) => r[key]).filter(Boolean));
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
}

function toCsv(rows) {
  const headers = [
    "Permit Number",
    "Status",
    "Address",
    "Issued Date",
    "Permit Type",
    "Work Class",
    "Contractor",
    "Valuation",
  ];

  const csvRows = rows.map((r) => [
    r.permitNumber,
    r.status,
    r.address,
    r.issuedDateLabel,
    r.permitType,
    r.workClass,
    r.contractor,
    r.valuation,
  ]);

  const encode = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers, ...csvRows].map((row) => row.map(encode).join(",")).join("\n");
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildMapUrl(address) {
  if (!address) return "https://www.google.com/maps";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ", Austin, TX")}`;
}

function storageGet(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveRecentSearch(entry) {
  const key = "austin-permit-recent-searches";
  const existing = storageGet(key, []);
  const normalized = [entry, ...existing.filter((x) => x.id !== entry.id)].slice(0, 8);
  storageSet(key, normalized);
}

function loadRecentSearches() {
  return storageGet("austin-permit-recent-searches", []);
}

function saveSavedSearch(entry) {
  const key = "austin-permit-saved-searches";
  const existing = storageGet(key, []);
  const normalized = [entry, ...existing.filter((x) => x.id !== entry.id)].slice(0, 20);
  storageSet(key, normalized);
}

function loadSavedSearches() {
  return storageGet("austin-permit-saved-searches", []);
}

function removeSavedSearch(id) {
  const key = "austin-permit-saved-searches";
  const existing = storageGet(key, []);
  storageSet(key, existing.filter((x) => x.id !== id));
}

function loadPermitMeta() {
  return storageGet("austin-permit-meta", {});
}

function savePermitMeta(meta) {
  storageSet("austin-permit-meta", meta);
}

function permitKey(record) {
  return `${record?.permitNumber || ""}__${record?.address || ""}`;
}

function SectionCard({ title, description, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {(title || description) && (
        <div className="mb-4">
          {title ? <h2 className="text-xl font-semibold text-slate-900">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      )}
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="min-h-[120px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ children, icon, variant = "primary", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition";
  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50";

  return (
    <button className={`${base} ${styles}`} {...props}>
      {icon}
      {children}
    </button>
  );
}

function BadgePill({ children, tone = "default" }) {
  const styles =
    tone === "solid"
      ? "bg-slate-900 text-white"
      : "border border-slate-300 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{children}</span>;
}

function AlertBox({ title, children, destructive = false }) {
  const styles = destructive
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        {destructive ? <AlertCircle className="mt-0.5 h-5 w-5" /> : <ShieldCheck className="mt-0.5 h-5 w-5" />}
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-slate-200" />;
}

function StatRow({ label, value, action }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <div className="flex items-center gap-2 text-right font-medium text-slate-800">
        <span>{value || "—"}</span>
        {action}
      </div>
    </div>
  );
}

function SearchChip({ icon, title, subtitle, actions }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-slate-100 p-2">{icon}</div>
          <div>
            <div className="font-medium text-slate-900">{title}</div>
            <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}

function CopyButton({ value, copyState, setCopyState, label = "Copy" }) {
  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopyState(String(value));
      window.setTimeout(() => setCopyState(""), 1500);
    } catch {
      setCopyState("");
    }
  }

  const copied = copyState === String(value);

  return (
    <ActionButton variant="secondary" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </ActionButton>
  );
}

export default function AustinPermitContractorApp() {
  const [activeTab, setActiveTab] = useState("lookup");
  const [permit, setPermit] = useState("");
  const [address, setAddress] = useState("");
  const [contractor, setContractor] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourceUsed, setSourceUsed] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("issued_desc");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [permitMeta, setPermitMeta] = useState({});
  const [copyState, setCopyState] = useState("");
  const [contractorViewSort, setContractorViewSort] = useState("permits_desc");

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
    setSavedSearches(loadSavedSearches());
    setPermitMeta(loadPermitMeta());
  }, []);

  useEffect(() => {
    if (!address.trim()) {
      setAddressSuggestions([]);
      return;
    }
    const unique = [...new Set(records.map((r) => r.address).filter((a) => a && a.toLowerCase().includes(address.toLowerCase())))]
      .slice(0, 6);
    setAddressSuggestions(unique);
  }, [address, records]);

  function snapshotSearch() {
    return { permit, address, contractor, statusFilter, typeFilter, sortBy };
  }

  function applySearchSnapshot(snapshot) {
    setPermit(snapshot.permit || "");
    setAddress(snapshot.address || "");
    setContractor(snapshot.contractor || "");
    setStatusFilter(snapshot.statusFilter || "all");
    setTypeFilter(snapshot.typeFilter || "all");
    setSortBy(snapshot.sortBy || "issued_desc");
  }

  async function runSearch(activeSnapshot) {
    const snap = activeSnapshot || snapshotSearch();
    setLoading(true);
    setError("");
    setRecords([]);
    setSourceUsed("");
    setSelectedRecord(null);

    async function attemptFetch(url, sourceLabel) {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        let details = "";
        try {
          details = await res.text();
        } catch {
          details = "";
        }
        throw new Error(`${sourceLabel} failed (${res.status})${details ? `: ${details.slice(0, 180)}` : ""}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    try {
      let primaryError = "";
      let data = [];

      try {
        data = await attemptFetch(buildSocrataUrl(issuedPermitsEndpoint, { ...snap, limit: 100 }), "Primary dataset lookup");
      } catch (err) {
        primaryError = err?.message || "Primary dataset lookup failed.";
      }

      let normalized = [];

      if (data.length > 0) {
        normalized = data.map(normalizeRecord);
        setSourceUsed("Issued Construction Permits dataset");
      } else {
        const backupData = await attemptFetch(buildSocrataUrl(buildingPermitsEndpoint, { ...snap, limit: 100 }), "Backup dataset lookup");
        normalized = backupData.map(normalizeRecord);
        setSourceUsed("Building Permits dataset");
        if (!normalized.length && primaryError) {
          setError(`${primaryError} Backup dataset returned no matching results.`);
        }
      }

      if (snap.contractor?.trim()) {
        normalized = normalized.filter((row) => row.contractor.toLowerCase().includes(snap.contractor.trim().toLowerCase()));
      }

      setRecords(normalized);
      setSelectedRecord(normalized[0] || null);

      const titleBits = [snap.permit, snap.address, snap.contractor].filter(Boolean);
      const label = titleBits.length ? titleBits.join(" • ") : "Permit search";
      const entry = {
        id: `${slugify(label)}-${Date.now()}`,
        label,
        createdAt: new Date().toLocaleString(),
        snapshot: snap,
      };
      saveRecentSearch(entry);
      setRecentSearches(loadRecentSearches());
    } catch (err) {
      setError(err?.message || "Unable to fetch permit data.");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setStatusFilter("all");
    setTypeFilter("all");
    setSortBy("issued_desc");
  }

  function saveCurrentSearch() {
    const snap = snapshotSearch();
    const titleBits = [snap.permit, snap.address, snap.contractor].filter(Boolean);
    const label = titleBits.length ? titleBits.join(" • ") : "Permit search";
    const entry = {
      id: `${slugify(label)}-${Date.now()}`,
      label,
      createdAt: new Date().toLocaleString(),
      snapshot: snap,
    };
    saveSavedSearch(entry);
    setSavedSearches(loadSavedSearches());
  }

  function updateSelectedMeta(partial) {
    if (!selectedRecord) return;
    const key = permitKey(selectedRecord);
    const next = {
      ...permitMeta,
      [key]: { ...(permitMeta[key] || { tags: "", notes: "" }), ...partial },
    };
    setPermitMeta(next);
    savePermitMeta(next);
  }

  const statusOptions = useMemo(() => uniqueValues(records, "status"), [records]);
  const typeOptions = useMemo(() => uniqueValues(records, "permitType"), [records]);

  const filteredRecords = useMemo(() => {
    const next = [...records]
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => (typeFilter === "all" ? true : r.permitType === typeFilter));

    next.sort((a, b) => {
      switch (sortBy) {
        case "issued_asc":
          return new Date(a.issuedDate || 0).getTime() - new Date(b.issuedDate || 0).getTime();
        case "permit_asc":
          return a.permitNumber.localeCompare(b.permitNumber);
        case "permit_desc":
          return b.permitNumber.localeCompare(a.permitNumber);
        default:
          return new Date(b.issuedDate || 0).getTime() - new Date(a.issuedDate || 0).getTime();
      }
    });

    return next;
  }, [records, statusFilter, typeFilter, sortBy]);

  useEffect(() => {
    if (!filteredRecords.length) {
      setSelectedRecord(null);
      return;
    }
    const stillExists = filteredRecords.find((r) => r.permitNumber === selectedRecord?.permitNumber && r.address === selectedRecord?.address);
    setSelectedRecord(stillExists || filteredRecords[0]);
  }, [filteredRecords]);

  const totalValuation = useMemo(() => filteredRecords.reduce((sum, r) => sum + (Number(r.valuation) || 0), 0), [filteredRecords]);

  const contractorSummary = useMemo(() => {
    if (!filteredRecords.length) return null;
    const contractorCounts = filteredRecords.reduce((acc, row) => {
      const key = row.contractor || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topContractor = Object.entries(contractorCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      uniqueContractors: Object.keys(contractorCounts).length,
      topContractor: topContractor?.[0] || "—",
      topCount: topContractor?.[1] || 0,
    };
  }, [filteredRecords]);

  const contractorDashboard = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, row) => {
      const key = row.contractor || "Unknown";
      if (!acc[key]) {
        acc[key] = {
          contractor: key,
          permitCount: 0,
          totalValuation: 0,
          addresses: new Set(),
          latestIssuedDate: "",
          latestIssuedLabel: "—",
        };
      }
      acc[key].permitCount += 1;
      acc[key].totalValuation += Number(row.valuation) || 0;
      if (row.address) acc[key].addresses.add(row.address);
      if (!acc[key].latestIssuedDate || new Date(row.issuedDate).getTime() > new Date(acc[key].latestIssuedDate).getTime()) {
        acc[key].latestIssuedDate = row.issuedDate;
        acc[key].latestIssuedLabel = row.issuedDateLabel;
      }
      return acc;
    }, {});

    const rows = Object.values(grouped).map((row) => ({ ...row, uniqueAddresses: row.addresses.size }));
    rows.sort((a, b) => {
      switch (contractorViewSort) {
        case "valuation_desc":
          return b.totalValuation - a.totalValuation;
        case "name_asc":
          return a.contractor.localeCompare(b.contractor);
        default:
          return b.permitCount - a.permitCount;
      }
    });
    return rows;
  }, [filteredRecords, contractorViewSort]);

  const selectedMeta = selectedRecord ? permitMeta[permitKey(selectedRecord)] || { tags: "", notes: "" } : { tags: "", notes: "" };

  const tabButton = (key, label) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`rounded-full px-3 py-2 text-sm font-medium transition ${activeTab === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Austin Permit & Contractor Lookup</h1>
          </div>
          <p className="max-w-4xl text-sm text-slate-600">Search City of Austin permit information by permit number, project address, or contractor company.</p>
        </div>

        <AlertBox title="Public-data-first workflow">This app is built around public City data and the official AB+C Public Search page.</AlertBox>

        <div className="flex flex-wrap gap-2">
          {tabButton("lookup", "Permit Lookup")}
          {tabButton("dashboard", "Contractor Dashboard")}
          {tabButton("contractors", "Contractors")}
          {tabButton("resources", "Resources")}
        </div>

        {activeTab === "lookup" ? (
          <div className="space-y-6">
            <SectionCard title="Search permits" description="Run a broad lookup, then narrow results with filters below.">
              <div className="grid gap-4 md:grid-cols-3">
                <TextInput label="Permit Number" value={permit} onChange={(e) => setPermit(e.target.value)} placeholder="EX: 2024-123456 BP" />
                <TextInput label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="EX: 123 Main St" />
                <TextInput label="Contractor Company" value={contractor} onChange={(e) => setContractor(e.target.value)} placeholder="EX: Texas Grand Plumbing" />
              </div>

              {addressSuggestions.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {addressSuggestions.map((suggestion) => (
                    <ActionButton key={suggestion} variant="secondary" onClick={() => setAddress(suggestion)} icon={<MapPin className="h-4 w-4" />}>
                      {suggestion}
                    </ActionButton>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <ActionButton onClick={() => runSearch()} disabled={loading} icon={<Search className="h-4 w-4" />}>
                  {loading ? "Searching..." : "Search Permits"}
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    setPermit("");
                    setAddress("");
                    setContractor("");
                    setRecords([]);
                    setError("");
                    setSourceUsed("");
                    setSelectedRecord(null);
                    resetFilters();
                  }}
                  icon={<RefreshCw className="h-4 w-4" />}
                >
                  Clear
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => downloadCsv("austin-permit-results.csv", toCsv(filteredRecords))} disabled={filteredRecords.length === 0} icon={<Download className="h-4 w-4" />}>
                  Export CSV
                </ActionButton>
                <ActionButton variant="secondary" onClick={saveCurrentSearch} icon={<Star className="h-4 w-4" />}>
                  Save Search
                </ActionButton>
              </div>

              {error ? <div className="mt-4"><AlertBox title="Search error" destructive>{error}</AlertBox></div> : null}
            </SectionCard>

            <SectionCard title="Filters and summary" description="Refine the result set without re-running the search.">
              <div className="grid gap-4 md:grid-cols-4">
                <SelectInput label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, ...statusOptions.map((v) => ({ value: v, label: v }))]} />
                <SelectInput label="Permit Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: "all", label: "All permit types" }, ...typeOptions.map((v) => ({ value: v, label: v }))]} />
                <SelectInput
                  label="Sort"
                  value={sortBy}
                  onChange={setSortBy}
                  options={[
                    { value: "issued_desc", label: "Issued date: newest first" },
                    { value: "issued_asc", label: "Issued date: oldest first" },
                    { value: "permit_asc", label: "Permit number: A–Z" },
                    { value: "permit_desc", label: "Permit number: Z–A" },
                  ]}
                />
                <div className="flex items-end">
                  <ActionButton variant="secondary" onClick={resetFilters} icon={<Filter className="h-4 w-4" />}>Reset Filters</ActionButton>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <SectionCard><div className="text-sm text-slate-500">Matching permits</div><div className="mt-1 text-2xl font-semibold text-slate-900">{filteredRecords.length}</div></SectionCard>
                <SectionCard><div className="text-sm text-slate-500">Data source used</div><div className="mt-1 text-base font-medium text-slate-900">{sourceUsed || "—"}</div></SectionCard>
                <SectionCard><div className="text-sm text-slate-500">Total valuation shown</div><div className="mt-1 text-2xl font-semibold text-slate-900">${totalValuation.toLocaleString()}</div></SectionCard>
                <SectionCard><div className="text-sm text-slate-500">Unique contractors</div><div className="mt-1 text-2xl font-semibold text-slate-900">{contractorSummary?.uniqueContractors || 0}</div></SectionCard>
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4">
                {filteredRecords.length === 0 && !loading ? (
                  <SectionCard><div className="text-sm text-slate-500">No results yet. Run a search to view matching permits.</div></SectionCard>
                ) : null}

                {filteredRecords.map((item, idx) => {
                  const meta = permitMeta[permitKey(item)] || { tags: "", notes: "" };
                  const isSelected = selectedRecord?.permitNumber === item.permitNumber && selectedRecord?.address === item.address;
                  return (
                    <div key={`${item.permitNumber}-${idx}`} className={`rounded-3xl border bg-white p-5 shadow-sm ${isSelected ? "border-slate-400" : "border-slate-200"}`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{item.permitNumber}</h3>
                            <BadgePill>{item.status}</BadgePill>
                            {meta.tags ? <BadgePill>{meta.tags}</BadgePill> : null}
                          </div>
                          <p className="text-sm text-slate-700">{item.address}</p>
                          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-4">
                            <div><span className="font-medium text-slate-800">Issued:</span> {item.issuedDateLabel}</div>
                            <div><span className="font-medium text-slate-800">Type:</span> {item.permitType}</div>
                            <div><span className="font-medium text-slate-800">Work Class:</span> {item.workClass}</div>
                            <div><span className="font-medium text-slate-800">Contractor:</span> {item.contractor}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-start gap-3 text-sm text-slate-500 md:items-end">
                          <div>{item.valuation ? `Valuation: $${Number(item.valuation).toLocaleString()}` : ""}</div>
                          <div className="flex flex-wrap gap-2">
                            <ActionButton variant="secondary" onClick={() => setSelectedRecord(item)}>View Details</ActionButton>
                            <a href={buildMapUrl(item.address)} target="_blank" rel="noreferrer"><ActionButton variant="secondary" icon={<MapPin className="h-4 w-4" />}>Map</ActionButton></a>
                            <CopyButton value={item.permitNumber} copyState={copyState} setCopyState={setCopyState} label="Permit" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                <SectionCard title="Permit detail" description="Focused summary for the currently selected permit.">
                  {selectedRecord ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{selectedRecord.contractor}</div>
                        <div className="mt-1 text-sm text-slate-500">{selectedRecord.permitNumber}</div>
                      </div>
                      <Divider />
                      <div className="space-y-3">
                        <StatRow label="Project address" value={selectedRecord.address} action={<CopyButton value={selectedRecord.address} copyState={copyState} setCopyState={setCopyState} label="Address" />} />
                        <StatRow label="Permit status" value={selectedRecord.status} />
                        <StatRow label="Permit type" value={selectedRecord.permitType} />
                        <StatRow label="Work class" value={selectedRecord.workClass} />
                        <StatRow label="Issued date" value={selectedRecord.issuedDateLabel} />
                        <StatRow label="Permit number" value={selectedRecord.permitNumber} action={<CopyButton value={selectedRecord.permitNumber} copyState={copyState} setCopyState={setCopyState} label="Permit" />} />
                        <StatRow label="Valuation" value={selectedRecord.valuation ? `$${Number(selectedRecord.valuation).toLocaleString()}` : "—"} />
                      </div>
                      <Divider />
                      <div className="grid gap-3">
                        <SearchChip
                          icon={<Wrench className="h-4 w-4" />}
                          title="Open selected address in maps"
                          subtitle="Useful for quick field review and area context."
                          actions={<a href={buildMapUrl(selectedRecord.address)} target="_blank" rel="noreferrer"><ActionButton variant="secondary">Open Map</ActionButton></a>}
                        />
                        <SearchChip
                          icon={<UserRound className="h-4 w-4" />}
                          title="Contractor snapshot"
                          subtitle={`Top contractor in filtered results: ${contractorSummary?.topContractor || "—"} (${contractorSummary?.topCount || 0})`}
                          actions={<BadgePill>{contractorSummary?.uniqueContractors || 0} contractors</BadgePill>}
                        />
                      </div>
                      <Divider />
                      <div className="space-y-3">
                        <TextInput label="Tags" value={selectedMeta.tags} onChange={(e) => updateSelectedMeta({ tags: e.target.value })} placeholder="ex: plumbing, priority, follow-up" />
                        <TextArea label="Notes" value={selectedMeta.notes} onChange={(e) => updateSelectedMeta({ notes: e.target.value })} placeholder="Store your permit notes here..." />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Select a result to see its permit details.</div>
                  )}
                </SectionCard>

                <SectionCard title="Recent searches" description="Last searches run on this device.">
                  <div className="space-y-3">
                    {recentSearches.length ? recentSearches.map((item) => (
                      <SearchChip key={item.id} icon={<Clock3 className="h-4 w-4" />} title={item.label} subtitle={item.createdAt} actions={<ActionButton variant="secondary" onClick={() => { applySearchSnapshot(item.snapshot); runSearch(item.snapshot); }}>Run Again</ActionButton>} />
                    )) : <div className="text-sm text-slate-500">No recent searches yet.</div>}
                  </div>
                </SectionCard>

                <SectionCard title="Saved searches" description="Stored search presets for repeat use.">
                  <div className="space-y-3">
                    {savedSearches.length ? savedSearches.map((item) => (
                      <SearchChip
                        key={item.id}
                        icon={<Star className="h-4 w-4" />}
                        title={item.label}
                        subtitle={item.createdAt}
                        actions={
                          <>
                            <ActionButton variant="secondary" onClick={() => { applySearchSnapshot(item.snapshot); runSearch(item.snapshot); }}>Load</ActionButton>
                            <ActionButton variant="secondary" onClick={() => { removeSavedSearch(item.id); setSavedSearches(loadSavedSearches()); }}>Remove</ActionButton>
                          </>
                        }
                      />
                    )) : <div className="text-sm text-slate-500">No saved searches yet.</div>}
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "dashboard" ? (
          <SectionCard title="Contractor dashboard" description="Grouped contractor view from the current filtered permit result set.">
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <SelectInput
                label="Sort contractors"
                value={contractorViewSort}
                onChange={setContractorViewSort}
                options={[
                  { value: "permits_desc", label: "Most permits" },
                  { value: "valuation_desc", label: "Highest valuation" },
                  { value: "name_asc", label: "Name A–Z" },
                ]}
              />
              <div className="flex items-end text-sm text-slate-500">This dashboard updates based on the current search and filters in the Permit Lookup tab.</div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {contractorDashboard.length ? contractorDashboard.map((row) => (
                <div key={row.contractor} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /><div className="font-semibold text-slate-900">{row.contractor}</div></div>
                      <div className="mt-1 text-sm text-slate-500">Latest issued: {row.latestIssuedLabel}</div>
                    </div>
                    <BadgePill>{row.permitCount} permits</BadgePill>
                  </div>
                  <Divider />
                  <div className="space-y-2 pt-3 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Unique addresses</span><span className="font-medium text-slate-900">{row.uniqueAddresses}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Total valuation</span><span className="font-medium text-slate-900">${row.totalValuation.toLocaleString()}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3">
                    <ActionButton variant="secondary" onClick={() => { setActiveTab("lookup"); setContractor(row.contractor); }}>Use in Search</ActionButton>
                    <CopyButton value={row.contractor} copyState={copyState} setCopyState={setCopyState} label="Copy" />
                  </div>
                </div>
              )) : <SectionCard><div className="text-sm text-slate-500">Run a permit search first to populate the contractor dashboard.</div></SectionCard>}
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "contractors" ? (
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Contractor registration" description="Quick access to the City’s official contractor registration information.">
              <p className="text-sm text-slate-700">Use this page to review registration requirements and account setup steps for contractor-related permit activity.</p>
              <div className="mt-4"><a href="https://www.austintexas.gov/page/contractor-registration" target="_blank" rel="noreferrer"><ActionButton icon={<ExternalLink className="h-4 w-4" />}>Open Contractor Registration</ActionButton></a></div>
            </SectionCard>
            <SectionCard title="Recommended lookup process" description="Designed to be practical for day-to-day permit research.">
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex gap-3"><Search className="mt-0.5 h-4 w-4 shrink-0" /><p>Search permits broadly by address or company using public data.</p></div>
                <div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 shrink-0" /><p>Use the official AB+C Public Search page for a second check when needed.</p></div>
                <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Reserve authenticated account access for records tied to your own authorized use.</p></div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "resources" ? (
          <div className="grid gap-6 md:grid-cols-3">
            <SectionCard title="AB+C Public Search" description="Official City lookup page.">
              <a href="https://abc.austintexas.gov/web/permit/public-search-other" target="_blank" rel="noreferrer"><ActionButton icon={<ExternalLink className="h-4 w-4" />}>Open Public Search</ActionButton></a>
            </SectionCard>
            <SectionCard title="Open Data Portal" description="City datasets for broader searching.">
              <a href="https://data.austintexas.gov/" target="_blank" rel="noreferrer"><ActionButton variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>Open Data Portal</ActionButton></a>
            </SectionCard>
            <SectionCard title="Contractor Registration" description="Registration requirements and guidance.">
              <a href="https://www.austintexas.gov/page/contractor-registration" target="_blank" rel="noreferrer"><ActionButton variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>Open Registration Page</ActionButton></a>
            </SectionCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
