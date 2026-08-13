import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import (
    COOKIE_NAME,
    create_token,
    get_current_admin,
    get_current_user,
    hash_password,
    verify_password,
)
from lib.db import db
from models.user import LoginRequest, UserCreate, UserPublic

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
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/",
    )
    return UserPublic(**user)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
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


@router.delete("/auth/marketing/{user_id}")
async def delete_marketing(user_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.users.delete_one({"id": user_id, "role": "marketing"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Akun marketing tidak ditemukan")
    await db.leads.update_many(
        {"assigned_to": user_id}, {"$set": {"assigned_to": None, "assigned_to_name": None}}
    )
    return {"message": "Akun marketing dihapus"}
