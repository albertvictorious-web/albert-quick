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
  no_hp: string;
  email?: string | null;
  alamat?: string | null;
  produk?: string | null;
  posisi?: string | null;
  nik?: string | null;
  tanggal_lahir?: string | null;
  sumber: string;
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
}

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
}

// Mirrors BulkAssignResult in backend/models/lead.py
export interface BulkAssignResult {
  updated: number;
  assigned_to_name: string;
}

// A lead in one of these statuses is closed — mirrors TERMINAL_STATUSES in routers/leads.py
export const TERMINAL_STATUSES = ["Deal", "Gagal", "Diterima", "Ditolak"];

export const NASABAH_STATUSES = ["Baru", "Diproses", "Follow Up", "Deal", "Gagal"] as const;
export const PELAMAR_STATUSES = ["Baru", "Interview", "Diterima", "Ditolak"] as const;

export const PRODUK_OPTIONS = [
  "KPR / Kredit Pemilikan Rumah",
  "Deposito Berjangka",
  "Tabungan Bisnis",
  "Kredit Usaha Rakyat (KUR)",
  "Kartu Kredit Corporate",
  "Asuransi / Bancassurance",
];

export const SUMBER_NASABAH_OPTIONS = [
  "Website QuickPro",
  "Meta Ads (Facebook/IG)",
  "Referral Sales",
  "Walk-in Branch",
  "Telemarketing",
  "Pameran / Event",
];

export const POSISI_OPTIONS = [
  "Sales Executive",
  "Marketing Officer",
  "Admin Staff",
  "Digital Marketer",
  "Branch Supervisor",
  "Customer Service",
];

export const SUMBER_PELAMAR_OPTIONS = [
  "JobStreet",
  "LinkedIn",
  "Instagram Career",
  "Referral Internal",
  "Website Karir",
  "Bursa Kerja / Job Fair",
];

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
