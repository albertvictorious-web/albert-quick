import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, CalendarClock } from "lucide-react";
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
import type { FollowUpNotification } from "@/lib/types";

// Polled every 20s so a lead crossing its follow-up date surfaces without a page reload.
const POLL_MS = 20000;

export default function NotificationBell({
  onSelectLead,
}: {
  onSelectLead: (leadId: string) => void;
}) {
  const { data, error } = useQuery<FollowUpNotification[]>({
    queryKey: ["follow-up-notifications"],
    queryFn: () => apiGet<FollowUpNotification[]>("/leads/notifications"),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  const items = error ? [] : (data ?? []);
  const count = items.length;
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (error) return;
    if (!data) return;
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
      <DropdownMenuContent align="end" sideOffset={8} className="w-[340px]">
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-[#0F172A]">
          <CalendarClock className="h-4 w-4 text-[#B45309]" />
          Notifikasi Follow Up ({count})
        </div>
        <DropdownMenuSeparator />
        {count === 0 && (
          <p
            data-testid="notification-empty-state"
            className="px-2 py-6 text-center text-sm text-[#94A3B8]"
          >
            Tidak ada leads yang perlu di-follow up saat ini.
          </p>
        )}
        {items.slice(0, 8).map((n) => (
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
                {n.overdue ? `Terlambat · ${n.tanggal_follow_up}` : `Hari ini · ${n.tanggal_follow_up}`}
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
        {count > 8 && (
          <p className="px-2 py-1.5 text-center text-[11px] text-[#94A3B8]">
            +{count - 8} leads lainnya perlu di-follow up
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
