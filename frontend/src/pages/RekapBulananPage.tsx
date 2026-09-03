import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ClipboardList, Users2, Handshake, CalendarCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import type { RekapBulanan } from "@/lib/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function Kpi({
  label,
  value,
  icon: Icon,
  testId,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">{label}</p>
        <Icon className="h-4 w-4 text-[#0F766E]" />
      </div>
      <p data-testid={testId} className="mt-1 font-heading text-2xl font-bold text-[#0F172A]">
        {value}
      </p>
    </div>
  );
}

function RekapContent() {
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, error } = useQuery<RekapBulanan>({
    queryKey: ["rekap-bulanan", month],
    queryFn: () => apiGet<RekapBulanan>(`/rekap/bulanan?month=${month}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Rekap Bulanan</h1>
          <p className="mt-1 text-sm text-[#475569]">
            Ringkasan performa tim, jadwal prospek, dan sumber leads untuk satu periode.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-[11px] text-[#94A3B8]">Pilih Bulan</Label>
            <Input
              type="month"
              data-testid="rekap-bulanan-month-input"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
              className="w-[170px]"
            />
          </div>
          <a
            href={`/api/rekap/export?month=${month}`}
            data-testid="rekap-bulanan-export-link"
            className={buttonVariants({ variant: "outline" })}
          >
            <Download className="h-4 w-4" />
            Unduh CSV
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFE4E6] p-4 text-sm text-[#9F1239]">
          Gagal memuat rekap bulanan.
        </div>
      )}
      {isLoading && <p className="text-sm text-[#94A3B8]">Memuat rekap...</p>}

      {data && (
        <>
          <p data-testid="rekap-bulanan-period" className="text-sm font-medium text-[#0F766E]">
            Periode: {data.label}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Leads Masuk" value={data.total_leads_masuk} icon={Users2} testId="rekap-kpi-leads" />
            <Kpi label="Deal" value={data.total_deals} icon={Handshake} testId="rekap-kpi-deals" />
            <Kpi
              label="Jadwal Prospek"
              value={data.total_jadwal}
              icon={ClipboardList}
              testId="rekap-kpi-jadwal"
            />
            <Kpi
              label="Jadwal Selesai"
              value={data.total_jadwal_selesai}
              icon={CalendarCheck}
              testId="rekap-kpi-jadwal-selesai"
            />
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <p className="border-b border-[#F1F5F9] px-5 py-3 font-heading text-sm font-semibold text-[#0F172A]">
              Per Marketing
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marketing</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Leads Masuk</TableHead>
                  <TableHead>Jadwal</TableHead>
                  <TableHead>Selesai</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.per_marketing.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-[#94A3B8]">
                      Belum ada akun marketing.
                    </TableCell>
                  </TableRow>
                )}
                {data.per_marketing.map((r) => (
                  <TableRow key={r.marketing_id} data-testid={`rekap-marketing-row-${r.marketing_id}`}>
                    <TableCell className="font-medium text-[#0F172A]">{r.marketing_name}</TableCell>
                    <TableCell className="font-semibold text-[#047857]">{r.deals}</TableCell>
                    <TableCell className="text-[#475569]">{r.leads_masuk}</TableCell>
                    <TableCell className="text-[#475569]">{r.jadwal}</TableCell>
                    <TableCell className="text-[#475569]">{r.jadwal_selesai}</TableCell>
                    <TableCell className="text-[#475569]">
                      {r.target_deals ? `${r.deals}/${r.target_deals} (${r.target_progress}%)` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <p className="border-b border-[#F1F5F9] px-5 py-3 font-heading text-sm font-semibold text-[#0F172A]">
              Per Sumber Leads (leads yang masuk bulan ini)
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Konversi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.per_sumber.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-[#94A3B8]">
                      Tidak ada leads baru pada periode ini.
                    </TableCell>
                  </TableRow>
                )}
                {data.per_sumber.map((s) => (
                  <TableRow key={`${s.type}-${s.sumber}`} data-testid={`rekap-sumber-row-${s.type}-${s.sumber.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    <TableCell className="font-medium text-[#0F172A]">{s.sumber}</TableCell>
                    <TableCell className="text-[#475569]">
                      {s.type === "nasabah" ? "Nasabah" : "Pelamar Kerja"}
                    </TableCell>
                    <TableCell className="text-[#475569]">{s.total}</TableCell>
                    <TableCell className="font-semibold text-[#047857]">{s.won}</TableCell>
                    <TableCell className="text-[#0F766E]">{s.conversion_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

export default function RekapBulananPage() {
  return (
    <ProtectedRoute adminOnly>
      <AppShell>
        <RekapContent />
      </AppShell>
    </ProtectedRoute>
  );
}
