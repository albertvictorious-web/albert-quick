import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  UserCog,
  LogOut,
  History,
  NotebookPen,
  CalendarClock,
  KeyRound,
  ClipboardList,
  Columns3,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/components/ProtectedRoute";
import NotificationBell from "@/components/NotificationBell";
import LeadDetailSheet from "@/components/LeadDetailSheet";
import { endSession } from "@/lib/session";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/leads", label: "Data Leads", icon: Users2, adminOnly: false },
  { to: "/jadwal-prospek", label: "Jadwal Prospek", icon: CalendarClock, adminOnly: false },
  { to: "/catatan", label: "Catatan", icon: NotebookPen, adminOnly: false },
  { to: "/rekap-bulanan", label: "Rekap Bulanan", icon: ClipboardList, adminOnly: true },
  { to: "/akun-marketing", label: "Akun Marketing", icon: UserCog, adminOnly: true },
  { to: "/kolom-custom", label: "Kolom Custom", icon: Columns3, adminOnly: true },
  { to: "/riwayat-perpindahan", label: "Riwayat Perpindahan", icon: History, adminOnly: true },
  { to: "/ganti-password", label: "Ganti Password", icon: KeyRound, adminOnly: false },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifLeadId, setNotifLeadId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Navigating on a phone should always close the drawer behind you.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await endSession();
    toast.success("Berhasil keluar dari sistem");
    navigate("/login");
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin");
  const currentLabel =
    NAV_ITEMS.find((item) => item.to === location.pathname)?.label ?? "QuickPro Leads CRM";

  const navList = (
    <nav className="flex flex-1 flex-col gap-1">
      {visibleItems.map((item) => {
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
  );

  const userBox = (
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
  );

  const brand = (
    <div className="flex items-center gap-2 px-2 pb-8">
      <img
        src="/logo.png"
        alt="Logo QuickPro Leads CRM"
        data-testid="sidebar-brand-logo"
        className="h-9 w-9 rounded-lg object-contain"
      />
      <div>
        <p className="font-heading text-sm font-bold text-white leading-tight">QuickPro</p>
        <p className="text-[11px] text-[#94A3B8] leading-tight">Leads CRM</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-svh bg-[#F8FAFC]">
      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] flex-col bg-[#0F172A] px-4 py-6 md:flex">
        {brand}
        {navList}
        {userBox}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" data-testid="mobile-nav-drawer">
          <div
            className="absolute inset-0 bg-[#0F172A]/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[268px] flex-col bg-[#0F172A] px-4 py-6 shadow-2xl">
            <button
              type="button"
              data-testid="mobile-nav-close-button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-[#94A3B8] transition-colors duration-200 hover:bg-[#1E293B] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            {brand}
            {navList}
            {userBox}
          </aside>
        </div>
      )}

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="mobile-nav-toggle-button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-[#E2E8F0] p-2 text-[#475569] transition-colors duration-200 hover:bg-[#F8FAFC] md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <p className="font-heading text-base font-bold text-[#0F172A] sm:text-lg">
              {currentLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell onSelectLead={setNotifLeadId} />
            <span
              data-testid="topbar-user-name"
              className="hidden text-sm font-medium text-[#0F172A] sm:inline"
            >
              {user?.name}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <LeadDetailSheet leadId={notifLeadId} onOpenChange={(open) => !open && setNotifLeadId(null)} />
    </div>
  );
}
