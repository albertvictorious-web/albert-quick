# AGENTS.md

Instruksi wajib untuk semua AI coding agent (Emergent, Claude Code, Cursor,
Codex, Copilot Workspace, dan sejenisnya) yang bekerja di repository ini.

Baca berkas ini **sebelum** menjalankan perintah `git` apa pun.

---

## 1. Identitas Git — ATURAN PALING PENTING

Proyek ini di-deploy lewat **Vercel**. Vercel menolak deployment bila email
author sebuah commit tidak bisa dicocokkan ke akun GitHub:

```
Deployment Blocked
The deployment was blocked because the commit email <email> could not be
matched to a GitHub account. Ensure your git email matches your GitHub account.
```

Akibatnya: kode sudah benar, test lulus, PR sudah dibuat — tapi deployment
macet total hanya karena metadata commit. Ini pernah terjadi di repo ini
(commit dengan `agent@emergent.sh`), dan tidak boleh terulang.

### Identitas yang WAJIB dipakai

```
name  = albertvictorious-web
email = 324408409+albertvictorious-web@users.noreply.github.com
```

Email itu adalah **alamat noreply GitHub berbasis ID akun**. GitHub selalu
memetakannya ke akun `albertvictorious-web`, jadi Vercel selalu bisa
mencocokkannya. Alamat pribadi tidak diperlukan dan tidak boleh dicari-cari.

### Cara memakainya

Sebelum commit pertama di sesi kerja, jalankan salah satu:

```bash
# Opsi A - ikuti konfigurasi yang sudah tersimpan di repo (dianjurkan)
git config --local include.path ../.gitconfig

# Opsi B - set langsung
git config --local user.name  "albertvictorious-web"
git config --local user.email "324408409+albertvictorious-web@users.noreply.github.com"
```

Lalu commit seperti biasa:

```bash
git commit -m "pesan commit"
```

### Yang DILARANG

| Larangan | Alasan |
|---|---|
| `git commit -c user.email="...@emergent.sh"` | Email agent/platform bukan akun GitHub → deployment diblokir |
| Email `agent@emergent.sh`, `github@emergent.sh`, `bot@*`, `noreply@anthropic.com`, `*@openai.com`, atau alamat placeholder lain | Sama seperti di atas |
| `git commit --no-verify` | Melewati hook yang memeriksa identitas |
| Mengubah identitas hanya lewat `-c` di satu perintah | Commit berikutnya kembali salah. Set di `--local` sekali saja |

### Kalau sudah keburu salah commit

Jangan bikin commit "perbaikan" di atasnya — metadata commit lama tetap salah
dan Vercel tetap memblokir. Tulis ulang author dan committer-nya:

```bash
CORRECT_NAME="albertvictorious-web"
CORRECT_EMAIL="324408409+albertvictorious-web@users.noreply.github.com"

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter "
  export GIT_AUTHOR_NAME='$CORRECT_NAME'
  export GIT_AUTHOR_EMAIL='$CORRECT_EMAIL'
  export GIT_COMMITTER_NAME='$CORRECT_NAME'
  export GIT_COMMITTER_EMAIL='$CORRECT_EMAIL'
" origin/main..HEAD

git push --force-with-lease
```

Verifikasi bahwa tidak ada sisa yang salah:

```bash
git log origin/main..HEAD --format='%an <%ae> | %cn <%ce>' | sort -u
```

### Tiga lapis pencegahan yang sudah dipasang

1. **`.gitconfig`** di root repo — identitas yang benar, siap di-include
2. **`.githooks/pre-commit`** — menolak commit dengan email terlarang sebelum
   commit terbentuk. Aktifkan sekali per clone:
   `git config --local core.hooksPath .githooks`
3. **GitHub Actions `.github/commit-identity.workflow.yml`** — memeriksa
   setiap commit di setiap PR dan push. Ini jaring terakhir yang tetap
   berjalan meski agent melewatkan langkah 1 dan 2.
   **Belum aktif** — GitHub menolak push berkas workflow dari token tanpa
   scope `workflow`. Aktifkan sekali dengan:
   ```bash
   mkdir -p .github/workflows
   git mv .github/commit-identity.workflow.yml .github/workflows/commit-identity.yml
   git commit -m "Aktifkan pemeriksaan identitas commit" && git push
   ```
   Butuh PAT dengan scope `workflow`, atau tempel isinya lewat GitHub web
   (Actions → new workflow → set up a workflow yourself).

Saat memulai sesi, jalankan sekali:

```bash
git config --local include.path ../.gitconfig
git config --local core.hooksPath .githooks
```

---

## 2. Rahasia dan kredensial

Jangan pernah menuliskan nilai rahasia ke berkas yang dilacak Git.

**Sudah ada di `.gitignore`, biarkan tetap begitu:**
`backend/.env`, `frontend/.env`, `vercel.env.txt`, `.vercel/`

**Aturannya:**

- Connection string, password, API key, dan token hanya boleh berada di
  `backend/.env` (lokal) atau Environment Variables Vercel (produksi)
- Kode dan skrip membaca lewat `os.environ`, tidak pernah nilai hardcode.
  Termasuk skrip POC dan skrip sekali-pakai
- `.env.example` hanya berisi placeholder, bukan nilai asli
- Sebelum commit, pindai isi staging area:

```bash
git diff --cached | grep -inE "mongodb\+srv://[^U]|github_pat_|ghp_|SECRET_KEY=[A-Za-z0-9_-]{20}|password[\"' ]*[:=]"
```

- Kalau rahasia sudah pernah ter-commit, jangan cukup menghapusnya di commit
  berikutnya. Anggap rahasia itu bocor: rotasi kredensialnya, lalu bersihkan
  riwayatnya

---

## 3. Yang tidak boleh masuk repository

Jangan commit berkas berikut walaupun ada di direktori kerja:

| Berkas / folder | Alasan |
|---|---|
| `node_modules/`, `frontend/dist/`, `__pycache__/`, `*.pyc` | Artefak build dan dependency |
| `backend_test.py`, `test_result.md` | Artefak sementara agent, bukan bagian aplikasi |
| `test_reports/`, `memory/`, `.emergent/` | Artefak environment preview. Jangan diubah maupun dihapus |
| `TEMPLATE.md`, `.gitconfig` | Jangan dihapus. Keduanya bagian dari repo |
| `yarn.lock` di root | Frontend adalah satu-satunya workspace Node. Lockfile hanya di `frontend/yarn.lock` |

Saat menyalin isi direktori kerja ke clone, gunakan daftar exclude, jangan
`rsync --delete` tanpa filter — cara itu pernah menghapus `TEMPLATE.md`,
`.gitconfig`, dan isi `.emergent/` tanpa disadari.

Sebelum commit, pastikan `git status` hanya memuat berkas yang memang relevan.
PR yang bercampur artefak tidak bisa di-review dengan layak.

---

## 4. Batasan platform yang tidak boleh dilanggar

Aplikasi ini berjalan sebagai **Vercel Python Function**, bukan server yang
hidup terus. Perubahan berikut akan merusaknya:

| Jangan | Alasan |
|---|---|
| Menulis berkas ke disk | Penyimpanan Function bersifat sementara dan tidak dibagi antar instance. Unggahan disimpan base64 di MongoDB |
| Menaikkan batas unggah di atas 4 MB | Body request Vercel dibatasi 4.5 MB. Request ditolak platform sebelum FastAPI dijalankan, sehingga pesan error aplikasi tidak pernah tampil |
| Mengembalikan `lib/db.py` ke satu client Motor global | Container yang warm bisa memakai event loop berbeda. Client Motor terikat satu loop → `Event loop is closed`. Cache per event loop harus dipertahankan |
| Membuat client MongoDB baru per request | Kuota koneksi Atlas akan habis |
| Menambah `minPoolSize > 0` | Menahan koneksi idle di banyak instance serverless |
| Menjalankan background task / scheduler di dalam Function | Function berhenti setelah response terkirim |
| Menghapus prefix `/api` dari `APIRouter` | Rewrite Vercel bersifat identitas; Function menerima path lengkap `/api/...` |
| Menempelkan route langsung ke `app` | Route di luar `/api` tidak terjangkau proxy Vite maupun rewrite Vercel |
| Menghapus `package.json` di root repo | Vercel mendeteksi jenis project dari `package.json` di Root Directory. Tanpa berkas itu, deteksi jatuh ke "Other" dan langkah install bisa terlewat sehingga build frontend gagal |
| Mengubah Root Directory di Vercel menjadi `frontend` | Wajib `./` (root repo). Lihat catatan di bawah |
| Memakai URL backend absolut di frontend | Frontend harus selalu memanggil path relatif `/api/...` |
| Menambah `pandas`, `numpy`, atau paket berat lain ke `requirements.txt` root | Menggemukkan bundle Function tanpa perlu. Paket-paket itu sudah sengaja dibuang |

Setiap kali menyentuh `vercel.json`, `api/index.py`, `requirements.txt` root,
atau `lib/db.py`, perbarui juga penjelasannya di `DEPLOY.md`.

### Root Directory di Vercel wajib `./`

Project utama adalah **root repository**, bukan `frontend/`. Di Vercel:

```
Settings -> General -> Root Directory  =  ./
```

Alasannya: hanya dari root, Vercel bisa melihat `api/`, `backend/`, dan
`frontend/` sekaligus. Kalau Root Directory diarahkan ke `frontend`, folder
`api/` dan `backend/` berada di luar jangkauan build, sehingga fungsi Python
tidak ikut ter-deploy dan `/api/*` justru membalas `index.html`. Gejalanya
menyesatkan: frontend tampak normal, tapi setiap pemanggilan API gagal dengan
error parsing JSON.

Yang membuat susunan ini bekerja dari root:

| Berkas | Perannya saat Root Directory `./` |
|---|---|
| `package.json` (root) | Membuat Vercel mengenali project di root dan menjalankan langkah install. Tidak punya dependency sendiri; semua script mendelegasikan ke `frontend/` |
| `vercel.json` | `installCommand` dan `buildCommand` menunjuk ke `frontend/`, `outputDirectory` diisi `frontend/dist` (relatif terhadap root) |
| `requirements.txt` (root) | Manifest Python. Vercel mencarinya di Root Directory, bukan di `backend/` |
| `api/index.py` | Titik masuk Function. Terdeteksi karena berada di `api/` pada Root Directory |

Jangan mengisi Build Command atau Output Directory lewat UI Vercel \u2014 keduanya
sudah ditentukan `vercel.json`, dan nilai di UI akan menimpanya secara diam-diam.

---

## 5. Database

`backend/.env` menunjuk ke **MongoDB Atlas produksi**. Data di dalamnya milik
pengguna sungguhan.

| Jangan | Sebagai gantinya |
|---|---|
| `python seed.py --reset` tanpa izin eksplisit | Minta konfirmasi lebih dulu. Perintah itu menghapus leads, jadwal, dan catatan |
| `DELETE /api/leads/all` untuk keperluan uji | Cukup verifikasi guard-nya: tanpa token konfirmasi harus `400`, akun marketing harus `403` |
| `python -m pytest` menghadap Atlas | Arahkan ke MongoDB lokal dulu. Caranya ada di `DEPLOY.md` bagian "Menjalankan test suite" |

Data uji yang dibuat harus dibersihkan setelah selesai. Beberapa test
mengasumsikan jumlah leads tepat 21.

---

## 6. Konvensi kode

**Backend** — semua endpoint `async`. Satu model Pydantic per request body dan
per response. Router hanya menangani HTTP; logika yang dipakai berulang masuk
ke `lib/`. Koneksi MongoDB selalu lewat `from lib.db import db`, jangan pernah
membuat client sendiri.

**Frontend** — TypeScript `strict`. Pemanggilan API lewat `src/lib/api.ts`
(`apiGet`, `apiPost`, `apiPatch`, `apiPut`, `apiDelete`), jangan `fetch`
langsung. Tipe di `src/lib/types.ts` dijaga manual agar sejalan dengan model
Pydantic — tidak ada yang menurunkan tipe otomatis melewati batas
Python–TypeScript. Elemen interaktif diberi `data-testid`.

**Bahasa** — seluruh teks yang dilihat pengguna, termasuk pesan error dari
backend, ditulis dalam Bahasa Indonesia. Komentar kode boleh Bahasa Indonesia
atau Inggris, tapi harus menjelaskan **alasan**, bukan mengulang isi kode.

**Tanggal** — "hari ini" ditentukan di server lewat `lib/dates.py`, tidak
pernah dari browser. Kalau tidak, pengguna di zona waktu berbeda akan melihat
daftar follow-up yang berbeda untuk data yang sama.

**Identitas dokumen** — koleksi MongoDB memakai `id` berupa UUID string
sebagai kunci publik, bukan `_id` ObjectId, karena ObjectId tidak bisa
di-serialisasi ke JSON tanpa konversi manual di setiap endpoint.

---

## 7. Sebelum menyatakan pekerjaan selesai

```bash
# 1. Identitas commit benar - WAJIB, ini yang memblokir deployment
git log origin/main..HEAD --format='%an <%ae>' | sort -u

# 2. Tidak ada rahasia di staging area
git diff --cached | grep -inE "mongodb\+srv://[^U]|github_pat_|ghp_"

# 3. Backend hidup dan database terjangkau
curl -s http://localhost:8001/api/health

# 4. Frontend bisa di-build - Vercel akan gagal kalau ini gagal
cd frontend && yarn build

# 5. TypeScript bersih
cd frontend && yarn typecheck

# 6. Hanya berkas yang relevan yang berubah
git status --short
```

Jangan menyatakan sesuatu "sudah diuji" bila belum benar-benar dijalankan.
Laporkan kegagalan apa adanya, termasuk yang tampak sepele.

---

## 8. Dokumen pendamping

| Berkas | Isi |
|---|---|
| `README.md` | Arsitektur, fungsi setiap direktori, peta endpoint, keputusan teknis |
| `DEPLOY.md` | Langkah deploy Vercel, batasan platform, troubleshooting |
| `.env.example` | Environment variables yang dibutuhkan |
| `design_guidelines.json` | Acuan visual: warna, tipografi, spasi |

Setiap perubahan yang mempengaruhi arsitektur, endpoint, atau proses deploy
harus diikuti pembaruan dokumen yang bersangkutan pada PR yang sama.
