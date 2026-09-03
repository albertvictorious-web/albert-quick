// Hand-written mirrors of the backend Pydantic models — nothing infers across the
// Python↔TypeScript boundary, so these interfaces are kept in sync manually.
export type Role = "admin" | "marketing";
export type LeadType = "nasabah" | "pelamar";

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface ProgressNote {
  id: string;
  text: string;
  status?: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface Lead {
  id: string;
  type: LeadType;
  nama: string;
  no_wa: string;
  usia?: number | null;
  kota?: string | null;
  profesi?: string | null;
  pernah_trading?: string | null;
  sumber?: string | null;
  pendidikan?: string | null;
  cv_file_id?: string | null;
  cv_filename?: string | null;
  status: string;
  catatan?: string | null;
  tanggal_follow_up?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  notes: ProgressNote[];
  // Admin-defined extra columns, keyed by CustomField.key.
  custom: Record<string, string>;
}

// Mirrors CustomField in backend/models/custom_field.py
export interface CustomField {
  id: string;
  key: string;
  label: string;
  created_at: string;
}

// Mirrors DeleteAllResult in backend/models/custom_field.py
export interface DeleteAllResult {
  deleted: number;
  nasabah: number;
  pelamar: number;
}

// Mirrors ImportResult in backend/models/lead.py
export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

// Mirrors ImportField in backend/models/lead.py
export interface ImportField {
  key: string;
  label: string;
  required: boolean;
}

// Mirrors ImportPreview in backend/models/lead.py
export interface ImportPreview {
  headers: string[];
  mapping: Record<string, string | null>;
  fields: ImportField[];
  sample_rows: Record<string, string>[];
  total_rows: number;
  unmapped_headers: string[];
  existing_custom: ImportField[];
}

// Mirrors UploadedFile in backend/models/lead.py
export interface UploadedFile {
  file_id: string;
  filename: string;
  size: number;
}

// Mirrors Catatan in backend/models/ops.py
export interface Catatan {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  body: string;
  lead_id?: string | null;
  lead_nama?: string | null;
  created_at: string;
  updated_at: string;
}

// Mirrors Jadwal in backend/models/ops.py
export interface Jadwal {
  id: string;
  client_nama: string;
  marketing_id: string;
  marketing_name: string;
  lokasi: string;
  tanggal: string;
  jam: string;
  kendaraan: string;
  status: string;
  hasil_pertemuan?: string | null;
  lead_id?: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

// Mirrors JadwalReminder in backend/models/ops.py
export interface JadwalReminder {
  id: string;
  client_nama: string;
  marketing_name: string;
  lokasi: string;
  tanggal: string;
  jam: string;
  kendaraan: string;
  overdue: boolean;
  soon: boolean;
  minutes_until: number;
}

// Mirrors DealTrendPoint in backend/models/lead.py
export interface DealTrendPoint {
  month: string;
  label: string;
  deals: number;
  nasabah: number;
  pelamar: number;
}

// Mirrors RekapMarketing / RekapSumber / RekapBulanan in backend/routers/rekap.py
export interface RekapMarketing {
  marketing_id: string;
  marketing_name: string;
  deals: number;
  leads_masuk: number;
  jadwal: number;
  jadwal_selesai: number;
  target_deals: number;
  target_progress: number;
}

export interface RekapSumber {
  sumber: string;
  type: string;
  total: number;
  won: number;
  conversion_rate: number;
}

export interface RekapBulanan {
  month: string;
  label: string;
  total_leads_masuk: number;
  total_deals: number;
  total_jadwal: number;
  total_jadwal_selesai: number;
  per_marketing: RekapMarketing[];
  per_sumber: RekapSumber[];
}

// Mirrors RekapProspek in backend/models/ops.py
export interface RekapProspek {
  marketing_id: string;
  marketing_name: string;
  month: string;
  total: number;
  terjadwal: number;
  selesai: number;
  dibatalkan: number;
  ada_hasil: number;
}

// Mirrors SumberStat in backend/models/lead.py
export interface SumberStat {
  sumber: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  conversion_rate: number;
}

export const SUMBER_OPTIONS = [
  "Instagram",
  "Facebook",
  "YouTube",
  "TikTok",
  "Google",
  "Teman/Keluarga",
  "Komunitas Trading",
  "Iklan/Ads",
  "Referral IB/Partner",
];

export const SUMBER_PELAMAR_OPTIONS = [
  "JobStreet",
  "LinkedIn",
  "Instagram",
  "TikTok",
  "Facebook",
  "Website Karir",
  "Teman/Keluarga",
  "Job Fair",
  "Referral Internal",
];

export const PENDIDIKAN_OPTIONS = ["SMP", "SMA", "Diploma", "Sarjana"];
export const TRADING_OPTIONS = ["Ya", "Belum"];
export const KENDARAAN_OPTIONS = [
  "Mobil Pribadi",
  "Motor",
  "Kendaraan Kantor",
  "Transportasi Online",
  "Lainnya",
];
export const JADWAL_STATUSES = ["Terjadwal", "Selesai", "Dibatalkan"];

export interface LeadStats {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_marketing: Record<string, number>;
  follow_up_today: number;
}

// Mirrors FollowUpNotification in backend/models/lead.py
export interface FollowUpNotification {
  id: string;
  nama: string;
  type: LeadType;
  status: string;
  tanggal_follow_up: string;
  assigned_to_name?: string | null;
  overdue: boolean;
}

// Mirrors TeamPerformance in backend/models/lead.py
export interface TeamPerformance {
  marketing_id?: string | null;
  marketing_name: string;
  total: number;
  open: number;
  closed_won: number;
  closed_lost: number;
  conversion_rate: number;
  target_deals: number;
  achieved_this_month: number;
  target_progress: number;
}

// Mirrors MarketingTarget in backend/models/ops.py
export interface MarketingTarget {
  marketing_id: string;
  marketing_name: string;
  month: string;
  target_deals: number;
  achieved: number;
  progress: number;
}

// Mirrors Transfer in backend/models/ops.py
export interface Transfer {
  id: string;
  lead_id: string;
  lead_nama: string;
  from_id?: string | null;
  from_name: string;
  to_id: string;
  to_name: string;
  by_id: string;
  by_name: string;
  mode: string;
  created_at: string;
}

// Mirrors AutoDistributeResult in backend/models/ops.py
export interface AutoDistributeResult {
  distributed: number;
  per_marketing: Record<string, number>;
}

export const TRANSFER_MODE_LABELS: Record<string, string> = {
  single: "Manual",
  bulk: "Bulk Assign",
  auto: "Auto Bagi Rata",
};

// Mirrors BulkAssignResult in backend/models/lead.py
export interface BulkAssignResult {
  updated: number;
  assigned_to_name: string;
}

// A lead in one of these statuses is closed — mirrors TERMINAL_STATUSES in routers/leads.py
export const TERMINAL_STATUSES = ["Deal", "Gagal", "Diterima", "Ditolak"];

export const NASABAH_STATUSES = ["Baru", "Diproses", "Follow Up", "Deal", "Gagal"] as const;
export const PELAMAR_STATUSES = ["Baru", "Interview", "Diterima", "Ditolak"] as const;

export const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Baru: { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  Diproses: { bg: "#EEF2FF", text: "#3730A3", border: "#C7D2FE" },
  "Follow Up": { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  Deal: { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  Gagal: { bg: "#FFE4E6", text: "#9F1239", border: "#FECDD3" },
  Interview: { bg: "#F3E8FF", text: "#6B21A8", border: "#E9D5FF" },
  Diterima: { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  Ditolak: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
};
