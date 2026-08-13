import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPut } from "@/lib/api";
import type { MarketingTarget } from "@/lib/types";

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

function TargetRow({ row }: { row: MarketingTarget }) {
  const [value, setValue] = useState(String(row.target_deals));
  const queryClient = useQueryClient();

  // Keep the input in sync when the server value changes (e.g. after another save).
  useEffect(() => {
    setValue(String(row.target_deals));
  }, [row.target_deals]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut<MarketingTarget>("/targets", {
        marketing_id: row.marketing_id,
        month: row.month,
        target_deals: Number(value) || 0,
      }),
    onSuccess: (saved) => {
      toast.success(`Target ${saved.marketing_name} disimpan: ${saved.target_deals} deal`);
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["my-target"] });
    },
    onError: () => toast.error("Gagal menyimpan target"),
  });

  const pct = Math.min(row.progress, 100);

  return (
    <div
      data-testid={`target-row-${row.marketing_id}`}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3"
    >
      <div className="min-w-[150px] flex-1">
        <p className="text-sm font-semibold text-[#0F172A]">{row.marketing_name}</p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
          <div
            className="h-full rounded-full bg-[#0F766E] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-[#475569]">
          <span data-testid={`target-achieved-${row.marketing_id}`} className="font-semibold text-[#0F766E]">
            {row.achieved}
          </span>{" "}
          / {row.target_deals || "-"} deal bulan ini ({row.progress}%)
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          data-testid={`target-input-${row.marketing_id}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20"
        />
        <Button
          variant="outline"
          data-testid={`target-save-button-${row.marketing_id}`}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Simpan
        </Button>
      </div>
    </div>
  );
}

export default function MonthlyTargetsPanel() {
  const { data, isLoading, error } = useQuery<MarketingTarget[]>({
    queryKey: ["targets"],
    queryFn: () => apiGet<MarketingTarget[]>("/targets"),
  });

  const rows = error ? [] : (data ?? []);

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 shadow-sm"
      data-testid="monthly-targets-panel"
    >
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-[#0F766E]" />
        <div>
          <p className="font-heading text-sm font-semibold text-[#0F172A]">Target Deal Bulanan</p>
          <p className="text-xs text-[#94A3B8]">
            {rows.length > 0
              ? `Periode ${monthLabel(rows[0].month)} — progres dihitung dari deal bulan berjalan`
              : "Atur target deal per marketing untuk bulan berjalan"}
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-[#94A3B8]">Memuat target...</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-[#94A3B8]">Belum ada akun marketing untuk diberi target.</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <TargetRow key={row.marketing_id} row={row} />
        ))}
      </div>
    </div>
  );
}
