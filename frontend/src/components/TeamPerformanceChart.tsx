import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Trophy } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { TeamPerformance } from "@/lib/types";

const COLORS = { open: "#0284C7", won: "#047857", lost: "#E11D48" };

export default function TeamPerformanceChart() {
  const { data, error, isLoading } = useQuery<TeamPerformance[]>({
    queryKey: ["team-performance"],
    queryFn: () => apiGet<TeamPerformance[]>("/leads/team-performance"),
  });

  const rows = error ? [] : (data ?? []);
  const best = rows
    .filter((r) => r.marketing_id && r.total > 0)
    .reduce<TeamPerformance | null>(
      (acc, r) => (!acc || r.conversion_rate > acc.conversion_rate ? r : acc),
      null
    );

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
      data-testid="team-performance-card"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-[#0F172A]">
            Performa Tim Marketing
          </p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            Jumlah leads per marketing dan tingkat konversi (deal / diterima)
          </p>
        </div>
        {best && (
          <div
            data-testid="team-performance-top-performer"
            className="flex items-center gap-2 rounded-full border border-[#A7F3D0] bg-[#D1FAE5] px-3 py-1"
          >
            <Trophy className="h-3.5 w-3.5 text-[#065F46]" />
            <span className="text-xs font-semibold text-[#065F46]">
              Terbaik: {best.marketing_name} ({best.conversion_rate}%)
            </span>
          </div>
        )}
      </div>

      {isLoading && <p className="py-10 text-center text-sm text-[#94A3B8]">Memuat performa tim...</p>}

      {!isLoading && rows.length === 0 && (
        <p data-testid="team-performance-empty" className="py-10 text-center text-sm text-[#94A3B8]">
          Belum ada data performa untuk ditampilkan.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="h-[260px] w-full" data-testid="team-performance-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="marketing_name"
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="open" name="Sedang Diproses" fill={COLORS.open} radius={[4, 4, 0, 0]}>
                  {rows.map((r) => (
                    <Cell key={`open-${r.marketing_name}`} fill={COLORS.open} />
                  ))}
                </Bar>
                <Bar dataKey="closed_won" name="Berhasil" fill={COLORS.won} radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed_lost" name="Gagal" fill={COLORS.lost} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((r) => (
              <div
                key={r.marketing_name}
                data-testid={`team-performance-row-${r.marketing_name.toLowerCase().replace(/\s+/g, "-")}`}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
              >
                <p className="text-xs font-semibold text-[#0F172A]">{r.marketing_name}</p>
                <p className="mt-0.5 text-[11px] text-[#475569]">
                  {r.total} leads · {r.closed_won} berhasil ·{" "}
                  <span className="font-semibold text-[#0F766E]">{r.conversion_rate}%</span>
                </p>
                {r.marketing_id && (
                  <>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                      <div
                        className="h-full rounded-full bg-[#B45309] transition-[width] duration-500"
                        style={{ width: `${Math.min(r.target_progress, 100)}%` }}
                      />
                    </div>
                    <p
                      data-testid={`team-performance-target-${r.marketing_name.toLowerCase().replace(/\s+/g, "-")}`}
                      className="mt-1 text-[11px] text-[#94A3B8]"
                    >
                      Target bulan ini: {r.achieved_this_month}/{r.target_deals || "-"} deal
                      {r.target_deals ? ` (${r.target_progress}%)` : " (belum diatur)"}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
