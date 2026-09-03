import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Trash2, Pencil } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import MonthlyTargetsPanel from "@/components/MonthlyTargetsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import type { UserPublic } from "@/lib/types";

function CreateMarketingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => apiPost<UserPublic>("/auth/marketing", { name, email, password }),
    onSuccess: () => {
      toast.success("Akun marketing berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["marketing-users"] });
      queryClient.invalidateQueries({ queryKey: ["assignable-marketing"] });
      setName("");
      setEmail("");
      setPassword("");
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError && typeof err.body === "object" && err.body && "detail" in (err.body as Record<string, unknown>)
          ? String((err.body as Record<string, unknown>).detail)
          : "Gagal membuat akun marketing"
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-marketing-dialog">
        <DialogHeader>
          <DialogTitle>Buat Akun Marketing Baru</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nama Lengkap</Label>
            <Input data-testid="create-marketing-input-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              data-testid="create-marketing-input-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              data-testid="create-marketing-input-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm font-medium text-[#BE123C]">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="create-marketing-submit-button"
            disabled={!name || !email || !password || createMutation.isPending}
            onClick={() => {
              setError("");
              createMutation.mutate();
            }}
          >
            {createMutation.isPending ? "Menyimpan..." : "Buat Akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMarketingDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserPublic | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  // Prefill whenever a different account is opened.
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPassword("");
      setError("");
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPatch<UserPublic>(`/auth/marketing/${user?.id}`, {
        name: name || null,
        email: email || null,
        password: password || null,
      }),
    onSuccess: (saved) => {
      toast.success(`Akun ${saved.name} diperbarui`);
      queryClient.invalidateQueries({ queryKey: ["marketing-users"] });
      queryClient.invalidateQueries({ queryKey: ["assignable-marketing"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError &&
          typeof err.body === "object" &&
          err.body &&
          "detail" in (err.body as Record<string, unknown>)
          ? String((err.body as Record<string, unknown>).detail)
          : "Gagal memperbarui akun"
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-marketing-dialog">
        <DialogHeader>
          <DialogTitle>Ubah Akun Marketing</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nama Lengkap</Label>
            <Input
              data-testid="edit-marketing-input-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Email Login</Label>
            <Input
              type="email"
              data-testid="edit-marketing-input-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Password Baru (kosongkan bila tidak diubah)</Label>
            <Input
              type="password"
              data-testid="edit-marketing-input-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </div>
          {error && <p className="text-sm font-medium text-[#BE123C]">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button
            data-testid="edit-marketing-submit-button"
            disabled={saveMutation.isPending}
            onClick={() => {
              setError("");
              saveMutation.mutate();
            }}
          >
            {saveMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarketingAccountsContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserPublic | null>(null);
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<UserPublic[]>({
    queryKey: ["marketing-users"],
    queryFn: () => apiGet<UserPublic[]>("/auth/marketing"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/auth/marketing/${id}`),
    onSuccess: () => {
      toast.success("Akun marketing dihapus");
      queryClient.invalidateQueries({ queryKey: ["marketing-users"] });
      queryClient.invalidateQueries({ queryKey: ["assignable-marketing"] });
    },
    onError: () => toast.error("Gagal menghapus akun marketing"),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0F172A]">Akun Marketing</h1>
          <p className="mt-1 text-sm text-[#475569]">
            Buat dan kelola akun login untuk setiap marketing di kantor.
          </p>
        </div>
        <Button data-testid="open-create-marketing-dialog-button" onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Buat Akun Marketing
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-[#94A3B8]">Memuat akun marketing...</p>}
        {!isLoading && (users ?? []).length === 0 && (
          <p className="text-sm text-[#94A3B8]">Belum ada akun marketing.</p>
        )}
        {(users ?? []).map((u) => (
          <Card key={u.id} className="rounded-xl border border-[#E2E8F0] shadow-sm" data-testid={`marketing-user-card-${u.id}`}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="font-heading text-sm font-semibold text-[#0F172A]">{u.name}</p>
                <p className="text-xs text-[#94A3B8]">{u.email}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid={`edit-marketing-button-${u.id}`}
                  onClick={() => {
                    setEditUser(u);
                  }}
                  className="rounded-lg p-2 text-[#94A3B8] transition-colors duration-200 hover:bg-[#F0FDFA] hover:text-[#0F766E]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  data-testid={`delete-marketing-button-${u.id}`}
                  onClick={() => deleteMutation.mutate(u.id)}
                  className="rounded-lg p-2 text-[#94A3B8] transition-colors duration-200 hover:bg-[#FFE4E6] hover:text-[#BE123C]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateMarketingDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <EditMarketingDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(o) => !o && setEditUser(null)}
      />

      <MonthlyTargetsPanel />
    </div>
  );
}

export default function MarketingAccounts() {
  return (
    <ProtectedRoute adminOnly>
      <AppShell>
        <MarketingAccountsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
