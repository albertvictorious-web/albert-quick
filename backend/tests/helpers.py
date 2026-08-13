"""Shared login helper for notification tests."""

import httpx

BASE_URL = "http://localhost:8001/api"


def login(email: str, password: str) -> httpx.Client:
    """Return an httpx.Client with the session cookie set for the given user."""
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"login failed for {email}: {resp.text}"
    return client


ADMIN = ("admin@quickpro.id", "admin123")
RINA = ("rina@quickpro.id", "password123")
