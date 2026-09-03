import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, ApiError } from "@/lib/api";
import type { DeleteAllResult } from "@/lib/types";

const CONFIRM_WORD = "HAPUS";

/** Admin-only nuke of every nasabah + pelamar lead, gated by a type-to-confirm box. */
export default function DeleteAllLeadsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const queryClient = useQueryClient();

  const deleteAll = useMutation({
    mutationFn: () => apiDelete<DeleteAllResult>(`/leads/all?confirm=${CONFIRM_WORD}`),
    onSuccess: (result) => {
      toast.success(`${result.deleted} leads dihapus`, {
        description: `${result.nasabah} nasabah · ${result.pelamar} pelamar kerja`,
      });
      setTyped("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sumber-stats"] });
      queryClient.invalidateQueries({ queryKey: ["team-performance"] });
      queryClient.invalidateQueries({ queryKey: ["deal-trend"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-notifications"] });
    },
    onError: (err) => {
      const detail =
        err instanceof ApiError &&
        typeof err.body === "object" &&
        err.body &&
        "detail" in (err.body as Record<string, unknown>)
          ? String((err.body as Record<string, unknown>).detail)
          : "Gagal menghapus data leads";
      toast.error(detail);
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="delete-all-leads-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus Semua Data Leads</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex gap-2.5 rounded-lg border border-[#FECDD3] bg-[#FFE4E6] p-3 text-sm text-[#9F1239]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Tindakan ini permanen</p>
              <p className="mt-1 text-[13px]">
                Seluruh data <span className="font-medium">Nasabah</span> dan{" "}
                <span className="font-medium">Pelamar Kerja</span> beserta catatan progresnya akan
                dihapus dan tidak bisa dikembalikan. Akun marketing, jadwal prospek, dan catatan
                pribadi tetap aman.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="confirm-delete-all">
              Ketik <span className="font-semibold text-[#0F172A]">{CONFIRM_WORD}</span> untuk
              melanjutkan
            </Label>
            <Input
              id="confirm-delete-all"
              data-testid="delete-all-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="delete-all-confirm-button"
            disabled={typed !== CONFIRM_WORD || deleteAll.isPending}
            onClick={() => deleteAll.mutate()}
            className="bg-[#BE123C] text-white hover:bg-[#9F1239]"
          >
            <Trash2 className="h-4 w-4" />
            {deleteAll.isPending ? "Menghapus..." : "Hapus Semua"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
