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
| `vercel.json` | Rewrite `/api/*` ke Python Function, sisanya fallback ke `index.html` (SPA). Build & output directory frontend. `includeFiles` agar folder `backend/` ikut dibundel. **`"framework": null` wajib ada** — lihat bagian di bawah |
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
2. **Root Directory: biarkan kosong (root repo).**
   Ini kesalahan paling sering: kalau di-set ke `frontend`, Vercel tidak akan
   melihat folder `api/` dan `backend/`, sehingga `/api/*` membalas HTML.
3. Framework Preset: **Other**. `vercel.json` sudah menentukan build sendiri,
   jadi jangan isi Build/Output Directory secara manual.

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

## Peringatan di build log yang memang wajar

Build yang sukses tetap memunculkan beberapa peringatan. Berikut artinya, agar
tidak dikira kegagalan:

| Peringatan | Arti | Tindakan |
|---|---|---|
| `Running build in Washington, D.C., USA (East) – iad1` | Region **build**, bukan region Function. Vercel selalu membangun di region internalnya sendiri; `regions: ["sin1"]` di `vercel.json` mengatur tempat **Function berjalan**, dan itulah yang menentukan latency ke Atlas | Tidak ada. Verifikasi region Function di Vercel → Deployment → Functions |
| `Internal rewrites in backend framework projects now route requests using the rewritten destination path` | Vercel mengubah perilaku: aplikasi sekarang menerima path **hasil rewrite**, bukan path asli | Tidak ada. Rewrite `/api/:path*` → `/api/:path*` di repo ini memang **identitas**, jadi FastAPI tetap menerima `/api/...` utuh. Justru **jangan** mengubah destination menjadi `/api/index`, karena FastAPI akan menerima `/api/index` dan semua route balas 404 |
| `FastAPI static file collection failed. Static files will not be served from the CDN` | **Ini bukan peringatan wajar.** Artinya Vercel mendeteksi FastAPI sebagai preset framework, dan preset itu merebut routing `api/` dari file-based function sekaligus melewati install dependency Python | Pastikan `"framework": null` ada di `vercel.json`. Setelah itu baris ini seharusnya hilang. Lihat bagian `"framework": null` di atas |
| `Provided memory setting in vercel.json is ignored on Active CPU billing` | Skema penagihan Active CPU tidak lagi memakai setelan `memory` | Sudah ditangani — `memory` dihapus dari `vercel.json` |
| `warning Workspaces can only be enabled in private projects` | Berasal dari Yarn 1 saat memasang dependency frontend | Tidak ada. `package.json` root dan `frontend/package.json` keduanya sudah `"private": true`, dan peringatan ini tidak mempengaruhi hasil install |
| `Some chunks are larger than 500 kB after minification` | Bundle frontend satu berkas besar (~1 MB, ~310 kB setelah gzip) | Opsional. Bisa dipecah dengan `import()` dinamis kalau waktu muat awal terasa berat |

Yang menandakan build benar-benar berhasil adalah dua baris terakhir:

```
Build Completed in /vercel/output
Deployment completed
```

---

## `"framework": null` — kenapa wajib, dan apa yang rusak tanpa itu

Ini penyebab error runtime yang paling sulit dilacak di setup ini:

```
ModuleNotFoundError: No module named 'fastapi'
```

Build **sukses**, deployment **sukses**, tapi Function meledak saat request
pertama. Ada dua sebab yang berdiri sendiri dan keduanya berasal dari sumber
yang sama.

### Sebab 1 — `installCommand` menggantikan install Python

`installCommand` di `vercel.json` bersifat **override, bukan tambahan**. Builder
Python Vercel menandai dependency sebagai "dianggap sudah terpasang" begitu ada
install command custom, lalu **melewati** langkah sinkronisasi `uv`-nya.

Karena `installCommand` di sini dipakai untuk memasang dependency frontend,
`requirements.txt` sama sekali tidak pernah dipasang.

Gejalanya di build log sangat mudah disalahartikan:

```
Using Python 3.12 from .python-version
Using uv 0.10.11
Running "install" command: `yarn --cwd frontend install --frozen-lockfile`...
```

Baris `Using uv` hanya membuktikan Vercel **menemukan** perkakas Python — bukan
bahwa manifest Python di-install. Tidak ada baris install Python di antaranya.

### Sebab 2 — deteksi framework FastAPI merebut routing `/api`

Vercel kini punya dukungan framework FastAPI bawaan. Begitu FastAPI terdeteksi
di manifest, **preset framework mengambil alih file-based function di `api/`**,
sehingga `api/index.py` tidak lagi menjadi Function tersendiri. Petunjuknya di
build log:

```
Warning: FastAPI static file collection failed. Static files will not be served from the CDN.
```

Aplikasi ini butuh model **file-based function**, bukan preset framework,
karena SPA-nya dibangun terpisah dan disajikan dari `frontend/dist`.

### Perbaikannya

`"framework": null` memilih jalur Other/tanpa-framework. Efeknya dua-duanya
sekaligus:

1. `api/index.py` kembali menjadi Python Function, dan **builder Python
   menjalankan instalasi dependency-nya sendiri** dari `requirements.txt` di
   root — terlepas dari `installCommand`
2. Preset FastAPI tidak lagi bersaing dengan SPA statis

`installCommand` dan `buildCommand` tetap dipakai untuk frontend. Jangan
mencoba menambahkan `pip install` atau `uv pip install` ke `installCommand`:
untuk Function `/api` yang didukung native, langkah install Python **tidak bisa
dikustomisasi**, dan memasang paket saat build frontend tidak membuatnya masuk
ke bundle Function.

Kalau schema Vercel menolak nilai JSON `null`, hapus properti `framework` dari
berkas dan pilih **Other** di Project Settings → General → Framework Preset.

### Cara memastikan dependency benar-benar terpasang

Build log tidak bisa dijadikan bukti. Setelah deploy, panggil `/api/health` —
endpoint itu mencantumkan versi paket yang benar-benar ada di bundle Function:

```bash
curl https://NAMA-PROJECT.vercel.app/api/health
```

```json
{
  "status": "ok",
  "database": "quickpro_crm",
  "env": "production",
  "region": "sin1",
  "cookie_secure": true,
  "runtime": {
    "python": "3.12.x",
    "fastapi": "0.141.1",
    "motor": "3.7.1",
    "pymongo": "4.17.0"
  },
  "mongo": "connected",
  "latency_ms": 12.4
}
```

Kalau endpoint ini membalas JSON sama sekali, `requirements.txt` sudah pasti
terpasang. Kalau balasannya `500` dengan `ModuleNotFoundError`, berarti
`framework: null` hilang atau `installCommand` kembali menimpa install Python.

`region` di balasan itu juga menunjukkan region **Function** yang sebenarnya —
inilah cara memverifikasi `regions: ["sin1"]` berlaku, bukan dari baris region
build di log.

### Jangan tambahkan `pyproject.toml`

Ada bug yang diketahui: bila `pyproject.toml` dan `requirements.txt` ada
bersamaan **tanpa** lockfile, perkakas Vercel bisa memilih `pyproject.toml`
yang belum lengkap dan akhirnya tidak memasang apa pun. Pilih satu sumber
dependency. Repo ini memakai `requirements.txt` saja.

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
| `/api/health` membalas HTML | Root Directory di-set ke `frontend`. Kosongkan |
| `/api/*` → 404 semua | Prefix `/api` di `APIRouter` terhapus. Rewrite bersifat identitas, fungsi menerima path lengkap `/api/...` — prefix harus dipertahankan |
| `ModuleNotFoundError: server` | `includeFiles: "backend/**"` hilang dari `vercel.json` |
| `ModuleNotFoundError: No module named 'fastapi'` (build sukses, Function 500) | `"framework": null` hilang dari `vercel.json`. `installCommand` custom menggantikan langkah install Python, dan deteksi framework FastAPI merebut routing `api/`. Lihat bagian `"framework": null` di atas |
| `ModuleNotFoundError` untuk paket lain | Paket belum ada di `requirements.txt` **root**. `backend/requirements.txt` tidak dipakai Vercel |
| Tidak bisa login pakai akun default (`admin@quickpro.id` / `admin123`) | Panggil `/api/health` dulu, jangan menebak. `env_vars` menunjukkan variabel yang `MISSING`; `users: 0` berarti Function tersambung ke database yang salah atau kosong sehingga login apa pun balas "Email atau password salah"; `mongo: unreachable` berarti koneksi Atlas gagal. Kalau `users: 4` tapi login tetap gagal, `SECRET_KEY` kemungkinan belum di-set untuk environment yang dipakai |
| Login balas `500` | `SECRET_KEY` belum di-set. Aplikasi sengaja gagal keras di Vercel daripada menandatangani sesi dengan kunci publik. Cek `env_vars.SECRET_KEY` di `/api/health` |
| Env var sudah di-set tapi tetap gagal | Nilainya mungkin ter-paste **beserta tanda kutip** dari berkas `.env`. Di UI Vercel nilai disimpan apa adanya, jadi isi tanpa tanda kutip. `MONGO_URL`, `DB_NAME`, dan `SECRET_KEY` kini dibersihkan otomatis dari kutipan, tapi variabel lain tidak |
| Env var sudah benar tapi belum berpengaruh | Environment Variables hanya terbaca oleh deployment **baru**. Setelah menyimpan, jalankan Redeploy |
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
