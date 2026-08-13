import { STATUS_STYLES } from "@/lib/types";

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
  return (
    <span
      data-testid={`status-badge-${status.toLowerCase().replace(/\s+/g, "-")}`}
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
    >
      {status}
    </span>
  );
}
