import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import (
    COOKIE_MAX_AGE,
    COOKIE_NAME,
    create_token,
    get_current_admin,
    get_current_user,
    hash_password,
    session_cookie_kwargs,
    verify_password,
)
from lib.db import db
from models.user import ChangePasswordRequest, LoginRequest, MarketingUpdate, UserCreate, UserPublic

router = APIRouter()


@router.post("/auth/login", response_model=UserPublic)
async def login(body: LoginRequest, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_token(user["id"])
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        **session_cookie_kwargs(),
    )
    return UserPublic(**user)


@router.post("/auth/logout")
async def logout(response: Response):
    # Flag saat delete harus cocok dengan saat set, kalau tidak browser
    # menganggapnya cookie lain dan sesi tidak benar-benar terhapus.
    kwargs = session_cookie_kwargs()
    response.delete_cookie(
        COOKIE_NAME,
        path=kwargs["path"],
        secure=kwargs["secure"],
        httponly=kwargs["httponly"],
        samesite=kwargs["samesite"],
    )
    return {"message": "Logout berhasil"}


@router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)


@router.post("/auth/marketing", response_model=UserPublic)
async def create_marketing(body: UserCreate, admin: dict = Depends(get_current_admin)):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah digunakan")
    user_doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": body.email.lower(),
        "role": "marketing",
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    return UserPublic(**user_doc)


@router.get("/auth/marketing", response_model=List[UserPublic])
async def list_marketing(admin: dict = Depends(get_current_admin)):
    users = await db.users.find({"role": "marketing"}).sort("name", 1).to_list(1000)
    return [UserPublic(**u) for u in users]


@router.patch("/auth/marketing/{user_id}", response_model=UserPublic)
async def update_marketing(
    user_id: str, body: MarketingUpdate, admin: dict = Depends(get_current_admin)
):
    """Admin may rename a marketing account, change its email, or reset its password."""
    target = await db.users.find_one({"id": user_id, "role": "marketing"})
    if not target:
        raise HTTPException(status_code=404, detail="Akun marketing tidak ditemukan")

    updates: dict = {}
    if body.name:
        updates["name"] = body.name
    if body.email:
        new_email = body.email.lower()
        clash = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Email sudah digunakan akun lain")
        updates["email"] = new_email
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
        updates["password_hash"] = hash_password(body.password)

    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan yang dikirim")

    await db.users.update_one({"id": user_id}, {"$set": updates})
    # A rename must follow the marketing user onto every lead they own.
    if "name" in updates:
        await db.leads.update_many(
            {"assigned_to": user_id}, {"$set": {"assigned_to_name": updates["name"]}}
        )
        await db.jadwal.update_many(
            {"marketing_id": user_id}, {"$set": {"marketing_name": updates["name"]}}
        )
    target = await db.users.find_one({"id": user_id})
    return UserPublic(**target)


@router.post("/auth/change-password")
async def change_password(
    body: ChangePasswordRequest, user: dict = Depends(get_current_user)
):
    """Any signed-in user changes their own password after confirming the current one."""
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password saat ini salah")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    return {"message": "Password berhasil diubah"}


@router.delete("/auth/marketing/{user_id}")
async def delete_marketing(user_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.users.delete_one({"id": user_id, "role": "marketing"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Akun marketing tidak ditemukan")
    await db.leads.update_many(
        {"assigned_to": user_id}, {"$set": {"assigned_to": None, "assigned_to_name": None}}
    )
    return {"message": "Akun marketing dihapus"}
