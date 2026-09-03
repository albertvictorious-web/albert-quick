import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, CalendarClock, MapPin, Car } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import StatusBadge from "@/components/StatusBadge";
import { apiGet } from "@/lib/api";
import type { FollowUpNotification, JadwalReminder } from "@/lib/types";

// Polled every 20s so a lead crossing its follow-up date — or an appointment reaching
// its day — surfaces without a page reload.
const POLL_MS = 20000;

export default function NotificationBell({
  onSelectLead,
}: {
  onSelectLead: (leadId: string) => void;
}) {
  const navigate = useNavigate();

  const { data, error } = useQuery<FollowUpNotification[]>({
    queryKey: ["follow-up-notifications"],
    queryFn: () => apiGet<FollowUpNotification[]>("/leads/notifications"),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  const { data: jadwalData, error: jadwalError } = useQuery<JadwalReminder[]>({
    queryKey: ["jadwal-reminders"],
    queryFn: () => apiGet<JadwalReminder[]>("/jadwal/reminders"),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  const items = error ? [] : (data ?? []);
  const jadwal = jadwalError ? [] : (jadwalData ?? []);
  const count = items.length + jadwal.length;

  const knownIdsRef = useRef<Set<string> | null>(null);
  const knownJadwalRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (error || !data) return;
    const currentIds = new Set(data.map((n) => n.id));
    // First successful load only primes the baseline — no toast storm on mount.
    if (knownIdsRef.current === null) {
      knownIdsRef.current = currentIds;
      return;
    }
    const fresh = data.filter((n) => !knownIdsRef.current?.has(n.id));
    knownIdsRef.current = currentIds;
    for (const n of fresh.slice(0, 3)) {
      toast.warning(`Waktunya follow up: ${n.nama}`, {
        description: n.overdue
          ? `Terlambat sejak ${n.tanggal_follow_up}`
          : `Jatuh tempo hari ini (${n.tanggal_follow_up})`,
      });
    }
  }, [data, error]);

  useEffect(() => {
    if (jadwalError || !jadwalData) return;
    const currentIds = new Set(jadwalData.map((j) => j.id));
    if (knownJadwalRef.current === null) {
      knownJadwalRef.current = currentIds;
      return;
    }
    const fresh = jadwalData.filter((j) => !knownJadwalRef.current?.has(j.id));
    knownJadwalRef.current = currentIds;
    for (const j of fresh.slice(0, 3)) {
      toast.info(`Jadwal prospek: ${j.client_nama}`, {
        description: j.overdue
          ? `Terlewat (${j.tanggal} ${j.jam}) — belum ada hasil pertemuan`
          : `Hari ini pukul ${j.jam} di ${j.lokasi}`,
      });
    }
  }, [jadwalData, jadwalError]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="notification-bell-button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition-colors duration-200 hover:bg-[#F8FAFC]"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span
            data-testid="notification-unread-count"
            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B45309] px-1 text-[10px] font-bold text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[350px]">
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-[#0F172A]">
          <CalendarClock className="h-4 w-4 text-[#B45309]" />
          Notifikasi ({count})
        </div>
        <DropdownMenuSeparator />

        {count === 0 && (
          <p
            data-testid="notification-empty-state"
            className="px-2 py-6 text-center text-sm text-[#94A3B8]"
          >
            Tidak ada follow up atau jadwal prospek saat ini.
          </p>
        )}

        {jadwal.length > 0 && (
          <>
            <p
              data-testid="notification-jadwal-heading"
              className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]"
            >
              Jadwal Prospek ({jadwal.length})
            </p>
            {jadwal.slice(0, 4).map((j) => (
              <DropdownMenuItem
                key={j.id}
                data-testid={`notification-jadwal-item-${j.id}`}
                onClick={() => navigate("/jadwal-prospek")}
                className="flex-col items-start gap-1 py-2.5"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#0F172A]">{j.client_nama}</span>
                  <span
                    className={`text-[11px] font-semibold ${
                      j.overdue ? "text-[#B45309]" : "text-[#0F766E]"
                    }`}
                  >
                    {j.overdue ? "Terlewat" : "Hari ini"} · {j.jam}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#475569]">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {j.lokasi}
                  </span>
                  <span className="flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {j.kendaraan}
                  </span>
                  <span>· {j.marketing_name}</span>
                </div>
              </DropdownMenuItem>
            ))}
            {items.length > 0 && <DropdownMenuSeparator />}
          </>
        )}

        {items.length > 0 && (
          <p
            data-testid="notification-followup-heading"
            className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]"
          >
            Follow Up Leads ({items.length})
          </p>
        )}
        {items.slice(0, 6).map((n) => (
          <DropdownMenuItem
            key={n.id}
            data-testid={`notification-item-${n.id}`}
            onClick={() => onSelectLead(n.id)}
            className="flex-col items-start gap-1 py-2.5"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#0F172A]">{n.nama}</span>
              <StatusBadge status={n.status} />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#475569]">
              {n.overdue && <AlertTriangle className="h-3 w-3 text-[#B45309]" />}
              <span className={n.overdue ? "font-medium text-[#B45309]" : ""}>
                {n.overdue
                  ? `Terlambat · ${n.tanggal_follow_up}`
                  : `Hari ini · ${n.tanggal_follow_up}`}
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span>{n.type === "nasabah" ? "Nasabah" : "Pelamar Kerja"}</span>
              {n.assigned_to_name && (
                <>
                  <span className="text-[#CBD5E1]">•</span>
                  <span>{n.assigned_to_name}</span>
                </>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {items.length > 6 && (
          <p className="px-2 py-1.5 text-center text-[11px] text-[#94A3B8]">
            +{items.length - 6} leads lainnya perlu di-follow up
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
