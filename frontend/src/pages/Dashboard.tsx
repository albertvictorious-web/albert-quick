import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Users2, TrendingUp } from "lucide-react";
import AppShell from "@/components/AppShell";
import ProtectedRoute, { useMe } from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import LeadDetailSheet from "@/components/LeadDetailSheet";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import type { Lead, LeadStats } from "@/lib/types";

function KpiCard({
  label,
  value,
  icon: Icon,
  testId,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}) {
  return (
    <Card className="rounded-xl border border-[#E2E8F0] shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">{label}</p>
          <p data-testid={testId} className="mt-1 font-heading text-2xl font-bold text-[#0F172A]">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0FDFA]">
          <Icon className="h-5 w-5 text-[#0F766E]" />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { data: me } = useMe();
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  const { data: stats, error: statsError } = useQuery<LeadStats>({
    queryKey: ["leads-stats"],
    queryFn: () => apiGet<LeadStats>("/leads/stats"),
  });

  const { data: leads, error: leadsError } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => apiGet<Lead[]>("/leads"),
  });

  const today = new Date().toISOString().slice(0, 10);
  const followUps = (leads ?? []).filter(
    (l) => l.tanggal_follow_up && l.tanggal_follow_up <= today
  );
  const recent = (leads ?? []).slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0F172A]">
          Halo, {me?.name?.split(" ")[0] ?? "Pengguna"} 👋
        </h1>
        <p className="mt-1 text-sm text-[#475569]">
          {me?.role === "admin"
            ? "Ringkasan seluruh leads yang dikelola tim marketing."
            : "Ringkasan leads yang sedang Anda kelola."}
        </p>
      </div>

      {(statsError || leadsError) && (
        <div className="rounded-xl border border-[#FECDD3] bg-[#FFE4E6] p-4 text-sm text-[#9F1239]">
          Gagal memuat sebagian data dashboard. Coba muat ulang halaman.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Leads" value={stats?.total ?? "-"} icon={Users2} testId="kpi-total-leads" />
        <KpiCard
          label="Nasabah"
          value={stats?.by_type?.nasabah ?? 0}
          icon={TrendingUp}
          testId="kpi-total-nasabah"
        />
        <KpiCard
          label="Pelamar Kerja"
          value={stats?.by_type?.pelamar ?? 0}
          icon={CheckCircle2}
          testId="kpi-total-pelamar"
        />
        <KpiCard
          label="Follow Up Hari Ini"
          value={stats?.follow_up_today ?? 0}
          icon={AlertTriangle}
          testId="kpi-follow-up-today"
        />
      </div>

      {followUps.length > 0 && (
        <div
          className="rounded-xl border border-[#FDE68A] bg-[#FEF3C7] p-4"
          data-testid="follow-up-highlight-banner"
        >
          <p className="flex items-center gap-2 font-heading text-sm font-semibold text-[#92400E]">
            <AlertTriangle className="h-4 w-4" />
            Follow-Up Hari Ini / Terlewat ({followUps.length})
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {followUps.slice(0, 5).map((lead) => (
              <button
                key={lead.id}
                type="button"
                data-testid={`follow-up-item-${lead.id}`}
                onClick={() => setActiveLeadId(lead.id)}
                className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-left transition-colors duration-200 hover:bg-white"
              >
                <span className="text-sm font-medium text-[#0F172A]">{lead.nama}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#92400E]">{lead.tanggal_follow_up}</span>
                  <StatusBadge status={lead.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-heading text-sm font-semibold text-[#0F172A]">Leads Terbaru</p>
          <Link
            to="/leads"
            data-testid="dashboard-view-all-leads-link"
            className="text-sm font-medium text-[#0F766E] transition-colors duration-200 hover:underline"
          >
            Lihat semua →
          </Link>
        </div>
        <div className="flex flex-col divide-y divide-[#F1F5F9]">
          {recent.length === 0 && (
            <p className="py-6 text-center text-sm text-[#94A3B8]">Belum ada data leads.</p>
          )}
          {recent.map((lead) => (
            <button
              key={lead.id}
              type="button"
              data-testid={`recent-lead-row-${lead.id}`}
              onClick={() => setActiveLeadId(lead.id)}
              className="flex items-center justify-between py-3 text-left transition-colors duration-200 hover:bg-slate-50/80"
            >
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{lead.nama}</p>
                <p className="text-xs text-[#94A3B8]">
                  {lead.type === "nasabah" ? "Nasabah" : "Pelamar Kerja"} ·{" "}
                  {lead.assigned_to_name ?? "Belum ditugaskan"}
                </p>
              </div>
              <StatusBadge status={lead.status} />
            </button>
          ))}
        </div>
      </div>

      <LeadDetailSheet leadId={activeLeadId} onOpenChange={(open) => !open && setActiveLeadId(null)} />
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}
