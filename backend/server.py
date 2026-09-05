from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import platform
import time
from importlib.metadata import version
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import close_all, db, db_name
from lib.auth import cookie_is_secure
from routers.auth import router as auth_router
from routers.catatan import router as catatan_router
from routers.custom_fields import router as custom_fields_router
from routers.files import router as files_router
from routers.jadwal import router as jadwal_router
from routers.leads import router as leads_router
from routers.rekap import router as rekap_router
from routers.targets import router as targets_router
from routers.transfers import router as transfers_router


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Di serverless (Vercel) shutdown belum tentu dipanggil; ini terutama untuk
    # uvicorn lokal supaya tidak ada koneksi Atlas yang menggantung saat reload.
    close_all()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.get("/health")
async def health():
    """Cek cepat setelah deploy: apakah fungsi hidup DAN Atlas benar-benar terjangkau.

    Dipakai untuk membedakan empat kegagalan yang gejalanya mirip di produksi:
    fungsi Python tidak ke-deploy (404/HTML), dependency Python tidak terpasang
    (ModuleNotFoundError sebelum endpoint ini sempat jalan), env var salah, atau
    Atlas menolak (kredensial / Network Access belum mengizinkan IP Vercel).

    Blok "runtime" sengaja mencantumkan versi paket: kalau endpoint ini membalas
    sama sekali, artinya requirements.txt memang terpasang di bundle Function —
    bukti yang tidak bisa didapat dari build log, karena build bisa sukses
    walaupun dependency Python tidak pernah di-install.
    """
    started = time.perf_counter()
    payload = {
        "status": "ok",
        "database": db_name(),
        "env": os.environ.get("VERCEL_ENV", "local"),
        "region": os.environ.get("VERCEL_REGION", "local"),
        "cookie_secure": cookie_is_secure(),
        # Nama variabel saja, nilainya TIDAK pernah dikembalikan. Ini yang
        # membedakan "env var belum di-set di Vercel" dari "kredensial salah" —
        # dua penyebab yang gejalanya sama-sama "tidak bisa login".
        "env_vars": {
            name: ("set" if os.environ.get(name, "").strip() else "MISSING")
            for name in ("MONGO_URL", "DB_NAME", "SECRET_KEY")
        },
        "runtime": {
            "python": platform.python_version(),
            "fastapi": version("fastapi"),
            "motor": version("motor"),
            "pymongo": version("pymongo"),
        },
    }
    try:
        await db.command("ping")
        payload["mongo"] = "connected"
        payload["users"] = await db.users.count_documents({})
        payload["leads"] = await db.leads.count_documents({})
    except Exception as exc:  # noqa: BLE001 - pesan diagnostik sengaja diteruskan
        payload["status"] = "degraded"
        payload["mongo"] = "unreachable"
        payload["error"] = f"{type(exc).__name__}: {exc}"[:300]
        return JSONResponse(status_code=503, content=payload)

    # users == 0 berarti Function tersambung ke database yang SALAH atau kosong.
    # Ini penyebab paling sering dari "tidak bisa login pakai akun default":
    # kredensialnya benar, tapi DB_NAME di Vercel berbeda dari yang di-seed.
    if payload["users"] == 0:
        payload["status"] = "degraded"
        payload["hint"] = (
            f"Database '{db_name()}' tidak punya user sama sekali. Login apa pun "
            "akan gagal dengan 'Email atau password salah'. Periksa DB_NAME dan "
            "MONGO_URL di Environment Variables Vercel, lalu jalankan seed."
        )

    payload["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
    return payload

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# QuickPro Leads CRM routers
api_router.include_router(auth_router)
api_router.include_router(leads_router)
api_router.include_router(targets_router)
api_router.include_router(transfers_router)
api_router.include_router(catatan_router)
api_router.include_router(jadwal_router)
api_router.include_router(files_router)
api_router.include_router(rekap_router)
api_router.include_router(custom_fields_router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
