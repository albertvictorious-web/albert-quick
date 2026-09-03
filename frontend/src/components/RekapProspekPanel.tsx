import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet } from "@/lib/api";
import type { RekapProspek } from "@/lib/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [year, m] = month.split("-");
  const names = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${names[Number(m) - 1] ?? m} ${year}`;
}

export default function RekapProspekPanel() {
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, error } = useQuery<RekapProspek[]>({
    queryKey: ["jadwal-rekap", month],
    queryFn: () => apiGet<RekapProspek[]>(`/jadwal/rekap?month=${month}`),
  });

  const rows = error ? [] : (data ?? []);
  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      selesai: acc.selesai + r.selesai,
      ada_hasil: acc.ada_hasil + r.ada_hasil,
    }),
    { total: 0, selesai: 0, ada_hasil: 0 }
  );

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
      data-testid="rekap-prospek-panel"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#0F766E]" />
          <div>
            <p className="font-heading text-sm font-semibold text-[#0F172A]">Rekap Prospek</p>
            <p className="text-xs text-[#94A3B8]">
              Periode {monthLabel(month)} · {totals.total} jadwal · {totals.selesai} selesai ·{" "}
              {totals.ada_hasil} sudah ada hasil
            </p>
          </div>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px] text-[#94A3B8]">Pilih Bulan</Label>
          <Input
            type="month"
            data-testid="rekap-month-input"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="w-[170px]"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-[#94A3B8]">Memuat rekap...</p>}
      {!isLoading && rows.length === 0 && (
        <p data-testid="rekap-empty" className="text-sm text-[#94A3B8]">
          Belum ada data prospek pada periode ini.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const pct = r.total ? Math.round((r.selesai / r.total) * 100) : 0;
          return (
            <div
              key={r.marketing_id}
              data-testid={`rekap-row-${r.marketing_id}`}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">{r.marketing_name}</p>
                <span className="font-heading text-lg font-bold text-[#0F766E]">{r.total}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full bg-[#047857] transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[#475569]">
                {r.selesai} selesai · {r.terjadwal} terjadwal · {r.dibatalkan} dibatalkan
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                Hasil pertemuan terisi: <span className="font-semibold">{r.ada_hasil}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
