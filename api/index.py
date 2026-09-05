"""Entrypoint Vercel Python Function untuk seluruh backend FastAPI.

Vercel memuat aplikasi ASGI secara native: satu-satunya syarat adalah modul ini
mengekspor variabel bernama `app`. Mangum TIDAK dipakai/diperlukan.

Kenapa cuma shim tipis:
  - Kode backend tetap tinggal di /backend, jadi `uvicorn server:app` untuk
    development lokal sama sekali tidak berubah.
  - `vercel.json` memakai includeFiles "backend/**" agar folder itu ikut dibundel.
  - /backend ditaruh di sys.path supaya import gaya `from lib.db import db` dan
    `from routers.auth import router` (yang dipakai seluruh backend) tetap valid
    tanpa perlu diubah jadi `backend.lib.db`.

Penting soal path: rewrite "/api/:path*" -> "/api/:path*" bersifat identitas, jadi
fungsi ini menerima path LENGKAP ("/api/auth/login"). Karena itu prefix
APIRouter(prefix="/api") di server.py memang harus dipertahankan, jangan di-strip.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"

for candidate in (str(BACKEND), str(ROOT)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

from server import app  # noqa: E402  (import harus setelah sys.path disiapkan)

__all__ = ["app"]
