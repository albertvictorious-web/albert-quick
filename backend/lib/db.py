"""Handle Mongo bersama — import `db` dari sini (server.py, routers, seed.py).

Dirancang untuk jalan di DUA tempat sekaligus:

1. Server biasa (uvicorn lokal / supervisor): satu event loop seumur proses,
   jadi satu client saja yang dibuat dan dipakai terus.

2. Vercel Python Function (serverless, MongoDB Atlas): container yang "warm"
   bisa dipakai ulang untuk request berikutnya, dan loop asyncio-nya belum tentu
   loop yang sama. Client Motor terikat ke satu event loop — kalau satu client
   global dipaksa dipakai di loop lain, error klasiknya adalah
   "Event loop is closed" / "attached to a different loop".
   Karena itu client di-cache PER EVENT LOOP, bukan sekali global.

Yang dihindari: membuat client baru tiap request (menghabiskan kuota koneksi
Atlas) dan minPoolSize > 0 (menahan koneksi idle di banyak instance serverless).
"""

import asyncio
import os
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent.parent / ".env")

DEFAULT_DB_NAME = "quickpro_crm"

# Opsi pool yang dipilih untuk serverless:
#   maxPoolSize=10        -> jauh di bawah default 100; banyak instance x 100 akan
#                            menembus batas koneksi cluster Atlas gratis/shared.
#   minPoolSize=0         -> jangan tahan koneksi idle di container yang mau mati.
#   maxIdleTimeMS=60000   -> pensiunkan socket nganggur, Atlas juga memutus idle.
#   serverSelection/connectTimeoutMS -> request cold start gagal cepat & jelas,
#                            bukan menggantung 30 detik lalu kena timeout fungsi.
CLIENT_OPTIONS: Dict[str, Any] = {
    "maxPoolSize": 10,
    "minPoolSize": 0,
    "maxIdleTimeMS": 60_000,
    "serverSelectionTimeoutMS": 8_000,
    "connectTimeoutMS": 8_000,
    "waitQueueTimeoutMS": 8_000,
    "retryWrites": True,
    "tz_aware": True,
    "appname": "quickpro-crm",
}

_clients: Dict[int, AsyncIOMotorClient] = {}


def _mongo_url() -> str:
    url = os.environ.get("MONGO_URL", "").strip()
    if not url:
        raise RuntimeError(
            "MONGO_URL belum di-set. Di Vercel: Project Settings -> Environment "
            "Variables -> MONGO_URL (connection string MongoDB Atlas)."
        )
    return url


def db_name() -> str:
    return os.environ.get("DB_NAME", "").strip() or DEFAULT_DB_NAME


def _loop_key() -> int:
    """Identitas event loop yang sedang jalan; 0 kalau dipanggil di luar async."""
    try:
        return id(asyncio.get_running_loop())
    except RuntimeError:
        return 0


def get_client() -> AsyncIOMotorClient:
    key = _loop_key()
    existing = _clients.get(key)
    if existing is not None:
        return existing

    # Loop lama yang sudah tutup tidak akan pernah dipakai lagi — buang clientnya
    # supaya cache tidak tumbuh tanpa batas di container yang lama hidup.
    for stale_key, stale in list(_clients.items()):
        if stale_key == 0:
            continue
        loop = getattr(stale, "_io_loop", None)
        if loop is not None and loop.is_closed():
            stale.close()
            _clients.pop(stale_key, None)

    client = AsyncIOMotorClient(_mongo_url(), **CLIENT_OPTIONS)
    _clients[key] = client
    return client


def get_db():
    """Database untuk event loop saat ini."""
    return get_client()[db_name()]


def close_all() -> None:
    """Dipakai di shutdown lifespan. Tidak wajib di serverless, tapi rapi di lokal."""
    for client in _clients.values():
        client.close()
    _clients.clear()


class _LazyHandle:
    """Proxy agar `from lib.db import db` tetap bisa dipakai apa adanya.

    Seluruh backend memanggil `db.users.find_one(...)`. Tanpa proxy ini, `db`
    harus jadi objek konkret saat import — padahal client yang benar baru bisa
    ditentukan setelah event loop request diketahui. Setiap akses atribut
    diteruskan ke database milik loop yang aktif sekarang.
    """

    __slots__ = ("_resolver",)

    def __init__(self, resolver):
        object.__setattr__(self, "_resolver", resolver)

    def __getattr__(self, name: str):
        # Database Motor sendiri memetakan atribut tak dikenal ke collection,
        # jadi ini melayani `db.users` maupun `db.command(...)` sekaligus.
        return getattr(object.__getattribute__(self, "_resolver")(), name)

    def __getitem__(self, name: str):
        return object.__getattribute__(self, "_resolver")()[name]

    def __repr__(self) -> str:  # pragma: no cover - bantu debugging saja
        return f"<LazyHandle {object.__getattribute__(self, '_resolver').__name__}>"


db = _LazyHandle(get_db)
client = _LazyHandle(get_client)
