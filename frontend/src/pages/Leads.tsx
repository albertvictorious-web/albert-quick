import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import ProtectedRoute, { useMe } from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import LeadFormDialog from "@/components/LeadFormDialog";
import LeadDetailSheet from "@/components/LeadDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import {
  NASABAH_STATUSES,
  PELAMAR_STATUSES,
  type BulkAssignResult,
  type Lead,
  type LeadType,
  type UserPublic,
} from "@/lib/types";

function LeadsContent() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const [type, setType] = useState<LeadType>("nasabah");
  const [status, setStatus] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const queryClient = useQueryClient();

  const { data: marketingList } = useQuery<UserPublic[]>({
    queryKey: ["assignable-marketing"],
    queryFn: () => apiGet<UserPublic[]>("/leads/assignable-marketing"),
    enabled: isAdmin,
  });

  const { data: leads, isLoading, error } = useQuery<Lead[]>({
    queryKey: ["leads", type, status, assignedTo, search],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("type", type);
      if (status !== "all") params.set("status", status);
      if (assignedTo !== "all" && isAdmin) params.set("assigned_to", assignedTo);
      if (search) params.set("search", search);
      return apiGet<Lead[]>(`/leads?${params.toString()}`);
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: () =>
      apiPost<BulkAssignResult>("/leads/bulk-assign", {
        lead_ids: selectedIds,
        assigned_to: bulkAssignTo,
      }),
    onSuccess: (result) => {
      toast.success(`${result.updated} leads ditugaskan ke ${result.assigned_to_name}`);
      setSelectedIds([]);
      setBulkAssignTo("");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
    },
    onError: (err) => {
      const detail =
        err instanceof ApiError &&
        typeof err.body === "object" &&
        err.body &&
        "detail" in (err.body as Record<string, unknown>)
          ? String((err.body as Record<string, unknown>).detail)
          : "Gagal menugaskan leads";
      toast.error(detail);
    },
  });

  const statusOptions = type === "nasabah" ? NASABAH_STATUSES : PELAMAR_STATUSES;
  const today = new Date().toISOString().slice(0, 10);
  const rows = leads ?? [];
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const resetSelection = () => setSelectedIds([]);

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () => setSelectedIds(allSelected ? [] : rows.map((r) => r.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Data Leads</h1>
          <p className="mt-1 text-sm text-[#475569]">
            {isAdmin
              ? "Kelola seluruh leads nasabah dan pelamar kerja tim marketing."
              : "Leads yang sedang Anda kelola. Marketing lain tidak dapat melihat data ini."}
          </p>
        </div>
        <Button data-testid="open-add-lead-dialog-button" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Tambah Leads
        </Button>
      </div>

      <Tabs
        value={type}
        onValueChange={(v) => {
          setType(v as LeadType);
          setStatus("all");
          resetSelection();
        }}
      >
        <TabsList>
          <TabsTrigger value="nasabah" data-testid="leads-tab-nasabah">
            Nasabah
          </TabsTrigger>
          <TabsTrigger value="pelamar" data-testid="leads-tab-pelamar">
            Pelamar Kerja
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            data-testid="leads-search-input"
            placeholder="Cari nama, no. HP, atau email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetSelection();
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            resetSelection();
          }}
        >
          <SelectTrigger data-testid="leads-filter-status" className="w-[170px]">
            <SelectValue>{(v) => (v === "all" ? "Semua Status" : (v as string))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select
            value={assignedTo}
            onValueChange={(v) => {
              setAssignedTo(v);
              resetSelection();
            }}
          >
            <SelectTrigger data-testid="leads-filter-marketing" className="w-[190px]">
              <SelectValue>
                {(v) =>
                  v === "all"
                    ? "Semua Marketing"
                    : v === "unassigned"
                      ? "Belum Ditugaskan"
                      : marketingList?.find((m) => m.id === v)?.name
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Marketing</SelectItem>
              <SelectItem value="unassigned">Belum Ditugaskan</SelectItem>
              {marketingList?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isAdmin && selectedIds.length > 0 && (
        <div
          data-testid="bulk-assign-toolbar"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0F766E]/30 bg-[#F0FDFA] p-4"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#0F766E]">
            <Users className="h-4 w-4" />
            <span data-testid="bulk-assign-selected-count">{selectedIds.length}</span> leads dipilih
          </span>
          <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
            <SelectTrigger data-testid="bulk-assign-select" className="w-[200px] bg-white">
              <SelectValue>
                {(v) => marketingList?.find((m) => m.id === v)?.name || "Pilih marketing"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {marketingList?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            data-testid="bulk-assign-submit-button"
            disabled={!bulkAssignTo || bulkAssignMutation.isPending}
            onClick={() => bulkAssignMutation.mutate()}
          >
            {bulkAssignMutation.isPending ? "Menugaskan..." : "Tugaskan Sekarang"}
          </Button>
          <Button variant="ghost" data-testid="bulk-assign-clear-button" onClick={resetSelection}>
            Batalkan Pilihan
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFE4E6] p-4 text-sm text-[#9F1239]">
          Gagal memuat data leads.
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-10">
                  <Checkbox
                    data-testid="bulk-select-all-checkbox"
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Pilih semua leads"
                  />
                </TableHead>
              )}
              <TableHead>Nama</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>{type === "nasabah" ? "Produk" : "Posisi"}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Follow Up</TableHead>
              <TableHead>Marketing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-sm text-[#94A3B8]">
                  Memuat data...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-sm text-[#94A3B8]">
                  Belum ada leads yang cocok dengan filter.
                </TableCell>
              </TableRow>
            )}
            {rows.map((lead) => {
              const overdue = !!lead.tanggal_follow_up && lead.tanggal_follow_up <= today;
              const selected = selectedIds.includes(lead.id);
              return (
                <TableRow
                  key={lead.id}
                  data-testid={`lead-row-${lead.id}`}
                  onClick={() => setActiveLeadId(lead.id)}
                  className={`cursor-pointer transition-colors duration-200 hover:bg-slate-50/80 ${
                    selected ? "bg-[#F0FDFA]" : ""
                  }`}
                >
                  {isAdmin && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        data-testid={`bulk-select-checkbox-${lead.id}`}
                        checked={selected}
                        onCheckedChange={() => toggleOne(lead.id)}
                        aria-label={`Pilih ${lead.nama}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium text-[#0F172A]">{lead.nama}</TableCell>
                  <TableCell className="text-[#475569]">{lead.no_hp}</TableCell>
                  <TableCell className="text-[#475569]">
                    {type === "nasabah" ? lead.produk : lead.posisi}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>
                    {lead.tanggal_follow_up ? (
                      <span className={overdue ? "font-medium text-[#B45309]" : "text-[#475569]"}>
                        {lead.tanggal_follow_up}
                      </span>
                    ) : (
                      <span className="text-[#CBD5E1]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[#475569]">
                    {lead.assigned_to_name ?? "Belum ditugaskan"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} defaultType={type} />
      <LeadDetailSheet leadId={activeLeadId} onOpenChange={(open) => !open && setActiveLeadId(null)} />
    </div>
  );
}

export default function Leads() {
  return (
    <ProtectedRoute>
      <AppShell>
        <LeadsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
