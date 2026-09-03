import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NotebookPen, Plus, Trash2, Link2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute, { useMe } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";
import type { Catatan, Lead } from "@/lib/types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CatatanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [leadId, setLeadId] = useState("");
  const queryClient = useQueryClient();

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => apiGet<Lead[]>("/leads"),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<Catatan>("/catatan", { title, body, lead_id: leadId || null }),
    onSuccess: () => {
      toast.success("Catatan disimpan");
      queryClient.invalidateQueries({ queryKey: ["catatan"] });
      setTitle("");
      setBody("");
      setLeadId("");
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError &&
          typeof err.body === "object" &&
          err.body &&
          "detail" in (err.body as Record<string, unknown>)
          ? String((err.body as Record<string, unknown>).detail)
          : "Gagal menyimpan catatan"
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="catatan-dialog" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Catatan Baru</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label>Judul Catatan</Label>
            <Input
              data-testid="catatan-input-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Rencana follow up minggu ini"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Isi Catatan</Label>
            <Textarea
              data-testid="catatan-input-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Kaitkan ke Leads (opsional)</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger data-testid="catatan-select-lead">
                <SelectValue>
                  {(v) =>
                    leads?.find((l) => l.id === v)?.nama || "Tanpa kaitan leads"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(leads ?? []).slice(0, 100).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nama} ({l.type === "nasabah" ? "Nasabah" : "Pelamar"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="catatan-submit-button"
            disabled={!title || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Catatan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatatanContent() {
  const { data: me } = useMe();
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Catatan[]>({
    queryKey: ["catatan"],
    queryFn: () => apiGet<Catatan[]>("/catatan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/catatan/${id}`),
    onSuccess: () => {
      toast.success("Catatan dihapus");
      queryClient.invalidateQueries({ queryKey: ["catatan"] });
    },
    onError: () => toast.error("Gagal menghapus catatan"),
  });

  const rows = error ? [] : (data ?? []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Catatan</h1>
          <p className="mt-1 text-sm text-[#475569]">
            {me?.role === "admin"
              ? "Semua catatan kerja tim marketing (hanya bisa dilihat, tidak diubah)."
              : "Catatan pribadi Anda untuk database client maupun pelamar kerja."}
          </p>
        </div>
        <Button data-testid="open-catatan-dialog-button" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Buat Catatan
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFE4E6] p-4 text-sm text-[#9F1239]">
          Gagal memuat catatan.
        </div>
      )}

      {isLoading && <p className="text-sm text-[#94A3B8]">Memuat catatan...</p>}

      {!isLoading && rows.length === 0 && (
        <div
          data-testid="catatan-empty-state"
          className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center"
        >
          <NotebookPen className="mx-auto mb-2 h-6 w-6 text-[#CBD5E1]" />
          <p className="text-sm text-[#94A3B8]">Belum ada catatan.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((note) => (
          <div
            key={note.id}
            data-testid={`catatan-card-${note.id}`}
            className="flex flex-col rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-heading text-sm font-semibold text-[#0F172A]">{note.title}</p>
              {note.user_id === me?.id && (
                <button
                  type="button"
                  data-testid={`catatan-delete-button-${note.id}`}
                  onClick={() => deleteMutation.mutate(note.id)}
                  className="rounded-lg p-1.5 text-[#94A3B8] transition-colors duration-200 hover:bg-[#FFE4E6] hover:text-[#BE123C]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-2 flex-1 whitespace-pre-wrap text-sm text-[#475569]">{note.body}</p>
            {note.lead_nama && (
              <span className="mt-3 flex w-fit items-center gap-1.5 rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-medium text-[#0369A1]">
                <Link2 className="h-3 w-3" />
                {note.lead_nama}
              </span>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2 text-[11px] text-[#94A3B8]">
              <span>{note.user_name}</span>
              <span>{formatDateTime(note.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      <CatatanDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export default function CatatanPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <CatatanContent />
      </AppShell>
    </ProtectedRoute>
  );
}
