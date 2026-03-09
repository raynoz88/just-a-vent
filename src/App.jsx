import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Building2,
  UserRound,
  ShieldCheck,
  ExternalLink,
  FileSearch,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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
    raw: item,
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
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
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
    <Button variant="outline" size="sm" className="rounded-xl" onClick={handleCopy}>
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export default function AustinPermitContractorApp() {
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
    return {
      permit,
      address,
      contractor,
      statusFilter,
      typeFilter,
      sortBy,
    };
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
        data = await attemptFetch(
          buildSocrataUrl(issuedPermitsEndpoint, { ...snap, limit: 100 }),
          "Primary dataset lookup"
        );
      } catch (err) {
        primaryError = err?.message || "Primary dataset lookup failed.";
      }

      if (data.length > 0) {
        const normalized = data.map(normalizeRecord).filter((row) => {
          if (!snap.contractor?.trim()) return true;
          return row.contractor.toLowerCase().includes(snap.contractor.trim().toLowerCase());
        });
        setRecords(normalized);
        setSourceUsed("Issued Construction Permits dataset");
        setSelectedRecord(normalized[0] || null);
      } else {
        const backupData = await attemptFetch(
          buildSocrataUrl(buildingPermitsEndpoint, { ...snap, limit: 100 }),
          "Backup dataset lookup"
        );
        const normalized = backupData.map(normalizeRecord).filter((row) => {
          if (!snap.contractor?.trim()) return true;
          return row.contractor.toLowerCase().includes(snap.contractor.trim().toLowerCase());
        });
        setRecords(normalized);
        setSourceUsed("Building Permits dataset");
        setSelectedRecord(normalized[0] || null);

        if (!normalized.length && primaryError) {
          setError(`${primaryError} Backup dataset returned no matching results.`);
        }
      }

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
      [key]: {
        ...(permitMeta[key] || { tags: "", notes: "" }),
        ...partial,
      },
    };
    setPermitMeta(next);
    savePermitMeta(next);
  }

  const statusOptions = useMemo(() => uniqueValues(records, "status"), [records]);
  const typeOptions = useMemo(() => uniqueValues(records, "permitType"), [records]);

  const filteredRecords = useMemo(() => {
    let next = [...records];

    if (statusFilter !== "all") {
      next = next.filter((r) => r.status === statusFilter);
    }
    if (typeFilter !== "all") {
      next = next.filter((r) => r.permitType === typeFilter);
    }

    next.sort((a, b) => {
      switch (sortBy) {
        case "issued_asc":
          return new Date(a.issuedDate || 0).getTime() - new Date(b.issuedDate || 0).getTime();
        case "permit_asc":
          return a.permitNumber.localeCompare(b.permitNumber);
        case "permit_desc":
          return b.permitNumber.localeCompare(a.permitNumber);
        case "issued_desc":
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
    const stillExists = filteredRecords.find(
      (r) => r.permitNumber === selectedRecord?.permitNumber && r.address === selectedRecord?.address
    );
    setSelectedRecord(stillExists || filteredRecords[0]);
  }, [filteredRecords]);

  const totalValuation = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.valuation) || 0), 0);
  }, [filteredRecords]);

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
      if (
        !acc[key].latestIssuedDate ||
        new Date(row.issuedDate).getTime() > new Date(acc[key].latestIssuedDate).getTime()
      ) {
        acc[key].latestIssuedDate = row.issuedDate;
        acc[key].latestIssuedLabel = row.issuedDateLabel;
      }
      return acc;
    }, {});

    const rows = Object.values(grouped).map((row) => ({
      ...row,
      uniqueAddresses: row.addresses.size,
    }));

    rows.sort((a, b) => {
      switch (contractorViewSort) {
        case "valuation_desc":
          return b.totalValuation - a.totalValuation;
        case "name_asc":
          return a.contractor.localeCompare(b.contractor);
        case "permits_desc":
        default:
          return b.permitCount - a.permitCount;
      }
    });

    return rows;
  }, [filteredRecords, contractorViewSort]);

  const selectedMeta = selectedRecord
    ? permitMeta[permitKey(selectedRecord)] || { tags: "", notes: "" }
    : { tags: "", notes: "" };

  const publicSearchLink = "https://abc.austintexas.gov/web/permit/public-search-other";
  const contractorRegistrationLink = "https://www.austintexas.gov/page/contractor-registration";
  const openDataLink = "https://data.austintexas.gov/";

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            <h1 className="text-3xl font-semibold tracking-tight">Austin Permit & Contractor Lookup</h1>
          </div>
          <p className="max-w-4xl text-sm text-slate-600">
            Search City of Austin permit information by permit number, project address, or contractor company.
          </p>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Public-data-first workflow</AlertTitle>
          <AlertDescription>
            This app is built around public City data and the official AB+C Public Search page.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="lookup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 md:w-[940px]">
            <TabsTrigger value="lookup">Permit Lookup</TabsTrigger>
            <TabsTrigger value="dashboard">Contractor Dashboard</TabsTrigger>
            <TabsTrigger value="contractors">Contractors</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="lookup" className="space-y-6">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Search permits</CardTitle>
                <CardDescription>Run a broad lookup, then narrow results with filters below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Permit Number</label>
                    <Input value={permit} onChange={(e) => setPermit(e.target.value)} placeholder="EX: 2024-123456 BP" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Address</label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="EX: 123 Main St" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contractor Company</label>
                    <Input value={contractor} onChange={(e) => setContractor(e.target.value)} placeholder="EX: Texas Grand Plumbing" />
                  </div>
                </div>

                {addressSuggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {addressSuggestions.map((suggestion) => (
                      <Button key={suggestion} variant="outline" className="rounded-2xl" onClick={() => setAddress(suggestion)}>
                        <MapPin className="mr-2 h-4 w-4" />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => runSearch()} disabled={loading} className="rounded-2xl">
                    <Search className="mr-2 h-4 w-4" />
                    {loading ? "Searching..." : "Search Permits"}
                  </Button>
                  <Button
                    variant="outline"
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
                    className="rounded-2xl"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => downloadCsv("austin-permit-results.csv", toCsv(filteredRecords))}
                    disabled={filteredRecords.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button onClick={saveCurrentSearch} variant="outline" className="rounded-2xl">
                    <Star className="mr-2 h-4 w-4" />
                    Save Search
                  </Button>
                </div>

                {error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Search error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Filters and summary</CardTitle>
                <CardDescription>Refine the result set without re-running the search.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {statusOptions.map((value) => (
                          <SelectItem key={value} value={value}>{value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Permit Type</label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger><SelectValue placeholder="All permit types" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All permit types</SelectItem>
                        {typeOptions.map((value) => (
                          <SelectItem key={value} value={value}>{value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sort</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="issued_desc">Issued date: newest first</SelectItem>
                        <SelectItem value="issued_asc">Issued date: oldest first</SelectItem>
                        <SelectItem value="permit_asc">Permit number: A–Z</SelectItem>
                        <SelectItem value="permit_desc">Permit number: Z–A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button variant="outline" onClick={resetFilters} className="w-full rounded-2xl">
                      <Filter className="mr-2 h-4 w-4" />
                      Reset Filters
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="rounded-2xl border bg-white shadow-none">
                    <CardContent className="p-4">
                      <div className="text-sm text-slate-500">Matching permits</div>
                      <div className="text-2xl font-semibold">{filteredRecords.length}</div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border bg-white shadow-none">
                    <CardContent className="p-4">
                      <div className="text-sm text-slate-500">Data source used</div>
                      <div className="text-base font-medium">{sourceUsed || "—"}</div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border bg-white shadow-none">
                    <CardContent className="p-4">
                      <div className="text-sm text-slate-500">Total valuation shown</div>
                      <div className="text-2xl font-semibold">${totalValuation.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border bg-white shadow-none">
                    <CardContent className="p-4">
                      <div className="text-sm text-slate-500">Unique contractors</div>
                      <div className="text-2xl font-semibold">{contractorSummary?.uniqueContractors || 0}</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4">
                {filteredRecords.length === 0 && !loading ? (
                  <Card className="rounded-2xl shadow-sm">
                    <CardContent className="flex min-h-[120px] items-center justify-center text-sm text-slate-500">
                      No results yet. Run a search to view matching permits.
                    </CardContent>
                  </Card>
                ) : null}

                {filteredRecords.map((item, idx) => {
                  const meta = permitMeta[permitKey(item)] || { tags: "", notes: "" };
                  return (
                    <Card
                      key={`${item.permitNumber}-${idx}`}
                      className={`rounded-2xl shadow-sm transition ${selectedRecord?.permitNumber === item.permitNumber && selectedRecord?.address === item.address ? "ring-2 ring-slate-300" : ""}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold">{item.permitNumber}</h3>
                              <Badge variant="secondary">{item.status}</Badge>
                              {meta.tags ? <Badge variant="outline">{meta.tags}</Badge> : null}
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
                              <Button variant="outline" className="rounded-2xl" onClick={() => setSelectedRecord(item)}>
                                View Details
                              </Button>
                              <Button asChild variant="outline" className="rounded-2xl">
                                <a href={buildMapUrl(item.address)} target="_blank" rel="noreferrer">
                                  <MapPin className="mr-2 h-4 w-4" />
                                  Map
                                </a>
                              </Button>
                              <CopyButton value={item.permitNumber} copyState={copyState} setCopyState={setCopyState} label="Permit" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="space-y-4">
                <Card className="sticky top-6 rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Permit detail</CardTitle>
                    <CardDescription>Focused summary for the currently selected permit.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedRecord ? (
                      <>
                        <div>
                          <div className="text-lg font-semibold text-slate-900">{selectedRecord.contractor}</div>
                          <div className="mt-1 text-sm text-slate-500">{selectedRecord.permitNumber}</div>
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <StatRow
                            label="Project address"
                            value={selectedRecord.address}
                            action={<CopyButton value={selectedRecord.address} copyState={copyState} setCopyState={setCopyState} label="Address" />}
                          />
                          <StatRow label="Permit status" value={selectedRecord.status} />
                          <StatRow label="Permit type" value={selectedRecord.permitType} />
                          <StatRow label="Work class" value={selectedRecord.workClass} />
                          <StatRow label="Issued date" value={selectedRecord.issuedDateLabel} />
                          <StatRow
                            label="Permit number"
                            value={selectedRecord.permitNumber}
                            action={<CopyButton value={selectedRecord.permitNumber} copyState={copyState} setCopyState={setCopyState} label="Permit" />}
                          />
                          <StatRow label="Valuation" value={selectedRecord.valuation ? `$${Number(selectedRecord.valuation).toLocaleString()}` : "—"} />
                        </div>
                        <Separator />
                        <div className="grid gap-3">
                          <SearchChip
                            icon={<Wrench className="h-4 w-4" />}
                            title="Open selected address in maps"
                            subtitle="Useful for quick field review and area context."
                            actions={
                              <Button asChild variant="outline" className="rounded-2xl">
                                <a href={buildMapUrl(selectedRecord.address)} target="_blank" rel="noreferrer">Open Map</a>
                              </Button>
                            }
                          />
                          <SearchChip
                            icon={<UserRound className="h-4 w-4" />}
                            title="Contractor snapshot"
                            subtitle={`Top contractor in filtered results: ${contractorSummary?.topContractor || "—"} (${contractorSummary?.topCount || 0})`}
                            actions={<Badge variant="secondary">{contractorSummary?.uniqueContractors || 0} contractors</Badge>}
                          />
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <Tags className="h-4 w-4" />
                              Tags
                            </label>
                            <Input
                              value={selectedMeta.tags}
                              onChange={(e) => updateSelectedMeta({ tags: e.target.value })}
                              placeholder="ex: plumbing, priority, follow-up"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Notes</label>
                            <Textarea
                              value={selectedMeta.notes}
                              onChange={(e) => updateSelectedMeta({ notes: e.target.value })}
                              placeholder="Store your permit notes here..."
                              className="min-h-[120px]"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-500">Select a result to see its permit details.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Recent searches</CardTitle>
                    <CardDescription>Last searches run on this device.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentSearches.length ? recentSearches.map((item) => (
                      <SearchChip
                        key={item.id}
                        icon={<Clock3 className="h-4 w-4" />}
                        title={item.label}
                        subtitle={item.createdAt}
                        actions={
                          <Button variant="outline" className="rounded-2xl" onClick={() => { applySearchSnapshot(item.snapshot); runSearch(item.snapshot); }}>
                            Run Again
                          </Button>
                        }
                      />
                    )) : <div className="text-sm text-slate-500">No recent searches yet.</div>}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Saved searches</CardTitle>
                    <CardDescription>Stored search presets for repeat use.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {savedSearches.length ? savedSearches.map((item) => (
                      <SearchChip
                        key={item.id}
                        icon={<Star className="h-4 w-4" />}
                        title={item.label}
                        subtitle={item.createdAt}
                        actions={
                          <>
                            <Button variant="outline" className="rounded-2xl" onClick={() => { applySearchSnapshot(item.snapshot); runSearch(item.snapshot); }}>
                              Load
                            </Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => { removeSavedSearch(item.id); setSavedSearches(loadSavedSearches()); }}>
                              Remove
                            </Button>
                          </>
                        }
                      />
                    )) : <div className="text-sm text-slate-500">No saved searches yet.</div>}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Contractor dashboard</CardTitle>
                <CardDescription>Grouped contractor view from the current filtered permit result set.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sort contractors</label>
                    <Select value={contractorViewSort} onValueChange={setContractorViewSort}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permits_desc">Most permits</SelectItem>
                        <SelectItem value="valuation_desc">Highest valuation</SelectItem>
                        <SelectItem value="name_asc">Name A–Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end text-sm text-slate-500">
                    This dashboard updates based on the current search and filters in the Permit Lookup tab.
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {contractorDashboard.length ? contractorDashboard.map((row) => (
                    <Card key={row.contractor} className="rounded-2xl border bg-white shadow-none">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <LayoutGrid className="h-4 w-4" />
                              <div className="font-semibold text-slate-900">{row.contractor}</div>
                            </div>
                            <div className="mt-1 text-sm text-slate-500">Latest issued: {row.latestIssuedLabel}</div>
                          </div>
                          <Badge variant="secondary">{row.permitCount} permits</Badge>
                        </div>
                        <Separator />
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between gap-3"><span className="text-slate-500">Unique addresses</span><span className="font-medium">{row.uniqueAddresses}</span></div>
                          <div className="flex justify-between gap-3"><span className="text-slate-500">Total valuation</span><span className="font-medium">${row.totalValuation.toLocaleString()}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button variant="outline" className="rounded-2xl" onClick={() => setContractor(row.contractor)}>
                            Use in Search
                          </Button>
                          <CopyButton value={row.contractor} copyState={copyState} setCopyState={setCopyState} label="Copy" />
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <Card className="rounded-2xl shadow-sm">
                      <CardContent className="p-6 text-sm text-slate-500">
                        Run a permit search first to populate the contractor dashboard.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contractors" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Contractor registration</CardTitle>
                  <CardDescription>Quick access to the City’s official contractor registration information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-700">
                  <p>
                    Use this page to review registration requirements and account setup steps for contractor-related permit activity.
                  </p>
                  <Button asChild className="rounded-2xl">
                    <a href={contractorRegistrationLink} target="_blank" rel="noreferrer">
                      Open Contractor Registration
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Recommended lookup process</CardTitle>
                  <CardDescription>Designed to be practical for day-to-day permit research.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-700">
                  <div className="flex gap-3"><FileSearch className="mt-0.5 h-4 w-4 shrink-0" /><p>Search permits broadly by address or company using public data.</p></div>
                  <div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 shrink-0" /><p>Use the official AB+C Public Search page for a second check when needed.</p></div>
                  <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Reserve authenticated account access for records tied to your own authorized use.</p></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="resources" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>AB+C Public Search</CardTitle>
                  <CardDescription>Official City lookup page.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full rounded-2xl">
                    <a href={publicSearchLink} target="_blank" rel="noreferrer">
                      Open Public Search
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Open Data Portal</CardTitle>
                  <CardDescription>City datasets for broader searching.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full rounded-2xl">
                    <a href={openDataLink} target="_blank" rel="noreferrer">
                      Open Data Portal
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Contractor Registration</CardTitle>
                  <CardDescription>Registration requirements and guidance.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full rounded-2xl">
                    <a href={contractorRegistrationLink} target="_blank" rel="noreferrer">
                      Open Registration Page
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
