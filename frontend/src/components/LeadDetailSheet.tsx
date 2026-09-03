import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  NASABAH_STATUSES,
  PELAMAR_STATUSES,
  type Lead,
  type UserPublic,
} from "@/lib/types";
import { useMe } from "@/components/ProtectedRoute";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-[#94A3B8]">{label}</span>
      <span className="text-sm text-[#0F172A]">{value}</span>
    </div>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeadDetailSheet({
  leadId,
  onOpenChange,
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: me } = useMe();
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [newFollowUp, setNewFollowUp] = useState("");
  const queryClient = useQueryClient();

  const { data: lead } = useQuery<Lead>({
    queryKey: ["lead", leadId],
    queryFn: () => apiGet<Lead>(`/leads/${leadId}`),
    enabled: !!leadId,
  });

  const { data: marketingList } = useQuery<UserPublic[]>({
    queryKey: ["assignable-marketing"],
    queryFn: () => apiGet<UserPublic[]>("/leads/assignable-marketing"),
    enabled: !!leadId,
  });

  const addNoteMutation = useMutation({
    mutationFn: () =>
      apiPost<Lead>(`/leads/${leadId}/notes`, {
        text: noteText,
        status: noteStatus || null,
      }),
    onSuccess: () => {
      toast.success("Catatan progres ditambahkan");
      setNoteText("");
      setNoteStatus("");
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sumber-stats"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
    },
    onError: () => toast.error("Gagal menambahkan catatan"),
  });

  const assignMutation = useMutation({
    mutationFn: () => apiPost<Lead>(`/leads/${leadId}/assign`, { assigned_to: assignTo }),
    onSuccess: () => {
      toast.success("Leads berhasil dipindahkan");
      setAssignTo("");
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sumber-stats"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
    },
    onError: () => toast.error("Gagal memindahkan leads"),
  });

  const rescheduleMutation = useMutation({    mutationFn: () =>
      apiPatch<Lead>(`/leads/${leadId}`, { tanggal_follow_up: newFollowUp }),
    onSuccess: () => {
      toast.success("Jadwal follow up diperbarui");
      setNewFollowUp("");
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sumber-stats"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
    },
    onError: () => toast.error("Gagal memperbarui jadwal follow up"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/leads/${leadId}`),
    onSuccess: () => {
      toast.success("Leads dihapus");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sumber-stats"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Gagal menghapus leads — Anda mungkin tidak punya izin"),
  });

  if (!lead) return null;

  const statusOptions = lead.type === "nasabah" ? NASABAH_STATUSES : PELAMAR_STATUSES;
  const otherMarketing = marketingList?.filter((m) => m.id !== lead.assigned_to) ?? [];
  // Admin may delete anything; marketing only the leads they entered themselves.
  const canDelete =
    me?.role === "admin" || (lead.created_by === me?.id && lead.assigned_to === me?.id);

  return (
    <Sheet open={!!leadId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[600px]" data-testid="lead-detail-sheet">
        <SheetHeader>
          <SheetTitle data-testid="lead-detail-title">{lead.nama}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
              {lead.type === "nasabah" ? "Nasabah" : "Pelamar Kerja"}
            </span>
            {canDelete && (
              <Button
                variant="ghost"
                data-testid="lead-delete-button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Hapus leads "${lead.nama}"? Tindakan ini permanen.`)) {
                    deleteMutation.mutate();
                  }
                }}
                className="ml-auto text-[#BE123C] hover:bg-[#FFE4E6] hover:text-[#9F1239]"
              >
                <Trash2 className="h-4 w-4" />
                Hapus Leads
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
            <InfoRow label="No. WhatsApp" value={lead.no_wa} />
            <InfoRow label="Usia" value={lead.usia ? `${lead.usia} tahun` : null} />
            <InfoRow label="Kota Domisili" value={lead.kota} />
            <InfoRow label="Profesi / Pekerjaan" value={lead.profesi} />
            <InfoRow label="Pernah Trading" value={lead.pernah_trading} />
            <InfoRow label="Sumber (Tahu QuickPro)" value={lead.sumber} />
            <InfoRow label="Pendidikan Terakhir" value={lead.pendidikan} />
            <InfoRow label="Follow Up" value={lead.tanggal_follow_up} />
            <InfoRow label="Ditugaskan ke" value={lead.assigned_to_name ?? "Belum ditugaskan"} />
            <InfoRow label="Ditambahkan oleh" value={lead.created_by_name} />
            {lead.cv_file_id && (
              <div className="col-span-2 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
                  CV Pelamar
                </span>
                <a
                  href={`/api/files/${lead.cv_file_id}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="lead-cv-link"
                  className="flex w-fit items-center gap-2 rounded-lg border border-[#BAE6FD] bg-[#E0F2FE] px-3 py-1.5 text-sm font-medium text-[#0369A1] transition-colors duration-200 hover:bg-[#BAE6FD]"
                >
                  <FileText className="h-4 w-4" />
                  {lead.cv_filename ?? "Lihat CV"}
                </a>
              </div>
            )}
            {lead.catatan && (
              <div className="col-span-2">
                <InfoRow label="Catatan Awal" value={lead.catatan} />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="mb-3 font-heading text-sm font-semibold text-[#0F172A]">
              Tambah Catatan Progres
            </p>
            <Textarea
              data-testid="lead-note-input"
              placeholder="Tulis catatan progres di sini..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-2">
              <Select value={noteStatus} onValueChange={setNoteStatus}>
                <SelectTrigger data-testid="lead-note-status-select" className="w-[180px]">
                  <SelectValue>{(v) => (v as string) || "Ubah status (opsional)"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                data-testid="lead-note-submit-button"
                disabled={!noteText || addNoteMutation.isPending}
                onClick={() => addNoteMutation.mutate()}
              >
                {addNoteMutation.isPending ? "Menyimpan..." : "Tambah Catatan"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="mb-3 font-heading text-sm font-semibold text-[#0F172A]">
              Jadwalkan Ulang Follow Up
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                data-testid="lead-reschedule-input"
                value={newFollowUp}
                onChange={(e) => setNewFollowUp(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                data-testid="lead-reschedule-submit-button"
                disabled={!newFollowUp || rescheduleMutation.isPending}
                onClick={() => rescheduleMutation.mutate()}
              >
                Simpan Jadwal
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-[#94A3B8]">
              Notifikasi follow up akan muncul otomatis saat tanggal ini tiba.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="mb-3 font-heading text-sm font-semibold text-[#0F172A]">
              {me?.role === "admin" ? "Tugaskan / Pindahkan Marketing" : "Serahkan ke Marketing Lain"}
            </p>
            <div className="flex items-center gap-2">
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger data-testid="lead-assign-select" className="flex-1">
                  <SelectValue>
                    {(v) => otherMarketing.find((m) => m.id === v)?.name || "Pilih marketing"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherMarketing.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                data-testid="lead-assign-submit-button"
                disabled={!assignTo || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                Pindahkan
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-3 font-heading text-sm font-semibold text-[#0F172A]">
              Riwayat Progres
            </p>
            <div className="flex flex-col gap-4 border-l border-[#E2E8F0] pl-4" data-testid="lead-notes-timeline">
              {lead.notes.length === 0 && (
                <p className="text-sm text-[#94A3B8]">Belum ada catatan progres.</p>
              )}
              {[...lead.notes].reverse().map((note) => (
                <div key={note.id} className="relative" data-testid={`lead-note-item-${note.id}`}>
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#0F766E]" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#0F172A]">
                      {note.created_by_name}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      {formatDateTime(note.created_at)}
                    </span>
                    {note.status && <StatusBadge status={note.status} />}
                  </div>
                  <p className="mt-1 text-sm text-[#475569]">{note.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
