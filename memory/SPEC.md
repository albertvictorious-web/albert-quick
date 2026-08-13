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
  Leads" dialog, row click opens a detail Sheet with info, add-progress-note timeline, reschedule
  follow-up date, and assign/transfer control. `/akun-marketing` (admin only) — create/delete
  marketing accounts.
- **In-app follow-up notifications** (no email/WA): a bell in the topbar (present on every page)
  polls `GET /api/leads/notifications` every 20s and shows the count of leads whose
  `tanggal_follow_up` has arrived or passed and whose status is still open (terminal statuses
  Deal/Gagal/Diterima/Ditolak are excluded). Newly-due leads also raise a sonner toast. Clicking a
  notification opens that lead's detail sheet; rescheduling the follow-up date removes it from the
  list. The endpoint is role-scoped identically to `/leads` — marketing only ever sees their own.
- **Team performance chart** (admin only, on the dashboard): `GET /api/leads/team-performance`
  (admin-only, 403 for marketing) returns per-marketing total / open / closed_won / closed_lost /
  conversion_rate, plus a "Belum Ditugaskan" row. Rendered as a grouped recharts bar chart with a
  top-performer chip and per-marketing summary tiles. Won = Deal|Diterima, Lost = Gagal|Ditolak.
- **Bulk assign** (admin only, on `/leads`): a checkbox column plus select-all reveals a toolbar
  with a marketing picker; `POST /api/leads/bulk-assign {lead_ids, assigned_to}` (admin-only; 400
  on an empty list) assigns many leads at once. The marketing filter has a "Belum Ditugaskan"
  option (`GET /api/leads?assigned_to=unassigned`) for working the unassigned pool.
- No third-party integrations used; auth is self-hosted (passlib bcrypt + PyJWT).

## Seed Data
`backend/seed.py` (idempotent) seeds 1 admin + 3 marketing accounts and 21 leads (11 nasabah,
10 pelamar) with varied statuses/follow-up dates. Re-run: `cd backend && python seed.py`.
