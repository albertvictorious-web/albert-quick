import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute, { useMe } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, ApiError } from "@/lib/api";

export default function GantiPasswordPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <GantiPasswordContent />
      </AppShell>
    </ProtectedRoute>
  );
}

function GantiPasswordContent() {
  const { data: me } = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const changeMutation = useMutation({
    mutationFn: () =>
      apiPost<{ message: string }>("/auth/change-password", {
        current_password: current,
        new_password: next,
      }),
    onSuccess: () => {
      toast.success("Password berhasil diubah");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (err) => {
      setError(
        err instanceof ApiError &&
          typeof err.body === "object" &&
          err.body &&
          "detail" in (err.body as Record<string, unknown>)
          ? String((err.body as Record<string, unknown>).detail)
          : "Gagal mengubah password"
      );
    },
  });

  const submit = () => {
    setError("");
    if (next.length < 6) {
      setError("Password baru minimal 6 karakter");
      return;
    }
    if (next !== confirm) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    changeMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Ganti Password</h1>
        <p className="mt-1 text-sm text-[#475569]">
          Ubah password akun Anda ({me?.email}). Masukkan password saat ini untuk konfirmasi.
        </p>
      </div>

      <div className="max-w-md rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#0F766E]" />
          <p className="font-heading text-sm font-semibold text-[#0F172A]">Password Baru</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label>Password Saat Ini</Label>
            <Input
              type="password"
              data-testid="change-password-current"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Password Baru</Label>
            <Input
              type="password"
              data-testid="change-password-new"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Ulangi Password Baru</Label>
            <Input
              type="password"
              data-testid="change-password-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && (
            <p data-testid="change-password-error" className="text-sm font-medium text-[#BE123C]">
              {error}
            </p>
          )}

          <Button
            data-testid="change-password-submit"
            disabled={!current || !next || !confirm || changeMutation.isPending}
            onClick={submit}
          >
            {changeMutation.isPending ? "Menyimpan..." : "Simpan Password Baru"}
          </Button>

          <p className="flex items-start gap-1.5 text-[11px] text-[#94A3B8]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
            Minimal 6 karakter. Setelah diubah, gunakan password baru pada login berikutnya.
          </p>
        </div>
      </div>
    </div>
  );
}
