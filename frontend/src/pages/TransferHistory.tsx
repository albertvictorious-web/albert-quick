import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { TRANSFER_MODE_LABELS, type Transfer } from "@/lib/types";

const MODE_STYLES: Record<string, string> = {
  single: "border-[#BAE6FD] bg-[#E0F2FE] text-[#0369A1]",
  bulk: "border-[#C7D2FE] bg-[#EEF2FF] text-[#3730A3]",
  auto: "border-[#A7F3D0] bg-[#D1FAE5] text-[#065F46]",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TransferHistoryContent() {
  const { data, isLoading, error } = useQuery<Transfer[]>({
    queryKey: ["transfers"],
    queryFn: () => apiGet<Transfer[]>("/transfers"),
  });

  const rows = error ? [] : (data ?? []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Riwayat Perpindahan</h1>
        <p className="mt-1 text-sm text-[#475569]">
          Catatan lengkap setiap leads yang berpindah tangan: dari siapa, ke siapa, oleh siapa, dan
          kapan.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFE4E6] p-4 text-sm text-[#9F1239]">
          Gagal memuat riwayat perpindahan.
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leads</TableHead>
              <TableHead>Perpindahan</TableHead>
              <TableHead>Oleh</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead>Waktu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-[#94A3B8]">
                  Memuat riwayat...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-[#94A3B8]">
                  <History className="mx-auto mb-2 h-5 w-5 text-[#CBD5E1]" />
                  Belum ada perpindahan leads yang tercatat.
                </TableCell>
              </TableRow>
            )}
            {rows.map((t) => (
              <TableRow key={t.id} data-testid={`transfer-row-${t.id}`}>
                <TableCell className="font-medium text-[#0F172A]">{t.lead_nama}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 text-sm text-[#475569]">
                    <span>{t.from_name}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#0F766E]" />
                    <span className="font-medium text-[#0F172A]">{t.to_name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-[#475569]">{t.by_name}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      MODE_STYLES[t.mode] ?? "border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]"
                    }`}
                  >
                    {TRANSFER_MODE_LABELS[t.mode] ?? t.mode}
                  </span>
                </TableCell>
                <TableCell className="text-[#475569]">{formatDateTime(t.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function TransferHistory() {
  return (
    <ProtectedRoute adminOnly>
      <AppShell>
        <TransferHistoryContent />
      </AppShell>
    </ProtectedRoute>
  );
}
