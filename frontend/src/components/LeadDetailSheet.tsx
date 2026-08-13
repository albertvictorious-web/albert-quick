import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { apiGet, apiPost } from "@/lib/api";
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
    },
    onError: () => toast.error("Gagal memindahkan leads"),
  });

  if (!lead) return null;

  const statusOptions = lead.type === "nasabah" ? NASABAH_STATUSES : PELAMAR_STATUSES;
  const otherMarketing = marketingList?.filter((m) => m.id !== lead.assigned_to) ?? [];

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
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
            <InfoRow label="No. HP" value={lead.no_hp} />
            <InfoRow label="Email" value={lead.email} />
            <InfoRow label="Alamat" value={lead.alamat} />
            <InfoRow label="Produk" value={lead.produk} />
            <InfoRow label="Posisi" value={lead.posisi} />
            <InfoRow label="NIK" value={lead.nik} />
            <InfoRow label="Tanggal Lahir" value={lead.tanggal_lahir} />
            <InfoRow label="Sumber Leads" value={lead.sumber} />
            <InfoRow label="Follow Up" value={lead.tanggal_follow_up} />
            <InfoRow label="Ditugaskan ke" value={lead.assigned_to_name ?? "Belum ditugaskan"} />
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
