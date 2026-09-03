import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Loader2, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import {
  SUMBER_OPTIONS,
  PENDIDIKAN_OPTIONS,
  TRADING_OPTIONS,
  type Lead,
  type LeadType,
  type UploadedFile,
  type UserPublic,
} from "@/lib/types";
import { useMe } from "@/components/ProtectedRoute";

const EMPTY_FORM = {
  nama: "",
  no_wa: "",
  usia: "",
  kota: "",
  profesi: "",
  pernah_trading: "",
  sumber: "",
  pendidikan: "",
  catatan: "",
  tanggal_follow_up: "",
  assigned_to: "",
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

export default function LeadFormDialog({
  open,
  onOpenChange,
  defaultType = "nasabah",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: LeadType;
}) {
  const { data: me } = useMe();
  const [type, setType] = useState<LeadType>(defaultType);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [cv, setCv] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: marketingList } = useQuery<UserPublic[]>({
    queryKey: ["assignable-marketing"],
    queryFn: () => apiGet<UserPublic[]>("/leads/assignable-marketing"),
    enabled: open && me?.role === "admin",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<Lead>("/leads", {
        type,
        nama: form.nama,
        no_wa: form.no_wa,
        usia: form.usia ? Number(form.usia) : null,
        kota: form.kota || null,
        profesi: type === "nasabah" ? form.profesi || null : null,
        pernah_trading: type === "nasabah" ? form.pernah_trading || null : null,
        sumber: type === "nasabah" ? form.sumber || null : null,
        pendidikan: type === "pelamar" ? form.pendidikan || null : null,
        cv_file_id: type === "pelamar" ? cv?.file_id ?? null : null,
        cv_filename: type === "pelamar" ? cv?.filename ?? null : null,
        status: "Baru",
        catatan: form.catatan || null,
        tanggal_follow_up: form.tanggal_follow_up || null,
        assigned_to: form.assigned_to || null,
      }),
    onSuccess: () => {
      toast.success("Leads baru berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
      setForm({ ...EMPTY_FORM });
      setCv(null);
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorText(err, "Gagal menambahkan leads")),
  });

  const handleCvChange = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      // FormData must not carry a JSON content-type, so this one call goes direct.
      const res = await fetch("/api/files/cv", { method: "POST", body, credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ detail: "Gagal mengunggah CV" }));
        throw new Error(payload.detail ?? "Gagal mengunggah CV");
      }
      const uploaded = (await res.json()) as UploadedFile;
      setCv(uploaded);
      toast.success(`CV terunggah: ${uploaded.filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah CV");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSubmit =
    !!form.nama &&
    !!form.no_wa &&
    (type === "pelamar" || !!form.sumber) &&
    !createMutation.isPending &&
    !uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        data-testid="lead-form-dialog"
      >
        <DialogHeader>
          <DialogTitle>Tambah Leads Baru</DialogTitle>
        </DialogHeader>

        <Tabs value={type} onValueChange={(v) => setType(v as LeadType)}>
          <TabsList>
            <TabsTrigger value="nasabah" data-testid="lead-form-tab-nasabah">
              Nasabah
            </TabsTrigger>
            <TabsTrigger value="pelamar" data-testid="lead-form-tab-pelamar">
              Pelamar Kerja
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nama">Nama Lengkap</Label>
            <Input
              id="nama"
              data-testid="lead-form-input-nama"
              value={form.nama}
              onChange={update("nama")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="no_wa">No. WhatsApp</Label>
              <Input
                id="no_wa"
                data-testid="lead-form-input-no-wa"
                value={form.no_wa}
                onChange={update("no_wa")}
                placeholder="0812xxxxxxx"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="usia">Usia</Label>
              <Input
                id="usia"
                type="number"
                min={0}
                data-testid="lead-form-input-usia"
                value={form.usia}
                onChange={update("usia")}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kota">Kota Domisili</Label>
            <Input
              id="kota"
              data-testid="lead-form-input-kota"
              value={form.kota}
              onChange={update("kota")}
            />
          </div>

          {type === "nasabah" ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="profesi">Profesi / Pekerjaan</Label>
                <Input
                  id="profesi"
                  data-testid="lead-form-input-profesi"
                  value={form.profesi}
                  onChange={update("profesi")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Apakah Sudah Pernah Trading?</Label>
                <Select
                  value={form.pernah_trading}
                  onValueChange={(v) => setForm((f) => ({ ...f, pernah_trading: v }))}
                >
                  <SelectTrigger data-testid="lead-form-select-trading">
                    <SelectValue>{(v) => (v as string) || "Pilih jawaban"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TRADING_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Dari Mana Mengetahui QuickPro?</Label>
                <Select
                  value={form.sumber}
                  onValueChange={(v) => setForm((f) => ({ ...f, sumber: v }))}
                >
                  <SelectTrigger data-testid="lead-form-select-sumber">
                    <SelectValue>{(v) => (v as string) || "Pilih sumber"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SUMBER_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label>Pendidikan Terakhir</Label>
                <Select
                  value={form.pendidikan}
                  onValueChange={(v) => setForm((f) => ({ ...f, pendidikan: v }))}
                >
                  <SelectTrigger data-testid="lead-form-select-pendidikan">
                    <SelectValue>{(v) => (v as string) || "Pilih pendidikan"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PENDIDIKAN_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Upload CV (PDF, maks 5 MB)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  data-testid="lead-form-cv-input"
                  onChange={(e) => handleCvChange(e.target.files?.[0])}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="lead-form-cv-button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    {uploading ? "Mengunggah..." : "Pilih File CV"}
                  </Button>
                  {cv && (
                    <span
                      data-testid="lead-form-cv-filename"
                      className="flex items-center gap-1.5 text-xs text-[#0F766E]"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {cv.filename}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <Label>Tanggal Follow Up</Label>
            <Input
              type="date"
              data-testid="lead-form-input-follow-up"
              value={form.tanggal_follow_up}
              onChange={update("tanggal_follow_up")}
            />
          </div>

          {me?.role === "admin" && (
            <div className="grid gap-1.5">
              <Label>Tugaskan ke Marketing</Label>
              <Select
                value={form.assigned_to}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
              >
                <SelectTrigger data-testid="lead-form-select-assign">
                  <SelectValue>
                    {(v) => marketingList?.find((m) => m.id === v)?.name || "Belum ditugaskan"}
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
            <Label>Catatan Awal</Label>
            <Textarea
              data-testid="lead-form-input-catatan"
              value={form.catatan}
              onChange={update("catatan")}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="lead-form-submit-button"
            disabled={!canSubmit}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Leads"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
