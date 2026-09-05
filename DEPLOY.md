# Deploy QuickPro Leads CRM ke Vercel + MongoDB Atlas

Hanya **2 infrastruktur**: Vercel (frontend + backend) dan MongoDB Atlas (database).
Tidak ada server backend terpisah, tidak ada object storage — file CV disimpan
sebagai base64 di MongoDB.

---

## Ringkasan arsitektur

```
                    https://NAMA-PROJECT.vercel.app
                                 |
                    +------------ | ------------+
                    |             |             |
              /api/*  ->  Python Function   /*  ->  static SPA
                    |    (api/index.py)          (frontend/dist)
                    |             |
                    |      FastAPI + Motor
                    |             |
                    +-------------v-------------+
                              MongoDB Atlas
                            db: quickpro_crm
```

Satu origin untuk SPA dan API → **tidak ada CORS**, dan cookie sesi httpOnly
langsung jalan tanpa konfigurasi cross-domain.

---

## File yang menjadi fondasi deploy

| File | Fungsi |
|---|---|
| `vercel.json` | Rewrite `/api/*` ke Python Function, sisanya fallback ke `index.html` (SPA). Build & output directory frontend. `includeFiles` agar folder `backend/` ikut dibundel |
| `api/index.py` | Entrypoint Vercel. Shim tipis yang menaruh `backend/` di `sys.path` lalu `from server import app`. Vercel memuat ASGI native — **tanpa Mangum** |
| `requirements.txt` (root) | Dependency yang di-install Vercel. Hanya paket runtime |
| `backend/requirements.txt` | Dependency development lokal (termasuk pytest, black, mypy) — tidak dipakai Vercel |
| `.python-version` | Pin Python 3.12 agar runtime tidak berubah sendiri |
| `.vercelignore` | Menahan `node_modules`, tests, `.env`, artefak preview agar tidak ikut ter-upload |
| `backend/lib/db.py` | Client Mongo yang di-cache **per event loop** — syarat mutlak agar tidak kena `Event loop is closed` di container warm |
| `vercel.env.txt` | Nilai environment variables siap copy-paste (tidak ter-commit) |

---

## Langkah deploy

### 1. Push kode ke GitHub

```bash
git add -A
git commit -m "Fondasi deploy Vercel + MongoDB Atlas"
git push origin main
```

### 2. Import project di Vercel

1. [vercel.com/new](https://vercel.com/new) → pilih repo `albert-quick`
2. **Root Directory: `./` (root repository).**
   Ini kesalahan paling sering dan paling menyesatkan. Kalau diarahkan ke
   `frontend`, folder `api/` dan `backend/` berada di luar jangkauan build:
   fungsi Python tidak ikut ter-deploy, dan `/api/*` justru membalas
   `index.html`. Frontend tampak normal, tapi semua pemanggilan API gagal
   dengan error parsing JSON.
3. Framework Preset: **Other**. Jangan mengisi Build Command dan Output
   Directory lewat UI — keduanya sudah ditentukan `vercel.json`, dan nilai di
   UI akan menimpanya secara diam-diam.

Susunan yang membuat Root Directory `./` bekerja:

| Berkas | Peran |
|---|---|
| `package.json` (root) | Membuat Vercel mengenali project di root dan menjalankan langkah install. Tanpa berkas ini deteksi jatuh ke "Other" dan install bisa terlewat sehingga build frontend gagal. Tidak punya dependency sendiri — semua script mendelegasikan ke `frontend/` |
| `vercel.json` | `installCommand`/`buildCommand` menunjuk ke `frontend/`; `outputDirectory` = `frontend/dist`, relatif terhadap root |
| `requirements.txt` (root) | Manifest Python. Vercel mencarinya di Root Directory, bukan di `backend/` |
| `api/index.py` | Titik masuk Function, terdeteksi karena berada di `api/` pada Root Directory |

### 3. Isi Environment Variables

Settings → Environment Variables → Import `.env`, tempel isi `vercel.env.txt`:

| Key | Keterangan |
|---|---|
| `MONGO_URL` | Connection string Atlas |
| `DB_NAME` | `quickpro_crm` |
| `SECRET_KEY` | Kunci JWT, minimal 32 karakter |

Centang **Production + Preview + Development**.

### 4. MongoDB Atlas — Network Access

Atlas → Network Access → pastikan ada `0.0.0.0/0`.
Vercel Hobby tidak punya IP egress tetap, jadi allowlist per-IP tidak mungkin.
Kompensasinya: user database dengan hak terbatas + password kuat.

### 5. Deploy, lalu verifikasi

```bash
# 1. Fungsi Python hidup dan Atlas terjangkau
curl https://NAMA-PROJECT.vercel.app/api/health
# -> {"status":"ok",...,"mongo":"connected"}

# 2. Login mengeluarkan cookie Secure
curl -i -X POST https://NAMA-PROJECT.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@quickpro.id","password":"admin123"}'
# -> Set-Cookie: session=...; HttpOnly; Path=/; SameSite=lax; Secure

# 3. Route SPA tidak 404 saat di-refresh
curl -I https://NAMA-PROJECT.vercel.app/data-leads
# -> 200 (mengembalikan index.html)
```

---

## Batasan Vercel yang sudah diakomodasi di kode

| Batasan | Penyesuaian |
|---|---|
| Body request maksimal **4.5 MB** | Batas upload CV & file Excel diturunkan dari 5 MB → **4 MB** (`routers/files.py`, `lib/tabular.py`, label di UI). Kalau tetap 5 MB, Vercel menolak request sebelum FastAPI jalan — user hanya lihat error platform |
| Function stateless, disk sementara | Tidak ada file di disk. CV disimpan base64 di MongoDB (sudah begitu sejak awal) |
| Container warm dipakai ulang, event loop bisa berganti | Client Motor di-cache per event loop di `lib/db.py` |
| Kuota koneksi Atlas | `maxPoolSize=10`, `minPoolSize=0`, `maxIdleTimeMS=60000` |
| Cold start | `serverSelectionTimeoutMS=8000` — gagal cepat dengan pesan jelas, bukan menggantung sampai fungsi timeout |
| `maxDuration` | 60 detik (cukup untuk import Excel terbesar) |
| Latency ke database | Cluster Atlas ini ada di **Singapura** (diverifikasi dari IP shard `159.143.64.113`). `vercel.json` mengunci `"regions": ["sin1"]` agar Function jalan di Singapura juga. Tanpa ini Vercel default ke `iad1` (Virginia) dan setiap query menyeberang Pasifik \u2014 dari pod preview ini saja ping tercatat **211 ms**, dan satu halaman bisa memanggil beberapa endpoint |

> Kalau region `sin1` tidak tersedia di plan Anda, hapus baris `"regions"` — app
> tetap jalan, hanya lebih lambat. Jangan sebaliknya: memindahkan cluster Atlas
> ke region lain berarti membuat cluster baru dan migrasi data.

---

## Menjalankan test suite

`backend/.env` sekarang menunjuk ke **Atlas produksi**, dan test suite memukul
server uvicorn yang hidup — artinya `pytest` akan menulis ke database asli.
Sebagian test juga mengasumsikan jumlah leads tepat 21, jadi sisa data test
bisa membuatnya gagal.

Jalankan test terhadap MongoDB lokal, bukan Atlas:

```bash
# 1. arahkan backend ke mongo lokal sementara
MONGO_URL="mongodb://localhost:27017" DB_NAME="quickpro_test" \
  uvicorn server:app --port 8001 --app-dir backend &

# 2. jalankan test
cd backend && python -m pytest -q

# 3. kembalikan backend ke Atlas
sudo supervisorctl restart backend
```

---

## Development lokal tetap berjalan

Tidak ada yang berubah:

```bash
# backend
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# frontend (Vite proxy /api -> :8001)
cd frontend && yarn start
```

Cookie otomatis **non-Secure** di localhost dan **Secure** di Vercel, dideteksi
dari variabel `VERCEL_ENV`. Tidak perlu diatur manual.

---

## Seed database

Database `quickpro_crm` di Atlas sudah terisi: 4 akun, 21 leads, 3 jadwal.

```bash
cd backend
python seed.py            # idempotent — dilewati kalau data sudah ada
python seed.py --reset    # hapus leads/jadwal/catatan lalu isi ulang
```

> `seed.py` membaca `MONGO_URL` dari `backend/.env`, yang sekarang menunjuk ke
> Atlas. Jadi menjalankannya **mengubah data produksi** — hati-hati dengan `--reset`.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `/api/health` membalas HTML | Root Directory bukan `./`. Kemungkinan diarahkan ke `frontend`, sehingga `api/` dan `backend/` tidak ikut ter-deploy |
| `/api/*` → 404 semua | Prefix `/api` di `APIRouter` terhapus. Rewrite bersifat identitas, fungsi menerima path lengkap `/api/...` — prefix harus dipertahankan |
| `ModuleNotFoundError: server` | `includeFiles: "backend/**"` hilang dari `vercel.json` |
| `mongo: unreachable` di `/api/health` | `MONGO_URL` salah / password belum di-URL-encode / Network Access Atlas belum `0.0.0.0/0` |
| `bad auth: authentication failed` | User database yang dipakai di `MONGO_URL` salah, atau password belum di-URL-encode. Verifikasi user di Atlas → Database Access |
| Login sukses tapi langsung ter-logout | `SECRET_KEY` berbeda antar deployment, atau belum di-set di environment yang dipakai |
| `Event loop is closed` | Jangan kembalikan `lib/db.py` ke satu client global |
| Upload > 4 MB gagal aneh | Batas platform Vercel 4.5 MB. Kompres PDF-nya |

---

## Keamanan sebelum go-live

1. Ganti password semua akun lewat menu **Ganti Password** (default masih
   `admin123` / `password123`).
2. **Revoke GitHub PAT** yang dipakai untuk clone repo ini.
3. Ganti password user MongoDB Atlas di Atlas → Database Access → Edit → Edit
   Password, lalu perbarui `MONGO_URL` di Vercel Environment Variables dan
   redeploy. Hindari password yang sama dengan username.
4. Generate `SECRET_KEY` baru khusus produksi.
5. Pastikan `vercel.env.txt` dan `backend/.env` tidak pernah ter-commit
   (keduanya sudah masuk `.gitignore`).
