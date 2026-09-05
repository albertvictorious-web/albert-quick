import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from passlib.context import CryptContext

from lib.db import db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
COOKIE_NAME = "session"
COOKIE_MAX_AGE = 7 * 24 * 3600

# Fallback hanya untuk development lokal. Di Vercel, SECRET_KEY diisi lewat
# Environment Variables — kalau lupa di-set saat produksi, kita gagal keras di
# bawah agar tidak ada deployment yang menandatangani sesi dengan kunci publik.
_DEV_SECRET = "quickpro-leads-crm-secret-key"


def _is_serverless_production() -> bool:
    """True saat berjalan di deployment Vercel (Production maupun Preview)."""
    return os.environ.get("VERCEL_ENV") in {"production", "preview"} or bool(
        os.environ.get("VERCEL")
    )


def get_secret_key() -> str:
    key = os.environ.get("SECRET_KEY", "").strip()
    if len(key) >= 2 and key[0] == key[-1] and key[0] in "\"'":
        key = key[1:-1].strip()  # tanda kutip ikut ter-paste di UI Vercel
    if key:
        return key
    if _is_serverless_production():
        raise RuntimeError(
            "SECRET_KEY belum di-set di Environment Variables Vercel. "
            'Generate dengan: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    return _DEV_SECRET


def cookie_is_secure() -> bool:
    """Cookie Secure hanya terkirim lewat HTTPS.

    Di Vercel (selalu HTTPS) harus True; di http://localhost harus False, kalau
    tidak browser membuang cookie dan login lokal seolah-olah gagal.
    """
    override = os.environ.get("COOKIE_SECURE", "").strip().lower()
    if override in {"1", "true", "yes"}:
        return True
    if override in {"0", "false", "no"}:
        return False
    return _is_serverless_production()


def session_cookie_kwargs() -> dict:
    """Flag cookie sesi. path="/" agar terkirim ke SPA maupun /api/*."""
    return {
        "httponly": True,
        "secure": cookie_is_secure(),
        "samesite": "lax",
        "path": "/",
    }


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, get_secret_key(), algorithm=ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Anda belum login")
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesi tidak valid, silakan login kembali")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    return user


async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak, khusus untuk Admin")
    return user
