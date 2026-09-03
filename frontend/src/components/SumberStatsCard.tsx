import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Trophy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import type { LeadType, SumberStat } from "@/lib/types";

/** Which acquisition channel actually converts into deals. */
export default function SumberStatsCard() {
  const [type, setType] = useState<LeadType>("nasabah");

  const { data, error, isLoading } = useQuery<SumberStat[]>({
    queryKey: ["sumber-stats", type],
    queryFn: () => apiGet<SumberStat[]>(`/leads/sumber-stats?type=${type}`),
  });

  const rows = error ? [] : (data ?? []);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const best = rows.find((r) => r.won > 0);

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
      data-testid="sumber-stats-card"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-[#0284C7]" />
          <div>
            <p className="font-heading text-sm font-semibold text-[#0F172A]">
              Performa Sumber Leads
            </p>
            <p className="text-xs text-[#94A3B8]">
              {type === "nasabah"
                ? "Channel mana yang paling banyak menghasilkan deal nasabah"
                : "Channel rekrutmen mana yang paling banyak menghasilkan pelamar diterima"}
            </p>
          </div>
        </div>
        {best && (
          <div
            data-testid="sumber-stats-best"
            className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#D1FAE5] px-3 py-1"
          >
            <Trophy className="h-3.5 w-3.5 text-[#065F46]" />
            <span className="text-xs font-semibold text-[#065F46]">
              Terbaik: {best.sumber} ({best.won} {type === "nasabah" ? "deal" : "diterima"})
            </span>
          </div>
        )}
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as LeadType)} className="mb-4">
        <TabsList>
          <TabsTrigger value="nasabah" data-testid="sumber-stats-tab-nasabah">
            Nasabah
          </TabsTrigger>
          <TabsTrigger value="pelamar" data-testid="sumber-stats-tab-pelamar">
            Pelamar Kerja
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <p className="text-sm text-[#94A3B8]">Memuat performa sumber...</p>}
      {!isLoading && rows.length === 0 && (
        <p data-testid="sumber-stats-empty" className="text-sm text-[#94A3B8]">
          Belum ada data sumber leads.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div
            key={r.sumber}
            data-testid={`sumber-stats-row-${r.sumber.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className="flex items-center gap-3"
          >
            <span className="w-[150px] shrink-0 truncate text-xs font-medium text-[#0F172A]">
              {r.sumber}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-[#F1F5F9]">
              <div
                className="flex h-full items-center rounded-md bg-[#0284C7]/15"
                style={{ width: `${(r.total / maxTotal) * 100}%` }}
              >
                <div
                  className="h-full rounded-l-md bg-[#047857]"
                  style={{ width: `${r.total ? (r.won / r.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <span className="w-[135px] shrink-0 text-right text-[11px] text-[#475569]">
              {r.total} leads · <span className="font-semibold text-[#047857]">{r.won} deal</span> ·{" "}
              <span className="font-semibold text-[#0F766E]">{r.conversion_rate}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
