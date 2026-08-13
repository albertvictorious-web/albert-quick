import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { AutoDistributeResult, LeadType, UserPublic } from "@/lib/types";

export default function AutoDistributeDialog({
  open,
  onOpenChange,
  leadType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadType: LeadType;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: marketingList } = useQuery<UserPublic[]>({
    queryKey: ["assignable-marketing"],
    queryFn: () => apiGet<UserPublic[]>("/leads/assignable-marketing"),
    enabled: open,
  });

  const { data: unassigned } = useQuery<{ id: string }[]>({
    queryKey: ["leads", leadType, "all", "unassigned", ""],
    queryFn: () => apiGet<{ id: string }[]>(`/leads?type=${leadType}&assigned_to=unassigned`),
    enabled: open,
  });

  const pool = unassigned?.length ?? 0;

  const distributeMutation = useMutation({
    mutationFn: () =>
      apiPost<AutoDistributeResult>("/leads/auto-distribute", {
        marketing_ids: picked,
        type: leadType,
      }),
    onSuccess: (result) => {
      const detail = Object.entries(result.per_marketing)
        .map(([name, count]) => `${name}: ${count}`)
        .join(" · ");
      toast.success(`${result.distributed} leads dibagi rata`, { description: detail });
      setPicked([]);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
      onOpenChange(false);
    },
    onError: (err) => {
      const detail =
        err instanceof ApiError &&
        typeof err.body === "object" &&
        err.body &&
        "detail" in (err.body as Record<string, unknown>)
          ? String((err.body as Record<string, unknown>).detail)
          : "Gagal membagi leads";
      toast.error(detail);
    },
  });

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="auto-distribute-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-[#0F766E]" />
            Auto Bagi Rata Leads
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#475569]">
            <span data-testid="auto-distribute-pool-count" className="font-semibold text-[#0F172A]">
              {pool}
            </span>{" "}
            leads {leadType === "nasabah" ? "nasabah" : "pelamar kerja"} belum ditugaskan dan siap
            dibagi.
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[#0F172A]">
              Pilih marketing yang ikut pembagian
            </p>
            <div className="flex flex-col gap-2">
              {(marketingList ?? []).map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#E2E8F0] px-3 py-2 transition-colors duration-200 hover:bg-[#F8FAFC]"
                >
                  <Checkbox
                    data-testid={`auto-distribute-checkbox-${m.id}`}
                    checked={picked.includes(m.id)}
                    onCheckedChange={() => toggle(m.id)}
                  />
                  <div>
                    <Label className="cursor-pointer text-sm">{m.name}</Label>
                    <p className="text-[11px] text-[#94A3B8]">{m.email}</p>
                  </div>
                </label>
              ))}
              {(marketingList ?? []).length === 0 && (
                <p className="text-sm text-[#94A3B8]">Belum ada akun marketing.</p>
              )}
            </div>
          </div>

          {picked.length > 0 && pool > 0 && (
            <p data-testid="auto-distribute-preview" className="text-xs text-[#0F766E]">
              {pool} leads akan dibagi ke {picked.length} marketing (± {Math.ceil(pool / picked.length)}{" "}
              leads per orang), bergiliran.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="auto-distribute-submit-button"
            disabled={picked.length === 0 || pool === 0 || distributeMutation.isPending}
            onClick={() => distributeMutation.mutate()}
          >
            {distributeMutation.isPending ? "Membagi..." : "Bagi Rata Sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
