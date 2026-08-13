import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, ApiError } from "@/lib/api";
import { beginSession } from "@/lib/session";
import type { UserPublic } from "@/lib/types";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: () => apiPost<UserPublic>("/auth/login", { email, password }),
    onSuccess: async (user) => {
      await beginSession();
      toast.success(`Selamat datang, ${user.name}`);
      navigate("/");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? "Email atau password salah" : "Gagal terhubung ke server");
    },
  });

  return (
    <div className="flex min-h-svh bg-[#F8FAFC]">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0F172A] p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#0F766E]/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#0284C7]/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F766E]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading text-lg font-bold">QuickPro Leads CRM</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="font-heading text-4xl font-bold leading-tight">
            Kelola leads nasabah &amp; pelamar kerja dalam satu sistem terpusat.
          </h1>
          <p className="mt-4 text-sm text-[#94A3B8]">
            Setiap marketing hanya melihat data leads miliknya sendiri — admin mengatur pembagian
            leads untuk seluruh tim secara terpusat dan transparan.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#2DD4BF]" />
              <span className="text-sm text-[#CBD5E1]">Isolasi data antar marketing terjaga</span>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[#2DD4BF]" />
              <span className="text-sm text-[#CBD5E1]">Progres leads tercatat rapi &amp; berjejak</span>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-[#2DD4BF]" />
              <span className="text-sm text-[#CBD5E1]">Dashboard performa tim secara real-time</span>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-[#64748B]">© 2026 QuickPro Leads CRM</p>
      </div>

      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F766E]">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-lg font-bold text-[#0F172A]">QuickPro Leads CRM</span>
          </div>

          <h2 className="font-heading text-2xl font-bold text-[#0F172A]">Masuk ke Akun Anda</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Gunakan email dan password yang diberikan oleh admin.
          </p>

          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              loginMutation.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-input-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@quickpro.id"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-input-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p data-testid="login-error-message" className="text-sm font-medium text-[#BE123C]">
                {error}
              </p>
            )}

            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loginMutation.isPending}
              className="mt-1 bg-[#0F766E] hover:bg-[#0d6058]"
            >
              {loginMutation.isPending ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
