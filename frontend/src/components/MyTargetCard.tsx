import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { MarketingTarget } from "@/lib/types";

/** Marketing-facing card: my own monthly deal target and how far along I am. */
export default function MyTargetCard() {
  const { data, error, isLoading } = useQuery<MarketingTarget>({
    queryKey: ["my-target"],
    queryFn: () => apiGet<MarketingTarget>("/targets/me"),
    retry: false,
  });

  if (error || isLoading || !data) return null;

  const pct = data.target_deals ? Math.min(data.progress, 100) : 0;

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
      data-testid="my-target-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[#B45309]" />
          <p className="font-heading text-sm font-semibold text-[#0F172A]">Target Deal Bulan Ini</p>
        </div>
        <p data-testid="my-target-progress-text" className="text-sm text-[#475569]">
          <span className="font-heading text-lg font-bold text-[#0F766E]">{data.achieved}</span>
          <span className="text-[#94A3B8]"> / {data.target_deals || "-"} deal</span>
          {data.target_deals > 0 && (
            <span className="ml-1 font-semibold text-[#B45309]">({data.progress}%)</span>
          )}
        </p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
        <div
          className="h-full rounded-full bg-[#0F766E] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-[#94A3B8]">
        {data.target_deals === 0
          ? "Admin belum menetapkan target untuk bulan ini."
          : data.achieved >= data.target_deals
            ? "Target bulan ini sudah tercapai. Kerja bagus!"
            : `Butuh ${data.target_deals - data.achieved} deal lagi untuk mencapai target.`}
      </p>
    </div>
  );
}
