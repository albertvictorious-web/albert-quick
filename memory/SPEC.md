# QuickPro Leads CRM — Spec

Internal CRM for managing two lead types: **Nasabah** (customer/bank-product leads) and
**Pelamar Kerja** (job applicant leads), used by an office marketing team.

## Roles & Auth
- Session-based auth via httpOnly JWT cookie (`/api/auth/*`), 7-day expiry.
- **Admin**: sees/manages all leads, creates leads (optionally pre-assigned), creates/deletes
  marketing accounts, reassigns/transfers any lead.
- **Marketing**: sees/manages ONLY leads where `assigned_to == own id`. Backend enforces this on
  every read/write (`check_access` in `backend/routers/leads.py`) — a marketing user gets `403`
  reading or editing another marketing's lead, even by direct ID.
- Marketing can transfer their own lead to another marketing user (self-service handover) via
  `POST /api/leads/{id}/assign`. Both roles can list the marketing roster via
  `GET /api/leads/assignable-marketing`.

## Data Model
- `User` (in `db.users`): id, name, email, role (admin|marketing), password_hash, created_at.
- `Lead` (in `db.leads`): id, type (nasabah|pelamar), nama, no_hp, email, alamat, produk, posisi,
  nik, tanggal_lahir, sumber, status, catatan, tanggal_follow_up, assigned_to/assigned_to_name,
  created_by/created_by_name, created_at, updated_at, notes[] (ProgressNote: text, status,
  created_by_name, created_at).
- Nasabah statuses: Baru, Diproses, Follow Up, Deal, Gagal.
- Pelamar statuses: Baru, Interview, Diterima, Ditolak.

## Key Flows
- Login (`/login`) → Dashboard (`/`) with KPI cards, follow-up-today highlight banner, recent
  leads. `/leads` — tabbed table (Nasabah/Pelamar) with search/status/marketing filters, "Tambah
  Leads" dialog, row click opens a detail Sheet with info, add-progress-note timeline, and
  assign/transfer control. `/akun-marketing` (admin only) — create/delete marketing accounts.
- No third-party integrations used; auth is self-hosted (passlib bcrypt + PyJWT).

## Seed Data
`backend/seed.py` (idempotent) seeds 1 admin + 3 marketing accounts and 21 leads (11 nasabah,
10 pelamar) with varied statuses/follow-up dates. Re-run: `cd backend && python seed.py`.
