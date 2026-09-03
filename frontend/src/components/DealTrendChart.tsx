import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { DealTrendPoint } from "@/lib/types";

/** Deal count per month so the team can see performance rising or falling. */
export default function DealTrendChart() {
  const { data, error, isLoading } = useQuery<DealTrendPoint[]>({
    queryKey: ["deal-trend"],
    queryFn: () => apiGet<DealTrendPoint[]>("/leads/deal-trend?months=6"),
  });

  const rows = error ? [] : (data ?? []);
  const last = rows.at(-1);
  const prev = rows.at(-2);
  const delta = last && prev ? last.deals - prev.deals : 0;
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? "#065F46" : delta < 0 ? "#9F1239" : "#475569";
  const trendBg = delta > 0 ? "#D1FAE5" : delta < 0 ? "#FFE4E6" : "#F1F5F9";

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
      data-testid="deal-trend-card"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-[#0F172A]">Tren Deal per Bulan</p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            Jumlah deal (nasabah + pelamar diterima) selama 6 bulan terakhir
          </p>
        </div>
        {last && (
          <div
            data-testid="deal-trend-delta"
            className="flex items-center gap-2 rounded-full border px-3 py-1"
            style={{ backgroundColor: trendBg, borderColor: trendBg, color: trendColor }}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">
              {last.label}: {last.deals} deal
              {prev ? ` (${delta > 0 ? "+" : ""}${delta} vs ${prev.label})` : ""}
            </span>
          </div>
        )}
      </div>

      {isLoading && <p className="py-10 text-center text-sm text-[#94A3B8]">Memuat tren deal...</p>}
      {!isLoading && rows.length === 0 && (
        <p data-testid="deal-trend-empty" className="py-10 text-center text-sm text-[#94A3B8]">
          Belum ada data deal untuk ditampilkan.
        </p>
      )}

      {rows.length > 0 && (
        <div className="h-[240px] w-full" data-testid="deal-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <defs>
                <linearGradient id="dealNasabah" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F766E" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#0F766E" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="dealPelamar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284C7" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="label"
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
                contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="nasabah"
                name="Deal Nasabah"
                stroke="#0F766E"
                strokeWidth={2}
                fill="url(#dealNasabah)"
              />
              <Area
                type="monotone"
                dataKey="pelamar"
                name="Pelamar Diterima"
                stroke="#0284C7"
                strokeWidth={2}
                fill="url(#dealPelamar)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
