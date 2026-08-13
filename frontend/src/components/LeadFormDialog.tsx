import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  PRODUK_OPTIONS,
  SUMBER_NASABAH_OPTIONS,
  POSISI_OPTIONS,
  SUMBER_PELAMAR_OPTIONS,
  type Lead,
  type LeadType,
  type UserPublic,
} from "@/lib/types";
import { useMe } from "@/components/ProtectedRoute";

const EMPTY_FORM = {
  nama: "",
  no_hp: "",
  email: "",
  alamat: "",
  produk: "",
  posisi: "",
  nik: "",
  tanggal_lahir: "",
  sumber: "",
  catatan: "",
  tanggal_follow_up: "",
  assigned_to: "",
};

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
        no_hp: form.no_hp,
        email: form.email || null,
        alamat: type === "nasabah" ? form.alamat || null : null,
        produk: type === "nasabah" ? form.produk || null : null,
        posisi: type === "pelamar" ? form.posisi || null : null,
        nik: type === "pelamar" ? form.nik || null : null,
        tanggal_lahir: type === "pelamar" ? form.tanggal_lahir || null : null,
        sumber: form.sumber,
        status: "Baru",
        catatan: form.catatan || null,
        tanggal_follow_up: form.tanggal_follow_up || null,
        assigned_to: form.assigned_to || null,
      }),
    onSuccess: () => {
      toast.success("Leads baru berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      setForm({ ...EMPTY_FORM });
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? String(err.body) : "Gagal menambahkan leads";
      toast.error(msg);
    },
  });

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const sumberOptions = type === "nasabah" ? SUMBER_NASABAH_OPTIONS : SUMBER_PELAMAR_OPTIONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-testid="lead-form-dialog">
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
            <Input id="nama" data-testid="lead-form-input-nama" value={form.nama} onChange={update("nama")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="no_hp">No. WhatsApp / HP</Label>
              <Input id="no_hp" data-testid="lead-form-input-no-hp" value={form.no_hp} onChange={update("no_hp")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" data-testid="lead-form-input-email" value={form.email} onChange={update("email")} />
            </div>
          </div>

          {type === "nasabah" ? (
            <>
              <div className="grid gap-1.5">
                <Label>Alamat Lengkap</Label>
                <Textarea data-testid="lead-form-input-alamat" value={form.alamat} onChange={update("alamat")} />
              </div>
              <div className="grid gap-1.5">
                <Label>Produk / Kebutuhan</Label>
                <Select value={form.produk} onValueChange={(v) => setForm((f) => ({ ...f, produk: v }))}>
                  <SelectTrigger data-testid="lead-form-select-produk">
                    <SelectValue>{(v) => (v as string) || "Pilih produk"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUK_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label>Posisi Dilamar</Label>
                <Select value={form.posisi} onValueChange={(v) => setForm((f) => ({ ...f, posisi: v }))}>
                  <SelectTrigger data-testid="lead-form-select-posisi">
                    <SelectValue>{(v) => (v as string) || "Pilih posisi"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {POSISI_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>NIK (16 Digit)</Label>
                  <Input data-testid="lead-form-input-nik" value={form.nik} onChange={update("nik")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Tanggal Lahir</Label>
                  <Input type="date" data-testid="lead-form-input-tanggal-lahir" value={form.tanggal_lahir} onChange={update("tanggal_lahir")} />
                </div>
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <Label>Sumber Leads</Label>
            <Select value={form.sumber} onValueChange={(v) => setForm((f) => ({ ...f, sumber: v }))}>
              <SelectTrigger data-testid="lead-form-select-sumber">
                <SelectValue>{(v) => (v as string) || "Pilih sumber"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sumberOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    {(v) =>
                      marketingList?.find((m) => m.id === v)?.name || "Belum ditugaskan"
                    }
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
            <Textarea data-testid="lead-form-input-catatan" value={form.catatan} onChange={update("catatan")} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="lead-form-submit-button"
            disabled={!form.nama || !form.no_hp || !form.sumber || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Leads"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
