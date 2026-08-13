import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users2, UserCog, LogOut, Sparkles, History } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/components/ProtectedRoute";
import NotificationBell from "@/components/NotificationBell";
import LeadDetailSheet from "@/components/LeadDetailSheet";
import { endSession } from "@/lib/session";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/leads", label: "Data Leads", icon: Users2, adminOnly: false },
  { to: "/akun-marketing", label: "Akun Marketing", icon: UserCog, adminOnly: true },
  { to: "/riwayat-perpindahan", label: "Riwayat Perpindahan", icon: History, adminOnly: true },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifLeadId, setNotifLeadId] = useState<string | null>(null);

  const handleLogout = async () => {
    await endSession();
    toast.success("Berhasil keluar dari sistem");
    navigate("/login");
  };

  return (
    <div className="flex min-h-svh bg-[#F8FAFC]">
      <aside className="hidden w-[260px] flex-col bg-[#0F172A] px-4 py-6 md:flex">
        <div className="flex items-center gap-2 px-2 pb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F766E]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-heading text-sm font-bold text-white leading-tight">QuickPro</p>
            <p className="text-[11px] text-[#94A3B8] leading-tight">Leads CRM</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  active
                    ? "bg-[#1E293B] text-white border-l-[3px] border-[#0F766E] -ml-[3px] pl-[15px]"
                    : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg bg-[#1E293B] p-3">
          <p className="text-xs font-semibold text-white">{user?.name}</p>
          <p className="text-[11px] text-[#94A3B8]">
            {user?.role === "admin" ? "Administrator" : "Marketing"}
          </p>
          <button
            type="button"
            data-testid="logout-button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-md bg-[#0F172A] px-2.5 py-1.5 text-xs font-medium text-[#F8FAFC] transition-colors duration-200 hover:bg-[#334155]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6">
          <div>
            <p className="font-heading text-lg font-bold text-[#0F172A]">
              {NAV_ITEMS.find((item) => item.to === location.pathname)?.label ?? "QuickPro Leads CRM"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell onSelectLead={setNotifLeadId} />
            <div className="flex items-center gap-2 md:hidden">
              <span data-testid="mobile-user-name" className="text-sm font-medium text-[#0F172A]">
                {user?.name}
              </span>
              <button
                type="button"
                data-testid="logout-button-mobile"
                onClick={handleLogout}
                className="rounded-md bg-[#0F172A] p-2 text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <LeadDetailSheet leadId={notifLeadId} onOpenChange={(open) => !open && setNotifLeadId(null)} />
    </div>
  );
}
