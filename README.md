# QuickPro Leads CRM

Aplikasi CRM internal untuk mengelola **leads nasabah** dan **pelamar kerja**
sebuah kantor pemasaran. Dibuat dengan satu aturan utama: **setiap marketing
hanya boleh melihat leads miliknya sendiri**, sementara admin melihat dan
mengatur semuanya. Aturan itu tidak cuma disembunyikan di tampilan — backend
yang menolaknya, jadi tidak bisa diakali lewat URL atau memanggil API langsung.

Antarmuka sepenuhnya Bahasa Indonesia, termasuk pesan error yang dilihat
pengguna.

---

## Daftar isi

- [Apa yang bisa dilakukan aplikasi ini](#apa-yang-bisa-dilakukan-aplikasi-ini)
- [Teknologi yang dipakai](#teknologi-yang-dipakai)
- [Arsitektur](#arsitektur)
- [Aturan `/api`: satu prefix untuk semuanya](#aturan-api-satu-prefix-untuk-semuanya)
- [Struktur direktori](#struktur-direktori)
- [Peta endpoint backend](#peta-endpoint-backend)
- [Halaman frontend](#halaman-frontend)
- [Model data](#model-data)
- [Dua peran pengguna](#dua-peran-pengguna)
- [Autentikasi](#autentikasi)
- [Menjalankan di lokal](#menjalankan-di-lokal)
- [Environment variables](#environment-variables)
- [Deploy](#deploy)
- [Pengujian](#pengujian)
- [Keputusan teknis dan alasannya](#keputusan-teknis-dan-alasannya)

---

## Apa yang bisa dilakukan aplikasi ini

**Mengelola leads**
Dua jenis leads dengan field dan alur status yang berbeda.
Nasabah bergerak dari `Baru → Diproses → Follow Up → Deal / Gagal`, sedangkan
pelamar kerja `Baru → Interview → Diterima / Ditolak`. Tiap leads punya
linimasa catatan progres bertanggal, jadi riwayat percakapannya tidak hilang.

**Membagi leads ke tim**
Admin bisa menugaskan satu per satu, memilih banyak leads sekaligus
(bulk assign), atau memakai **Auto Bagi Rata** yang membagi semua leads belum
bertuan secara bergiliran. Setiap perpindahan tangan tercatat di halaman
Riwayat Perpindahan: dari siapa, ke siapa, oleh siapa, kapan, dan metodenya.

**Impor dari Excel tanpa template**
Unggah `.xlsx`, `.xlsm`, `.xls`, atau `.csv` apa adanya. Sistem menebak sendiri
kolom mana untuk field mana — "Nama Lengkap" → Nama, "No. HP / WhatsApp" → No.
WhatsApp, "Umur" → Usia, dan seterusnya. Sebelum data masuk, tampil layar
konfirmasi pemetaan yang bisa dikoreksi, plus contoh 5 baris pertama. Kolom
yang tidak dikenali tidak dibuang: bisa dijadikan kolom permanen, atau
disimpan sebagai catatan di leads terkait.

**Kolom custom**
Admin bisa menambah field sendiri (misal Alamat Lengkap, Kode Referensi) sampai
30 kolom. Kolom custom otomatis ikut muncul di form tambah leads, panel detail,
dan hasil Export CSV.

**Jadwal prospek**
Catat rencana pertemuan: klien, marketing, lokasi, tanggal, jam, kendaraan.
Setelah pertemuan, hasilnya diisi dan status otomatis menjadi Selesai.
Notifikasi mengingatkan jadwal hari ini dan jadwal terlewat yang hasilnya
belum diisi.

**Laporan**
Dashboard berisi KPI, grafik performa tim, tren deal per bulan, dan performa
tiap sumber leads. Halaman Rekap Bulanan (khusus admin) merangkum per marketing
dan per sumber, dengan pemilih bulan dan unduh CSV.

**Pendukung**
Catatan pribadi tiap marketing, target deal bulanan beserta progresnya,
unggah CV pelamar dalam PDF, dan menu drawer untuk layar ponsel.

---

## Teknologi yang dipakai

### Backend

| Teknologi | Peran |
|---|---|
| **Python 3.12** | Runtime |
| **FastAPI** | Framework web. Async penuh, plus dokumentasi OpenAPI otomatis di `/docs` |
| **Pydantic v2** | Validasi request dan bentuk response. Body yang tidak sesuai model ditolak `422` sebelum menyentuh kode kita |
| **Motor** | Driver MongoDB async (`await` pada setiap query, bukan blocking) |
| **MongoDB** | Database. Lokal saat development, MongoDB Atlas di produksi |
| **PyJWT + passlib/bcrypt** | Token sesi dan hash password |
| **openpyxl / xlrd** | Membaca `.xlsx`/`.xlsm` dan `.xls` saat impor leads. CSV memakai modul `csv` bawaan |

### Frontend

| Teknologi | Peran |
|---|---|
| **React 19 + TypeScript** | UI, mode `strict` |
| **Vite** | Dev server dan bundler produksi |
| **Tailwind CSS v4** | Styling |
| **shadcn/ui** (di atas Base UI) | Komponen dasar: dialog, table, select, sheet, tabs, dan lainnya |
| **TanStack Query** | Pengambilan data, cache, dan invalidasi setelah mutasi |
| **React Router v7** | Routing sisi klien |
| **Recharts** | Grafik performa tim dan tren deal |
| **Sonner** | Notifikasi toast |
| **Lucide** | Ikon |

### Infrastruktur

**Vercel** (frontend + backend) dan **MongoDB Atlas** (database). Hanya dua,
tanpa server backend terpisah dan tanpa object storage.

---

## Arsitektur

Frontend dan backend adalah dua hal terpisah yang **disajikan dari satu
origin**. Ini keputusan yang paling banyak berpengaruh ke kode: karena satu
domain, tidak ada CORS yang perlu diatur dan cookie sesi `httpOnly` langsung
bekerja tanpa konfigurasi lintas domain.

### Saat development

```
   Browser
      |
      |  http://localhost:3000
      v
  Vite dev server ──────── /api/* di-proxy ────────> uvicorn :8001
  (React, HMR)                                       (FastAPI)
                                                          |
                                                          v
                                                    MongoDB lokal
```

### Saat produksi di Vercel

```
              https://nama-project.vercel.app
                            |
        +------------------- + -------------------+
        |                                         |
   /api/*                                       /*
        |                                         |
        v                                         v
  Python Function                        Static files
  (api/index.py -> FastAPI)              (hasil build Vite)
        |
        v
   MongoDB Atlas
```

Yang menentukan pembagian di atas adalah `vercel.json`: request `/api/*`
diarahkan ke fungsi Python, sisanya dikembalikan sebagai `index.html` supaya
route React seperti `/rekap-bulanan` tidak menghasilkan 404 saat di-refresh.

Perhatikan bahwa **tidak ada perbedaan kode** antara dua mode di atas.
Frontend selalu memanggil path relatif; yang berbeda hanya siapa yang meneruskan
`/api` ke FastAPI — Vite di lokal, Vercel di produksi.

---

## Aturan `/api`: satu prefix untuk semuanya

Ini konvensi terpenting di repo ini. Kalau dilanggar, gejalanya membingungkan:
endpoint jalan di lokal tapi 404 di produksi, atau sebaliknya frontend menerima
HTML padahal mengharapkan JSON.

**Aturannya:**

1. `server.py` membuat satu `APIRouter(prefix="/api")`, dan **semua** router
   didaftarkan ke situ. Tidak ada route yang ditempel langsung ke `app` —
   route seperti itu akan berada di luar `/api` dan tidak akan pernah
   terjangkau lewat proxy maupun rewrite Vercel.
2. Frontend **selalu** memakai path relatif. `frontend/src/lib/api.ts`
   menyimpan `BASE = "/api"`, sehingga `apiGet("/leads")` menjadi `/api/leads`.
   Tidak ada URL backend absolut di kode frontend — karena itu frontend juga
   tidak butuh environment variable sama sekali.
3. Rewrite di Vercel bersifat **identitas**: `/api/:path*` → `/api/:path*`.
   Artinya fungsi Python menerima path lengkap `/api/leads`, bukan `/leads`.
   Karena itu prefix `/api` di FastAPI **harus dipertahankan** — jangan
   dihapus dengan asumsi platform sudah memotongnya.

---

## Struktur direktori

```
albert-quick/
├── api/                    Entrypoint khusus Vercel
├── backend/                Aplikasi FastAPI
├── frontend/               Aplikasi React
├── tests/                  Workspace Playwright (end-to-end)
├── .github/                GitHub Actions — pemeriksaan identitas commit (perlu diaktifkan, lihat AGENTS.md)
├── .githooks/              Hook Git bersama (pre-commit)
├── package.json            Penanda project di root agar Root Directory Vercel bisa "./"
├── vercel.json             Konfigurasi routing & build Vercel
├── requirements.txt        Dependency yang di-install Vercel
├── .python-version         Pin versi Python di Vercel
├── .vercelignore           File yang tidak diunggah ke Vercel
├── .gitconfig              Identitas Git repo ini (harus di-include manual)
├── .env.example            Contoh environment variables
├── AGENTS.md               Aturan wajib untuk AI coding agent
├── DEPLOY.md               Panduan deploy langkah demi langkah
├── test_core.py            POC: pembuktian fondasi Atlas & dependency
└── design_guidelines.json  Acuan visual (warna, tipografi, spasi)
```

Berkas di root yang mudah disalahpahami:

| Berkas | Kenapa ada |
|---|---|
| `package.json` | **Tidak punya dependency.** Fungsinya membuat Vercel mengenali project di root, sehingga Root Directory bisa diisi `./` dan folder `api/`, `backend/`, `frontend/` terlihat semua. Seluruh script mendelegasikan ke `frontend/` |
| `requirements.txt` | Dependency Python yang di-install Vercel. Berbeda dari `backend/requirements.txt` yang memuat perkakas development seperti pytest dan mypy |
| `.gitconfig` | Identitas Git yang dijamin cocok dengan akun GitHub. Git tidak membacanya otomatis — aktifkan dengan `git config --local include.path ../.gitconfig` |
| `AGENTS.md` | Aturan yang harus dipatuhi AI coding agent, terutama soal identitas commit yang bisa memblokir deployment Vercel |

### `api/` — jembatan ke Vercel

Isinya satu file, `index.py`, dan sengaja dibiarkan setipis mungkin. Tugasnya
hanya menaruh `backend/` ke `sys.path` lalu mengambil `app` dari `server.py`.
Vercel memuat aplikasi ASGI secara native, jadi **Mangum tidak dipakai**.

Kenapa dipisah begini, bukan memindahkan seluruh backend ke dalam `api/`:
kode aplikasi tetap netral dan perintah `uvicorn server:app` untuk development
tidak berubah sedikit pun. Vercel hanya perlu satu titik masuk yang dikenalinya.

### `backend/` — aplikasi FastAPI

```
backend/
├── server.py           Titik masuk: bikin app, daftarkan semua router, CORS, /api/health
├── seed.py             Isi database dengan akun + data contoh (idempoten)
├── requirements.txt    Dependency development (termasuk pytest, black, mypy)
├── lib/                Kode pendukung yang tidak punya route sendiri
├── models/             Model Pydantic — bentuk request dan response
├── routers/            Endpoint, satu modul per topik
└── tests/              Test pytest yang memukul server yang sedang jalan
```

**`lib/` — perkakas bersama**

| File | Isi |
|---|---|
| `db.py` | Satu-satunya tempat koneksi MongoDB dibuat. Semua modul lain `from lib.db import db`. Client di-cache per event loop agar aman di serverless (lihat [Keputusan teknis](#keputusan-teknis-dan-alasannya)) |
| `auth.py` | Hash & verifikasi password, pembuatan/pembacaan token JWT, dependency `get_current_user` dan `get_current_admin`, serta flag cookie sesi |
| `dates.py` | Penentuan "hari ini" di sisi server. Jam pod adalah UTC, dan tanggal jangan sekali-kali ditentukan dari browser — kalau tidak, "follow up hari ini" akan berbeda-beda tergantung zona waktu perangkat pengguna |
| `tabular.py` | Membaca file unggahan (`.xlsx`/`.xlsm`/`.xls`/`.csv`) menjadi satu baris header + baris-baris string. Semua sel dinormalkan jadi teks yang sudah dipangkas, sehingga jalur impor cuma menghadapi satu bentuk data: angka spreadsheet kehilangan ekor desimalnya (`35.0` → `"35"`) dan tanggal menjadi `YYYY-MM-DD` |
| `import_mapping.py` | Menebak kolom spreadsheet mana untuk field leads mana, sehingga impor tidak memerlukan template |

**`models/` — kontrak data**

| File | Isi |
|---|---|
| `user.py` | `UserPublic`, `UserCreate`, `LoginRequest`, `ChangePasswordRequest`, `MarketingUpdate` |
| `lead.py` | `Lead`, `LeadCreate`, `LeadUpdate`, `ProgressNote`, `LeadStats`, `TeamPerformance`, `SumberStat`, `DealTrendPoint`, `ImportPreview`, `ImportResult`, `UploadedFile`, dan lainnya |
| `ops.py` | Operasional tim: `Jadwal`, `Catatan`, `MarketingTarget`, `Transfer`, `AutoDistributeRequest`, `RekapProspek` |
| `custom_field.py` | `CustomField` beserta variannya, dan `DeleteAllResult` |

Model dipisah dari router dengan sengaja: satu model sering dipakai beberapa
endpoint, dan `UserPublic` khususnya menjamin `password_hash` tidak pernah ikut
terkirim ke klien.

**`routers/` — endpoint**

Satu modul per topik, masing-masing mengekspor `router` sendiri, lalu
digabungkan di `server.py`. Path di dalam modul ditulis tanpa `/api` karena
prefix itu ditambahkan sekali di `server.py`.

| Modul | Cakupan |
|---|---|
| `auth.py` | Login, logout, profil sendiri, kelola akun marketing, ganti password |
| `leads.py` | Inti aplikasi: CRUD leads, statistik, penugasan, impor, ekspor, notifikasi |
| `jadwal.py` | Jadwal prospek, pengingat, rekap prospek |
| `catatan.py` | Catatan pribadi marketing |
| `custom_fields.py` | Kolom buatan admin |
| `targets.py` | Target deal bulanan tiap marketing |
| `transfers.py` | Riwayat perpindahan leads (hanya baca) |
| `rekap.py` | Rekap bulanan dan ekspornya |
| `files.py` | Unggah dan sajikan CV PDF |

### `frontend/` — aplikasi React

```
frontend/
├── index.html
├── vite.config.ts       Dev server :3000, proxy /api -> :8001, alias "@" -> ./src
├── package.json
├── public/              Aset statis (logo.png dipakai sidebar, login, dan favicon)
└── src/
    ├── main.tsx         Bootstrap React
    ├── App.tsx          Definisi route
    ├── index.css        Tailwind v4 + token tema
    ├── lib/             Perkakas non-visual
    ├── components/      Komponen yang dipakai berulang
    └── pages/           Satu file per halaman
```

**`src/lib/`**

| File | Isi |
|---|---|
| `api.ts` | Lapisan fetch bertipe. `BASE = "/api"`, plus `apiGet/apiPost/apiPatch/apiPut/apiDelete` dan kelas `ApiError` yang membawa status HTTP serta body error. Autentikasi menunggangi cookie sesi otomatis — jangan pernah menambahkan header auth di sini |
| `queryClient.ts` | Konfigurasi TanStack Query |
| `session.ts` | Pengguna yang sedang login dan pemeriksaan perannya |
| `types.ts` | Interface TypeScript yang mencerminkan model Pydantic. Tidak ada yang menurunkan tipe otomatis melewati batas Python–TypeScript, jadi kedua sisi ini dijaga manual |
| `utils.ts` | `cn()` untuk menggabungkan class Tailwind |
| `wa.ts` | Membentuk tautan WhatsApp dari nomor telepon |

**`src/components/`**

`ui/` berisi komponen shadcn/ui (badge, button, calendar, card, checkbox,
dialog, dropdown-menu, input, label, popover, select, sheet, sonner, table,
tabs, textarea). Sisanya komponen milik aplikasi ini:

`AppShell` (sidebar, topbar, drawer ponsel), `ProtectedRoute` (penjaga route),
`NotificationBell`, `LeadFormDialog`, `LeadDetailSheet`, `ImportLeadsDialog`,
`AutoDistributeDialog`, `DeleteAllLeadsDialog`, `TeamPerformanceChart`,
`DealTrendChart`, `SumberStatsCard`, `MonthlyTargetsPanel`, `MyTargetCard`,
`RekapProspekPanel`, `StatusBadge`.

### `tests/` — end-to-end

Workspace Playwright dengan `playwright.config.ts` dan `fixtures/helpers.ts`.
Berbeda dari `backend/tests/` yang menguji API, folder ini untuk menguji alur
lewat browser sungguhan.

---

## Peta endpoint backend

Semua diawali `/api`. Kolom "Akses" menunjukkan siapa yang boleh memanggil;
pembatasannya dipaksakan backend, bukan hanya disembunyikan di UI.

### Autentikasi — `/api/auth/*`

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | publik | Mengeluarkan cookie sesi |
| POST | `/auth/logout` | login | Menghapus cookie sesi |
| GET | `/auth/me` | login | Profil pengguna saat ini |
| POST | `/auth/change-password` | login | Perlu password lama |
| GET | `/auth/marketing` | admin | Daftar akun marketing |
| POST | `/auth/marketing` | admin | Buat akun marketing |
| PATCH | `/auth/marketing/{id}` | admin | Ubah nama/email/reset password |
| DELETE | `/auth/marketing/{id}` | admin | Hapus akun |

### Leads — `/api/leads/*`

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/leads` | login | Daftar leads, sudah tersaring sesuai peran |
| POST | `/leads` | login | Tambah leads |
| GET | `/leads/{id}` | login | Detail satu leads |
| PATCH | `/leads/{id}` | login | Ubah field atau status |
| DELETE | `/leads/{id}` | login | Admin bebas; marketing hanya leads buatannya sendiri |
| POST | `/leads/{id}/notes` | login | Tambah catatan progres |
| POST | `/leads/{id}/assign` | login | Tugaskan / pindahkan |
| GET | `/leads/stats` | login | KPI dashboard |
| GET | `/leads/notifications` | login | Follow up hari ini dan yang terlewat |
| GET | `/leads/deal-trend` | login | Tren deal per bulan |
| GET | `/leads/sumber-stats` | login | Performa tiap sumber leads |
| GET | `/leads/team-performance` | admin | Perbandingan antar marketing |
| POST | `/leads/bulk-assign` | admin | Tugaskan banyak leads sekaligus |
| POST | `/leads/auto-distribute` | admin | Bagi rata bergiliran |
| GET | `/leads/assignable-marketing` | login | Kandidat penerima leads. Bukan admin-only, karena marketing juga boleh menyerahkan leads miliknya ke rekan |
| GET | `/leads/export` | login | Export CSV mengikuti filter aktif |
| GET | `/leads/import-template` | admin | Unduh template CSV |
| POST | `/leads/import/preview` | admin | Baca file, kembalikan tebakan pemetaan |
| POST | `/leads/import` | admin | Jalankan impor setelah pemetaan disetujui |
| DELETE | `/leads/all` | admin | Hapus semua leads. Wajib menyertakan token konfirmasi, kalau tidak `400` |

### Operasional

| Prefix | Method & path | Akses | Keterangan |
|---|---|---|---|
| `/jadwal` | GET, POST, PATCH `/{id}`, DELETE `/{id}` | login | Jadwal prospek |
| | GET `/jadwal/reminders` | login | Jadwal hari ini & terlewat |
| | GET `/jadwal/rekap` | login | Rekap per marketing per bulan |
| `/catatan` | GET, POST, PATCH `/{id}`, DELETE `/{id}` | login | Catatan pribadi |
| `/custom-fields` | GET | login | Daftar kolom custom |
| | POST, PATCH `/{id}`, DELETE `/{id}` | admin | Kelola kolom custom |
| `/targets` | GET `/targets/me` | login | Target diri sendiri |
| | GET, PUT `/targets` | admin | Atur target tim |
| `/transfers` | GET | admin | Riwayat perpindahan leads |
| `/rekap` | GET `/rekap/bulanan`, GET `/rekap/export` | admin | Rekap bulanan & CSV |
| `/files` | POST `/files/cv` | login | Unggah CV PDF, maksimal 4 MB |
| | GET `/files/{id}` | login | Sajikan PDF inline agar bisa dibuka di browser |

### Operasional sistem

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/health` | publik | Status fungsi + konektivitas MongoDB. Dipakai untuk verifikasi setelah deploy |
| GET | `/` | publik | Ping sederhana |

Dokumentasi interaktif tersedia di `/docs` (Swagger UI), dihasilkan otomatis
oleh FastAPI dari model Pydantic.

---

## Halaman frontend

| Route | Halaman | Akses |
|---|---|---|
| `/login` | Login | publik |
| `/` | Dashboard — KPI, banner follow-up, grafik performa & tren, performa sumber | login |
| `/leads` | Data Leads — tabel, tab Nasabah/Pelamar, filter, pencarian, impor, ekspor | login |
| `/jadwal-prospek` | Jadwal Prospek + panel Rekap Prospek | login |
| `/catatan` | Catatan pribadi | login |
| `/ganti-password` | Ganti Password | login |
| `/akun-marketing` | Akun Marketing + Target Bulanan | admin |
| `/kolom-custom` | Kolom Custom | admin |
| `/rekap-bulanan` | Rekap Bulanan | admin |
| `/riwayat-perpindahan` | Riwayat Perpindahan | admin |

Route admin dijaga dua lapis: `ProtectedRoute` menyembunyikannya di menu, dan
endpointnya sendiri membalas `403` untuk akun marketing.

---

## Model data

Semua koleksi MongoDB memakai `id` berupa UUID string sebagai kunci publik,
bukan `_id` ObjectId bawaan. Alasannya sederhana: ObjectId tidak bisa
di-serialisasi ke JSON tanpa konversi manual di setiap endpoint.

| Koleksi | Isi |
|---|---|
| `users` | Admin dan marketing. Password tersimpan sebagai hash bcrypt |
| `leads` | Nasabah dan pelamar kerja, termasuk linimasa catatan progres dan nilai kolom custom |
| `jadwal` | Jadwal prospek beserta hasil pertemuannya |
| `catatan` | Catatan pribadi, opsional terkait ke satu leads |
| `custom_fields` | Definisi kolom buatan admin |
| `targets` | Target deal bulanan per marketing |
| `transfers` | Jejak perpindahan leads |
| `files` | CV PDF, disimpan sebagai base64 |

Field yang membedakan kedua jenis leads:

- **Nasabah** — nama, no. WhatsApp, usia, kota domisili, profesi, pernah
  trading (Ya/Belum), dan sumber (Instagram, Facebook, YouTube, TikTok, Google,
  Teman/Keluarga, Komunitas Trading, Iklan/Ads, Referral IB/Partner)
- **Pelamar kerja** — nama, no. WhatsApp, usia, kota, pendidikan
  (SMP/SMA/Diploma/Sarjana), dan unggahan CV PDF

---

## Dua peran pengguna

**Admin** melihat seluruh leads, mengelola akun marketing, membagi dan
memindahkan leads, mengatur target dan kolom custom, mengimpor file, serta
membuka Rekap Bulanan dan Riwayat Perpindahan.

**Marketing** hanya melihat leads yang ditugaskan kepadanya. Boleh memperbarui
status dan catatan, menyerahkan leads miliknya ke marketing lain, mengelola
catatan pribadi, dan melihat progres targetnya. Menghapus leads hanya bisa
untuk leads yang ia tambahkan sendiri — leads dari admin ditolak `403`.

---

## Autentikasi

Login menghasilkan **JWT berumur 7 hari** yang dikirim sebagai cookie
`httpOnly` bernama `session`. JWT ditandatangani dengan `SECRET_KEY`.

Alasan memilih cookie `httpOnly`, bukan `localStorage`: token tidak bisa dibaca
JavaScript, sehingga satu skrip pihak ketiga yang tersisip tidak bisa mencuri
sesi. Konsekuensinya, tidak ada header `Authorization` di kode frontend —
browser mengirim cookie sendiri.

Flag cookie menyesuaikan tempat berjalannya secara otomatis:

| Lingkungan | `Secure` | Alasan |
|---|---|---|
| `http://localhost` | `false` | Cookie `Secure` tidak dikirim lewat HTTP, login lokal akan tampak gagal |
| Vercel (HTTPS) | `true` | Cookie tidak boleh melintas tanpa enkripsi |

Deteksinya dari variabel `VERCEL_ENV`, jadi tidak ada yang perlu diatur manual.
`SameSite=lax` dan `Path=/` dipakai di keduanya. Karena frontend dan API berada
di satu origin, tidak ada urusan cookie lintas domain.

---

## Menjalankan di lokal

Dua proses. Di dalam pod Emergent keduanya diurus supervisor
(`sudo supervisorctl restart backend frontend`); untuk menjalankan manual:

```bash
# Terminal 1 — backend di http://localhost:8001
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 — frontend di http://localhost:3000
cd frontend
yarn install
yarn start
```

Buka `http://localhost:3000`. Vite meneruskan `/api/*` ke port 8001, jadi cukup
satu URL untuk dipakai.

**Isi database dengan data contoh:**

```bash
cd backend
python seed.py            # idempoten — dilewati kalau data sudah ada
python seed.py --reset    # kosongkan leads/jadwal/catatan lalu isi ulang
```

Menghasilkan 4 akun, 21 leads contoh, dan 3 jadwal prospek. Kredensial hasil
seed dicetak ke terminal.

> `seed.py` membaca `MONGO_URL` dari `backend/.env`. Kalau file itu menunjuk ke
> Atlas, maka `--reset` **menghapus data produksi**. Periksa dulu sebelum
> menjalankannya.

**Cek cepat bahwa semuanya hidup:**

```bash
curl http://localhost:8001/api/health
# {"status":"ok","database":"...","mongo":"connected","latency_ms":...}
```

---

## Environment variables

Hanya backend yang butuh. Frontend tidak memerlukan satu pun, karena semua
panggilan API memakai path relatif.

Salin `.env.example` menjadi `backend/.env`:

| Variabel | Wajib | Keterangan |
|---|---|---|
| `MONGO_URL` | ya | Connection string MongoDB. Lokal: `mongodb://localhost:27017`. Atlas: `mongodb+srv://...`. Karakter khusus di password harus di-URL-encode |
| `DB_NAME` | ya | Nama database di dalam server/cluster |
| `SECRET_KEY` | ya di produksi | Kunci penanda-tangan JWT, minimal 32 karakter. Ada fallback development, tapi di Vercel aplikasi sengaja gagal keras kalau variabel ini kosong |
| `CORS_ORIGINS` | tidak | Tidak terpakai pada penyajian satu origin |
| `COOKIE_SECURE` | tidak | Override manual flag `Secure`. Biarkan kosong; nilainya sudah otomatis |

Menghasilkan `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`backend/.env`, `frontend/.env`, dan `vercel.env.txt` sudah masuk `.gitignore`.

---

## Deploy

Satu project Vercel untuk frontend sekaligus backend, dengan MongoDB Atlas
sebagai database. Langkah lengkap, batasan platform yang perlu diperhatikan,
dan tabel troubleshooting ada di **[DEPLOY.md](DEPLOY.md)**.

Ringkasnya: push ke GitHub → import repo di Vercel dengan Root Directory
**`./` (root repository)** → isi tiga environment variable → deploy → verifikasi
lewat `/api/health`.

Root Directory harus root, bukan `frontend`, karena hanya dari sana Vercel bisa
melihat `api/`, `backend/`, dan `frontend/` sekaligus. `package.json` di root
ada khusus supaya Vercel mengenali project di posisi itu.

---

## Pengujian

**Test API (pytest)** — `backend/tests/`. Memukul server uvicorn yang sedang
berjalan, bukan aplikasi ASGI in-process, supaya yang diuji benar-benar
aplikasi yang sama dengan yang dilihat browser.

```bash
cd backend && python -m pytest -q
```

**Test end-to-end (Playwright)** — `tests/`, menjalankan alur lewat browser
sungguhan.

**POC fondasi** — `test_core.py` di root. Membuktikan hal-hal yang paling mudah
gagal saat deploy, sebelum aplikasi dipindahkan: koneksi Atlas, CRUD,
pembuatan index, operasi paralel, reuse client antar event loop, bcrypt, JWT,
dan pembacaan `.xlsx`.

```bash
python test_core.py
```

> Test API menulis ke database yang ditunjuk `backend/.env`. Kalau itu Atlas
> produksi, arahkan ke MongoDB lokal dulu — caranya ada di
> [DEPLOY.md](DEPLOY.md#menjalankan-test-suite).

---

## Keputusan teknis dan alasannya

**Kenapa satu origin, bukan frontend dan backend di dua domain**
Menghilangkan CORS sepenuhnya dan membuat cookie `httpOnly` bekerja tanpa
`SameSite=None` maupun daftar origin yang harus dirawat. Cookie lintas domain
adalah sumber bug login yang paling sering dan paling sulit dilacak.

**Kenapa client MongoDB di-cache per event loop**
Container Vercel yang "warm" dipakai ulang untuk request berikutnya, dan event
loop asyncio-nya belum tentu sama. Client Motor terikat pada satu loop, jadi
satu client global akan meledak dengan `Event loop is closed` begitu loopnya
berganti. `lib/db.py` menyimpan satu client per loop dan membuang client dari
loop yang sudah tutup agar cache tidak tumbuh tanpa batas. Membuat client baru
setiap request bukan pilihan — kuota koneksi Atlas akan habis.

**Kenapa `db` berupa proxy lazy**
Seluruh router sudah memakai `from lib.db import db`. Kalau `db` harus menjadi
objek konkret saat modul diimpor, client yang benar belum bisa ditentukan
karena event loop request belum diketahui. Proxy meneruskan setiap akses
atribut ke database milik loop yang aktif saat itu, sehingga puluhan pemanggilan
di router tidak perlu diubah sama sekali.

**Kenapa CV disimpan di MongoDB, bukan di disk**
Function serverless tidak punya penyimpanan permanen — file di disk hilang
setiap deploy dan tidak terlihat oleh instance lain. Batas 4 MB masih aman jauh
di bawah batas 16 MB satu dokumen MongoDB, dan pilihan ini juga yang membuat
jumlah infrastruktur tetap dua, tanpa perlu S3.

**Kenapa batas unggah 4 MB, bukan 5 MB**
Vercel Functions membatasi body request 4.5 MB, dan unggahan multipart masih
menambah header di atas ukuran file. Kalau tetap 5 MB, request ditolak platform
sebelum FastAPI dijalankan — pengguna hanya melihat error platform, bukan pesan
Bahasa Indonesia dari aplikasi.

**Kenapa region fungsi dipatok ke Singapura**
Cluster Atlas proyek ini berada di Singapura. Default Vercel adalah `iad1`
(Virginia), yang berarti setiap query menyeberangi Pasifik — terukur sekitar
211 ms sekali jalan, dan satu halaman bisa memanggil beberapa endpoint.
`vercel.json` mengunci `regions: ["sin1"]` agar fungsi dan database bertetangga.

**Kenapa "hari ini" ditentukan di server**
`lib/dates.py` menjadi satu-satunya sumber kebenaran tanggal. Kalau browser
yang menentukan, dua pengguna di zona waktu berbeda akan melihat daftar
"follow up hari ini" yang berbeda untuk data yang sama.

**Kenapa `id` UUID, bukan `_id` ObjectId**
ObjectId tidak bisa di-serialisasi ke JSON secara langsung, dan
mengonversinya di setiap endpoint adalah pekerjaan berulang yang mudah
terlewat — satu yang lupa langsung menjadi error 500.
