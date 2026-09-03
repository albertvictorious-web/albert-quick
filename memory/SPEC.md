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
  assign/transfer, delete when allowed). Admin-only: checkbox bulk assign, **Upload Excel / CSV**
  import, **Auto Bagi Rata** round-robin. Everyone:
  Export CSV honouring current filters and role scope.
- **Template-free import** (admin): `POST /leads/import/preview` reads any `.xlsx`, `.xls`, `.xlsm`
  or `.csv` (max 5 MB, first sheet, delimiter sniffed for CSV) and returns headers, sample rows and
  an auto-guessed `mapping` (field key → column) built from `backend/lib/import_mapping.py` aliases
  ("Nama Lengkap"→nama, "No HP"/"WhatsApp"→no_wa, "Umur"→usia, "Domisili"→kota, …). The dialog shows
  that guess for the admin to correct, then `POST /leads/import` takes the same file plus the
  confirmed `mapping` JSON and a `lead_type` (nasabah|pelamar) applied to every row unless the file
  carries its own tipe column. Columns nobody mapped are either promoted to a **custom field**
  (checkbox + editable label in the dialog, sent as `custom_columns` JSON) or appended to each lead
  as a ProgressNote ("Data tambahan dari file import — …") so no data is lost.
  `GET /leads/import-template` still serves the old CSV template, now optional.
- **Custom columns** (`custom_fields` collection: id, key, label, created_at): admin-defined extra
  lead fields stored on `leads.custom[key]`. `GET /custom-fields` (any role), `POST` / `PATCH` /
  `DELETE /custom-fields/{id}` (admin, max 30; delete also `$unset`s the value from every lead;
  rename changes only the label so stored values survive). Managed at **`/kolom-custom`** (admin
  nav) or created on the fly during import. They appear in the Tambah Leads form, the lead detail
  sheet, and as extra columns at the end of the leads CSV export.
- **Hapus Semua Data** (admin, `/leads` toolbar): `DELETE /leads/all?confirm=HAPUS` wipes every
  nasabah + pelamar lead in one action and clears the lead link on personal notes. The UI requires
  typing "HAPUS"; the backend rejects any call without the matching confirm token (400).
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
- **Tren Deal per Bulan** (dashboard, both roles, role-scoped): `GET /leads/deal-trend?months=6`
  returns one point per month (month, label, deals, nasabah, pelamar) counted by `closed_at`
  (fallback `updated_at`) for won statuses; area chart + delta chip vs the previous month.
- `/rekap-bulanan` (admin only): month picker → `GET /rekap/bulanan?month=YYYY-MM` with 4 KPIs
  (leads masuk, deal, jadwal, jadwal selesai), a per-marketing table (deal / leads masuk / jadwal
  / selesai / target progress) and a per-sumber table (total / deal / konversi, nasabah + pelamar).
  `GET /rekap/export?month=` streams the same recap as a UTF-8 BOM CSV the admin can archive.
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
