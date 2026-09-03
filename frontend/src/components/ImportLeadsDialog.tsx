import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ImportResult } from "@/lib/types";

export default function ImportLeadsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      // Multipart upload, so this one goes straight to fetch instead of the JSON helpers.
      const res = await fetch("/api/leads/import", {
        method: "POST",
        body,
        credentials: "include",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.detail ?? "Gagal mengimpor file");
      }
      const imported = payload as ImportResult;
      setResult(imported);
      toast.success(`${imported.created} leads berhasil diimpor`, {
        description: imported.skipped > 0 ? `${imported.skipped} baris dilewati` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sumber-stats"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengimpor file");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="import-leads-dialog" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Data Leads (CSV)</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#475569]">
            <p className="font-medium text-[#0F172A]">Langkah singkat</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[13px]">
              <li>Unduh template agar nama kolom persis sama.</li>
              <li>
                Isi kolom <span className="font-medium">tipe</span> dengan{" "}
                <span className="font-medium">nasabah</span> atau{" "}
                <span className="font-medium">pelamar</span>; kolom{" "}
                <span className="font-medium">nama</span> dan{" "}
                <span className="font-medium">no_wa</span> wajib diisi.
              </li>
              <li>
                Isi <span className="font-medium">marketing_email</span> bila ingin langsung
                ditugaskan; kosongkan untuk masuk ke daftar belum ditugaskan.
              </li>
            </ol>
          </div>

          <a
            href="/api/leads/import-template"
            data-testid="import-template-link"
            className={buttonVariants({ variant: "outline" })}
          >
            <Download className="h-4 w-4" />
            Unduh Template CSV
          </a>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            data-testid="import-file-input"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
          <Button
            data-testid="import-choose-file-button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {busy ? "Mengimpor..." : "Pilih File CSV & Impor"}
          </Button>

          {result && (
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
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Tutup</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
