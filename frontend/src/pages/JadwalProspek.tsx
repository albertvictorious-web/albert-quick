import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Car, MapPin, Clock, Trash2, CheckCircle2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute, { useMe } from "@/components/ProtectedRoute";
import RekapProspekPanel from "@/components/RekapProspekPanel";
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
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import {
  JADWAL_STATUSES,
  KENDARAAN_OPTIONS,
  type Jadwal,
  type UserPublic,
} from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  Terjadwal: "border-[#BAE6FD] bg-[#E0F2FE] text-[#0369A1]",
  Selesai: "border-[#A7F3D0] bg-[#D1FAE5] text-[#065F46]",
  Dibatalkan: "border-[#FECDD3] bg-[#FFE4E6] text-[#9F1239]",
};

function errorText(err: unknown, fallback: string) {
  if (
    err instanceof ApiError &&
    typeof err.body === "object" &&
    err.body &&
    "detail" in (err.body as Record<string, unknown>)
  ) {
    return String((err.body as Record<string, unknown>).detail);
  }
  return fallback;
}

function JadwalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: me } = useMe();
  const [form, setForm] = useState({
    client_nama: "",
    lokasi: "",
    tanggal: "",
    jam: "",
    kendaraan: "",
    marketing_id: "",
  });
  const queryClient = useQueryClient();

  const { data: marketingList } = useQuery<UserPublic[]>({
    queryKey: ["assignable-marketing"],
    queryFn: () => apiGet<UserPublic[]>("/leads/assignable-marketing"),
    enabled: open && me?.role === "admin",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<Jadwal>("/jadwal", {
        client_nama: form.client_nama,
        lokasi: form.lokasi,
        tanggal: form.tanggal,
        jam: form.jam,
        kendaraan: form.kendaraan,
        marketing_id: me?.role === "admin" ? form.marketing_id : null,
      }),
    onSuccess: () => {
      toast.success("Jadwal prospek dibuat");
      queryClient.invalidateQueries({ queryKey: ["jadwal"] });
      queryClient.invalidateQueries({ queryKey: ["jadwal-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["jadwal-rekap"] });
      setForm({ client_nama: "", lokasi: "", tanggal: "", jam: "", kendaraan: "", marketing_id: "" });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorText(err, "Gagal membuat jadwal")),
  });

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const ready =
    form.client_nama &&
    form.lokasi &&
    form.tanggal &&
    form.jam &&
    form.kendaraan &&
    (me?.role !== "admin" || form.marketing_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="jadwal-dialog" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Jadwal Prospek</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label>Nama Client</Label>
            <Input
              data-testid="jadwal-input-client"
              value={form.client_nama}
              onChange={update("client_nama")}
            />
          </div>
          {me?.role === "admin" && (
            <div className="grid gap-1.5">
              <Label>Nama Marketing</Label>
              <Select
                value={form.marketing_id}
                onValueChange={(v) => setForm((f) => ({ ...f, marketing_id: v }))}
              >
                <SelectTrigger data-testid="jadwal-select-marketing">
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
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Lokasi Pertemuan</Label>
            <Input
              data-testid="jadwal-input-lokasi"
              value={form.lokasi}
              onChange={update("lokasi")}
              placeholder="mis. Cafe Kopi Kenangan, Jakarta Pusat"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tanggal</Label>
              <Input
                type="date"
                data-testid="jadwal-input-tanggal"
                value={form.tanggal}
                onChange={update("tanggal")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Jam</Label>
              <Input
                type="time"
                data-testid="jadwal-input-jam"
                value={form.jam}
                onChange={update("jam")}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Kendaraan</Label>
            <Select
              value={form.kendaraan}
              onValueChange={(v) => setForm((f) => ({ ...f, kendaraan: v }))}
            >
              <SelectTrigger data-testid="jadwal-select-kendaraan">
                <SelectValue>{(v) => (v as string) || "Pilih kendaraan"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KENDARAAN_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="jadwal-submit-button"
            disabled={!ready || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Jadwal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HasilForm({ jadwal }: { jadwal: Jadwal }) {
  const [text, setText] = useState(jadwal.hasil_pertemuan ?? "");
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () => apiPatch<Jadwal>(`/jadwal/${jadwal.id}`, { hasil_pertemuan: text }),
    onSuccess: () => {
      toast.success("Hasil pertemuan disimpan");
      queryClient.invalidateQueries({ queryKey: ["jadwal"] });
      queryClient.invalidateQueries({ queryKey: ["jadwal-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["jadwal-rekap"] });
    },
    onError: (err) => toast.error(errorText(err, "Gagal menyimpan hasil pertemuan")),
  });

  return (
    <div className="mt-3 border-t border-[#F1F5F9] pt-3">
      <Label className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
        Hasil Pertemuan
      </Label>
      <Textarea
        data-testid={`jadwal-hasil-input-${jadwal.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Tulis hasil pertemuan setelah prospek..."
        className="mt-1.5"
      />
      <Button
        variant="outline"
        data-testid={`jadwal-hasil-save-button-${jadwal.id}`}
        disabled={!text || saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
        className="mt-2"
      >
        <CheckCircle2 className="h-4 w-4" />
        Simpan Hasil
      </Button>
    </div>
  );
}

function JadwalContent() {
  const { data: me } = useMe();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Jadwal[]>({
    queryKey: ["jadwal", statusFilter],
    queryFn: () =>
      apiGet<Jadwal[]>(statusFilter === "all" ? "/jadwal" : `/jadwal?status=${statusFilter}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/jadwal/${id}`),
    onSuccess: () => {
      toast.success("Jadwal dihapus");
      queryClient.invalidateQueries({ queryKey: ["jadwal"] });
      queryClient.invalidateQueries({ queryKey: ["jadwal-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["jadwal-rekap"] });
    },
    onError: () => toast.error("Gagal menghapus jadwal"),
  });

  const rows = error ? [] : (data ?? []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Jadwal Prospek</h1>
          <p className="mt-1 text-sm text-[#475569]">
            {me?.role === "admin"
              ? "Seluruh jadwal prospek tim marketing beserta hasil pertemuannya."
              : "Jadwal prospek Anda — isi hasil pertemuan setelah bertemu client."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="jadwal-filter-status" className="w-[160px]">
              <SelectValue>{(v) => (v === "all" ? "Semua Status" : (v as string))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {JADWAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button data-testid="open-jadwal-dialog-button" onClick={() => setDialogOpen(true)}>
            <CalendarPlus className="h-4 w-4" />
            Buat Jadwal
          </Button>
        </div>
      </div>

      <RekapProspekPanel />

      {error && (
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFE4E6] p-4 text-sm text-[#9F1239]">
          Gagal memuat jadwal prospek.
        </div>
      )}
      {isLoading && <p className="text-sm text-[#94A3B8]">Memuat jadwal...</p>}      {!isLoading && rows.length === 0 && (
        <div
          data-testid="jadwal-empty-state"
          className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center"
        >
          <CalendarPlus className="mx-auto mb-2 h-6 w-6 text-[#CBD5E1]" />
          <p className="text-sm text-[#94A3B8]">Belum ada jadwal prospek.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((j) => (
          <div
            key={j.id}
            data-testid={`jadwal-card-${j.id}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-heading text-sm font-semibold text-[#0F172A]">{j.client_nama}</p>
                <p className="text-[11px] text-[#94A3B8]">Marketing: {j.marketing_name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    STATUS_STYLE[j.status] ?? "border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]"
                  }`}
                >
                  {j.status}
                </span>
                <button
                  type="button"
                  data-testid={`jadwal-delete-button-${j.id}`}
                  onClick={() => deleteMutation.mutate(j.id)}
                  className="rounded-lg p-1.5 text-[#94A3B8] transition-colors duration-200 hover:bg-[#FFE4E6] hover:text-[#BE123C]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#475569]">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#0F766E]" />
                {j.tanggal} · {j.jam}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#0F766E]" />
                {j.lokasi}
              </span>
              <span className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-[#0F766E]" />
                {j.kendaraan}
              </span>
            </div>

            {j.hasil_pertemuan && (
              <p
                data-testid={`jadwal-hasil-text-${j.id}`}
                className="mt-3 rounded-lg bg-[#F8FAFC] p-3 text-sm text-[#475569]"
              >
                {j.hasil_pertemuan}
              </p>
            )}

            {(me?.role === "admin" || j.marketing_id === me?.id) && <HasilForm jadwal={j} />}
          </div>
        ))}
      </div>

      <JadwalDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export default function JadwalProspek() {
  return (
    <ProtectedRoute>
      <AppShell>
        <JadwalContent />
      </AppShell>
    </ProtectedRoute>
  );
}
