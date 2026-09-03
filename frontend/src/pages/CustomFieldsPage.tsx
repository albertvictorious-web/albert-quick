import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Columns3, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import type { CustomField } from "@/lib/types";

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

function CustomFieldsContent() {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const queryClient = useQueryClient();

  const { data: fields, isLoading } = useQuery<CustomField[]>({
    queryKey: ["custom-fields"],
    queryFn: () => apiGet<CustomField[]>("/custom-fields"),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["lead"] });
  };

  const createField = useMutation({
    mutationFn: () => apiPost<CustomField>("/custom-fields", { label: newLabel.trim() }),
    onSuccess: (field) => {
      toast.success(`Kolom "${field.label}" ditambahkan`);
      setNewLabel("");
      refresh();
    },
    onError: (err) => toast.error(errorText(err, "Gagal menambahkan kolom")),
  });

  const renameField = useMutation({
    mutationFn: (id: string) =>
      apiPatch<CustomField>(`/custom-fields/${id}`, { label: editLabel.trim() }),
    onSuccess: (field) => {
      toast.success(`Kolom diganti menjadi "${field.label}"`);
      setEditingId(null);
      setEditLabel("");
      refresh();
    },
    onError: (err) => toast.error(errorText(err, "Gagal mengganti nama kolom")),
  });

  const removeField = useMutation({
    mutationFn: (id: string) => apiDelete(`/custom-fields/${id}`),
    onSuccess: () => {
      toast.success("Kolom dihapus dari semua leads");
      refresh();
    },
    onError: (err) => toast.error(errorText(err, "Gagal menghapus kolom")),
  });

  const rows = fields ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Kolom Custom</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#475569]">
          Kolom tambahan agar aplikasi mengikuti bentuk file Anda. Kolom di sini muncul di form
          Tambah Leads, di detail leads, dan ikut terbawa saat Export CSV. Kolom juga terbuat
          otomatis saat Anda memilihnya di layar pemetaan waktu upload file.
        </p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <p className="font-heading text-sm font-semibold text-[#0F172A]">Tambah Kolom Baru</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="grid flex-1 gap-1.5" style={{ minWidth: 240 }}>
            <Label htmlFor="new-custom-field">Nama Kolom</Label>
            <Input
              id="new-custom-field"
              data-testid="custom-field-new-input"
              value={newLabel}
              placeholder="mis. Alamat Lengkap, Kode Referensi, Nama Perusahaan"
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabel.trim()) createField.mutate();
              }}
            />
          </div>
          <Button
            data-testid="custom-field-add-button"
            disabled={!newLabel.trim() || createField.isPending}
            onClick={() => createField.mutate()}
          >
            {createField.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Tambah Kolom
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <p className="border-b border-[#F1F5F9] px-5 py-3 font-heading text-sm font-semibold text-[#0F172A]">
          Kolom Tersimpan ({rows.length})
        </p>

        {isLoading && <p className="px-5 py-6 text-sm text-[#94A3B8]">Memuat kolom...</p>}

        {!isLoading && rows.length === 0 && (
          <div
            data-testid="custom-fields-empty"
            className="flex flex-col items-center gap-2 px-5 py-10 text-center"
          >
            <Columns3 className="h-8 w-8 text-[#CBD5E1]" />
            <p className="text-sm text-[#94A3B8]">
              Belum ada kolom custom. Tambahkan di atas, atau buat otomatis saat upload file Excel.
            </p>
          </div>
        )}

        <div className="divide-y divide-[#F1F5F9]">
          {rows.map((field) => (
            <div
              key={field.id}
              data-testid={`custom-field-row-${field.key}`}
              className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-[#F8FAFC]"
            >
              {editingId === field.id ? (
                <>
                  <Input
                    data-testid={`custom-field-edit-input-${field.key}`}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="max-w-xs flex-1"
                  />
                  <Button
                    data-testid={`custom-field-save-button-${field.key}`}
                    disabled={!editLabel.trim() || renameField.isPending}
                    onClick={() => renameField.mutate(field.id)}
                  >
                    Simpan
                  </Button>
                  <Button
                    variant="ghost"
                    data-testid={`custom-field-cancel-button-${field.key}`}
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" />
                    Batal
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{field.label}</p>
                    <p className="text-[11px] text-[#94A3B8]">kunci penyimpanan: {field.key}</p>
                  </div>
                  <Button
                    variant="outline"
                    data-testid={`custom-field-rename-button-${field.key}`}
                    onClick={() => {
                      setEditingId(field.id);
                      setEditLabel(field.label);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Ganti Nama
                  </Button>
                  <Button
                    variant="ghost"
                    data-testid={`custom-field-delete-button-${field.key}`}
                    disabled={removeField.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Hapus kolom "${field.label}"? Isinya akan hilang dari semua leads.`,
                        )
                      ) {
                        removeField.mutate(field.id);
                      }
                    }}
                    className="text-[#BE123C] hover:bg-[#FFE4E6] hover:text-[#9F1239]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CustomFieldsPage() {
  return (
    <ProtectedRoute adminOnly>
      <AppShell>
        <CustomFieldsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
