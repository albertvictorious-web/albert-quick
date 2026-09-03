# QuickPro Leads CRM — Spec

Internal CRM (Bahasa Indonesia) for a trading/brokerage office: manages **Nasabah** (client
leads) and **Pelamar Kerja** (job applicant leads), the marketing team that works them, their
prospecting appointments and their personal notes.

## Roles & Auth
- Session auth via httpOnly JWT cookie (`/api/auth/*`), 7-day expiry, bcrypt hashes.
- **Admin**: sees/manages everything — all leads, marketing accounts (create / rename / change
  email / reset password / delete), lead assignment, bulk import, monthly targets, transfer log,
  all notes (read-only), all schedules.
- **Marketing**: only leads where `assigned_to == own id` (enforced server-side on every
  read/write; 403 even by direct ID), own notes, own schedules.
- Password: `POST /api/auth/change-password` (own, needs current password, min 6 chars);
  `PATCH /api/auth/marketing/{id}` (admin edits name/email/password; renames cascade to
  `leads.assigned_to_name` and `jadwal.marketing_name`).

## Data Model
- `users`: id, name, email, role (admin|marketing), password_hash, created_at.
- `leads`: id, type (nasabah|pelamar), **shared**: nama, no_wa, usia, kota;
  **nasabah**: profesi, pernah_trading (Ya|Belum), sumber (Instagram, Facebook, YouTube, TikTok,
  Google, Teman/Keluarga, Komunitas Trading, Iklan/Ads, Referral IB/Partner);
  **pelamar**: pendidikan (SMP|SMA|Diploma|Sarjana), cv_file_id, cv_filename;
  **workflow**: status, catatan, tanggal_follow_up, assigned_to(+_name), created_by(+_name),
  created_at, updated_at, closed_at, notes[] (ProgressNote).
- Nasabah statuses: Baru, Diproses, Follow Up, Deal, Gagal. Pelamar: Baru, Interview, Diterima,
  Ditolak. Won = Deal|Diterima, Lost = Gagal|Ditolak, terminal = all four.
- `files`: CV PDFs stored base64 in Mongo (max 5MB, PDF only) — survives redeploys, no local disk.
- `targets`: {marketing_id, month YYYY-MM, target_deals}. `transfers`: hand-over audit log.
- `catatan`: {user_id, user_name, title, body, lead_id?, lead_nama?} — private to author.
- `jadwal`: {client_nama, marketing_id(+_name), lokasi, tanggal, jam, kendaraan, status
  (Terjadwal|Selesai|Dibatalkan), hasil_pertemuan}. Kendaraan options: Mobil Pribadi, Motor,
  Kendaraan Kantor, Transportasi Online, Lainnya.

## Pages / Flows
- `/login` → `/` Dashboard: KPI cards, overdue follow-up banner, recent leads; admin also gets the
  team performance chart (grouped bars + conversion + monthly-target bars), marketing gets their
  own target card.
- `/leads`: tabs Nasabah/Pelamar, search (nama/no_wa/kota), status + marketing filters (incl.
  "Belum Ditugaskan"), row → detail sheet (fields, CV link, progress notes, reschedule follow-up,
  assign/transfer, delete when allowed). Admin-only: checkbox bulk assign, **Upload CSV** import
  (`/api/leads/import` + `/api/leads/import-template`), **Auto Bagi Rata** round-robin. Everyone:
  Export CSV honouring current filters and role scope.
- **Delete rule**: admin deletes any lead; marketing only leads where they are both
  `created_by` and `assigned_to` (i.e. self-added, not admin-given) — else 403.
- `/jadwal-prospek`: create appointment (admin picks the marketing owner, marketing schedules for
  self), fill `hasil_pertemuan` after the meeting → status auto-flips to Selesai. Marketing sees
  own only; admin sees the whole team. Page also carries the **Rekap Prospek** panel with a month
  picker (`GET /jadwal/rekap?month=YYYY-MM`): per-marketing total / terjadwal / selesai /
  dibatalkan / hasil-terisi — admin sees every marketing user, marketing only itself.
- **Notification bell** (topbar, every page, 20s poll) has two sections:
  *Jadwal Prospek* from `GET /jadwal/reminders` — appointments still `Terjadwal` whose date is
  today or past (`overdue` flag); reporting the outcome removes them. Clicking one goes to
  `/jadwal-prospek`. *Follow Up Leads* from `GET /leads/notifications`; clicking one opens the lead
  sheet. Newly appearing items also raise a toast. Both endpoints are role-scoped.
- **Performa Sumber Leads** (dashboard, both roles, role-scoped): `GET /leads/sumber-stats` returns
  per-channel total / won / lost / open / conversion for nasabah, sorted by deals won, with a
  "Terbaik" chip. `/leads` has a matching **Sumber** filter (nasabah tab only; hidden on Pelamar)
  that also flows into the CSV export.
- `/catatan`: personal notes, optional lead link (only a lead the author may see). Admin views all
  but cannot edit/delete another user's note (403).
- `/akun-marketing` (admin): create/edit/delete accounts + monthly target panel.
- `/riwayat-perpindahan` (admin): transfer audit log (Manual / Bulk Assign / Auto Bagi Rata).
- `/ganti-password`: self-service password change for both roles.
- **Mobile**: hamburger in the topbar opens a slide-in drawer with the same nav; it auto-closes on
  navigation. Notification bell (20s poll) sits in the topbar on every page.
- No third-party integrations; notifications are in-app only (no email/WA/SMS).

## Seed Data
`backend/seed.py` — 1 admin + 3 marketing, 21 leads (11 nasabah / 10 pelamar) with new field
structure, 3 sample jadwal. `python seed.py` is idempotent; `python seed.py --reset` wipes
leads/jadwal/catatan/transfers and reseeds. Credentials: `memory/test_credentials.md`.
