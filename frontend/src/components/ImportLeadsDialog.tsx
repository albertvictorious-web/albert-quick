import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, FileSpreadsheet, FileUp, Loader2, Wand2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { ImportPreview, ImportResult, LeadType } from "@/lib/types";

// Select cannot carry an empty string value, so "column not used" needs a sentinel.
const NONE = "__none__";

const LEAD_TYPES: { value: LeadType; label: string }[] = [
  { value: "nasabah", label: "Nasabah" },
  { value: "pelamar", label: "Pelamar Kerja" },
];

/** Upload any .xlsx/.xls/.csv, confirm the auto-detected column mapping, then import. */
export default function ImportLeadsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<"pick" | "map" | "done">("pick");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [leadType, setLeadType] = useState<LeadType>("nasabah");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Columns nobody claimed become a progress note, so the admin sees exactly what will happen.
  const leftovers = useMemo(() => {
    if (!preview) return [];
    const used = new Set(Object.values(mapping).filter(Boolean) as string[]);
    return preview.headers.filter((h) => !used.has(h));
  }, [preview, mapping]);

  const missingRequired = useMemo(
    () => (preview?.fields ?? []).filter((f) => f.required && !mapping[f.key]).map((f) => f.label),
    [preview, mapping],
  );

  const reset = () => {
    setStep("pick");
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", picked);
      // Multipart upload, so this one goes straight to fetch instead of the JSON helpers.
      const res = await fetch("/api/leads/import/preview", {
        method: "POST",
        body,
        credentials: "include",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.detail ?? "Gagal membaca file");
      const detected = payload as ImportPreview;
      setFile(picked);
      setPreview(detected);
      setMapping(detected.mapping);
      setStep("map");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca file");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("mapping", JSON.stringify(mapping));
      body.append("lead_type", leadType);
      const res = await fetch("/api/leads/import", {
        method: "POST",
        body,
        credentials: "include",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.detail ?? "Gagal mengimpor file");
      const imported = payload as ImportResult;
      setResult(imported);
      setStep("done");
      toast.success(`${imported.created} leads berhasil diimpor`, {
        description: imported.skipped > 0 ? `${imported.skipped} baris dilewati` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sumber-stats"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["deal-trend"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengimpor file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="import-leads-dialog"
        className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]"
      >
        <DialogHeader>
          <DialogTitle>
            {step === "map" ? "Cocokkan Kolom File" : "Upload Data Leads"}
          </DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <div className="flex flex-col gap-4 py-1">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#475569]">
              <p className="flex items-center gap-1.5 font-medium text-[#0F172A]">
                <Wand2 className="h-4 w-4 text-[#0F766E]" />
                Tidak perlu template
              </p>
              <p className="mt-1.5 text-[13px]">
                Upload file Excel (<span className="font-medium">.xlsx</span>,{" "}
                <span className="font-medium">.xls</span>) atau{" "}
                <span className="font-medium">.csv</span> apa adanya. Sistem membaca judul kolom
                Anda dan menebak sendiri pasangannya — Anda tinggal memeriksa dan membetulkan
                sebelum data masuk. Kolom yang tidak dikenali tetap disimpan sebagai catatan lead.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>File ini berisi data</Label>
              <Select
                value={leadType}
                onValueChange={(v) => setLeadType(v as LeadType)}
              >
                <SelectTrigger data-testid="import-lead-type-select">
                  <SelectValue>
                    {(v) => LEAD_TYPES.find((t) => t.value === v)?.label ?? "Pilih tipe"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LEAD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px] text-[#94A3B8]">
                Dipakai untuk semua baris, kecuali file Anda punya kolom tipe sendiri.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              data-testid="import-file-input"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
            <Button
              data-testid="import-choose-file-button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {busy ? "Membaca file..." : "Pilih File Excel / CSV"}
            </Button>

            <a
              href="/api/leads/import-template"
              data-testid="import-template-link"
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="h-4 w-4" />
              Unduh Template (opsional)
            </a>
          </div>
        )}

        {step === "map" && preview && (
          <div className="flex flex-col gap-4 py-1">
            <div
              data-testid="import-preview-summary"
              className="flex items-center gap-2 rounded-lg border border-[#99F6E4] bg-[#F0FDFA] p-3 text-sm text-[#115E59]"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{file?.name}</span> · {preview.total_rows} baris ·{" "}
                {preview.headers.length} kolom terbaca
              </span>
            </div>

            <div className="grid gap-2">
              <p className="font-heading text-sm font-semibold text-[#0F172A]">
                Pasangan kolom (bisa diubah)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.fields.map((f) => (
                  <div key={f.key} className="grid gap-1">
                    <Label className="text-[12px] text-[#475569]">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-[#E11D48]">*</span>}
                    </Label>
                    <Select
                      value={mapping[f.key] ?? NONE}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [f.key]: v === NONE ? null : (v as string) }))
                      }
                    >
                      <SelectTrigger data-testid={`import-map-select-${f.key}`}>
                        <SelectValue>
                          {(v) => (v === NONE || !v ? "— tidak dipakai —" : (v as string))}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— tidak dipakai —</SelectItem>
                        {preview.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {leftovers.length > 0 && (
              <p
                data-testid="import-leftover-columns"
                className="rounded-lg border border-[#FDE68A] bg-[#FEF3C7] p-3 text-[13px] text-[#92400E]"
              >
                Kolom <span className="font-semibold">{leftovers.join(", ")}</span> tidak
                dipasangkan — isinya tetap disimpan sebagai catatan di setiap lead.
              </p>
            )}

            {missingRequired.length > 0 && (
              <p
                data-testid="import-missing-required"
                className="rounded-lg border border-[#FECDD3] bg-[#FFE4E6] p-3 text-[13px] text-[#9F1239]"
              >
                Wajib dipilih dulu: {missingRequired.join(", ")}.
              </p>
            )}

            <div className="grid gap-2">
              <p className="font-heading text-sm font-semibold text-[#0F172A]">
                Contoh data ({preview.sample_rows.length} baris pertama)
              </p>
              <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                <Table data-testid="import-sample-table">
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-[12px]">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.sample_rows.map((row, i) => (
                      <TableRow key={i} data-testid={`import-sample-row-${i}`}>
                        {preview.headers.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap text-[12px] text-[#475569]">
                            {row[h] || "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                data-testid="import-back-button"
                disabled={busy}
                onClick={() => setStep("pick")}
              >
                <ArrowLeft className="h-4 w-4" />
                Ganti File
              </Button>
              <Button
                data-testid="import-confirm-button"
                disabled={busy || missingRequired.length > 0}
                onClick={handleImport}
                className="flex-1"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {busy ? "Mengimpor..." : `Impor ${preview.total_rows} Baris`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col gap-3 py-1">
            <div
              data-testid="import-result"
              className="rounded-lg border border-[#A7F3D0] bg-[#D1FAE5] p-3 text-sm text-[#065F46]"
            >
              <p className="font-semibold">
                {result.created} leads dibuat · {result.skipped} dilewati
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-[#92400E]">
                  {result.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
            <Button variant="outline" data-testid="import-again-button" onClick={reset}>
              <FileUp className="h-4 w-4" />
              Upload File Lain
            </Button>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Tutup</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
