"""Idempotent seed script for QuickPro Leads CRM.

Run with: cd /app/backend && python seed.py
Add --reset to wipe leads/jadwal/catatan and reseed with the current field structure.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone

from lib.auth import hash_password
from lib.db import db


def now_utc():
    return datetime.now(timezone.utc)


async def upsert_user(name, email, password, role):
    existing = await db.users.find_one({"email": email})
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "role": role,
        "password_hash": hash_password(password),
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    return doc


async def main(reset: bool = False):
    admin = await upsert_user("Admin QuickPro", "admin@quickpro.id", "admin123", "admin")
    m1 = await upsert_user("Rina Marlina", "rina@quickpro.id", "password123", "marketing")
    m2 = await upsert_user("Budi Santoso", "budi@quickpro.id", "password123", "marketing")
    m3 = await upsert_user("Siti Aminah", "siti@quickpro.id", "password123", "marketing")

    if reset:
        for name in ("leads", "jadwal", "catatan", "transfers"):
            await db[name].delete_many({})
        print("Reset: leads, jadwal, catatan, transfers dikosongkan.")

    if await db.leads.count_documents({}) > 0:
        print("Leads sudah ada, skip seeding. Gunakan --reset untuk isi ulang.")
        print("Admin login: admin@quickpro.id / admin123")
        return

    today = now_utc().date()

    def days(offset):
        return (today + timedelta(days=offset)).isoformat()

    # type, nama, no_wa, usia, kota, profesi, pernah_trading, sumber, status, owner, follow
    nasabah = [
        ("Ahmad Wijaya", "081234567801", 38, "Jakarta Selatan", "Karyawan Swasta", "Belum", "Instagram", "Baru", m1, days(1)),
        ("Dewi Lestari", "081234567802", 31, "Bandung", "Wirausaha", "Ya", "Facebook", "Diproses", m1, days(-1)),
        ("Hendra Gunawan", "081234567803", 45, "Surabaya", "Pengusaha Kuliner", "Belum", "YouTube", "Follow Up", m1, days(0)),
        ("Maya Puspita", "081234567804", 29, "Semarang", "Dokter", "Ya", "Komunitas Trading", "Deal", m1, None),
        ("Rudi Hartono", "081234567805", 52, "Medan", "Kontraktor", "Belum", "Google", "Gagal", m1, None),
        ("Sri Wahyuni", "081234567806", 34, "Yogyakarta", "Guru", "Belum", "TikTok", "Baru", m2, days(2)),
        ("Bambang Setiawan", "081234567807", 41, "Malang", "PNS", "Ya", "Teman/Keluarga", "Diproses", m2, days(-2)),
        ("Fitriani Ramadhani", "081234567808", 27, "Palembang", "Content Creator", "Belum", "Instagram", "Follow Up", m2, days(0)),
        ("Agus Prasetyo", "081234567809", 36, "Makassar", "Karyawan BUMN", "Ya", "Referral IB/Partner", "Deal", m2, None),
        ("Yuni Kartika", "081234567810", 30, "Denpasar", "Pemilik Homestay", "Belum", "Iklan/Ads", "Baru", None, None),
        ("Joko Susilo", "081234567811", 47, "Balikpapan", "Supervisor Tambang", "Ya", "Komunitas Trading", "Baru", None, None),
    ]

    # nama, no_wa, usia, kota, pendidikan, sumber, status, owner, follow
    pelamar = [
        ("Andi Saputra", "082234567801", 26, "Jakarta Timur", "Sarjana", "JobStreet", "Baru", m3, days(1)),
        ("Citra Ayu", "082234567802", 24, "Bandung", "Diploma", "LinkedIn", "Interview", m3, days(0)),
        ("Doni Kurniawan", "082234567803", 23, "Bekasi", "SMA", "Instagram", "Diterima", m3, None),
        ("Eka Putri", "082234567804", 22, "Tangerang", "SMA", "TikTok", "Ditolak", m3, None),
        ("Fajar Nugroho", "082234567805", 29, "Depok", "Sarjana", "Website Karir", "Baru", m1, days(-1)),
        ("Gita Permata", "082234567806", 21, "Bogor", "SMP", "Job Fair", "Interview", m1, days(0)),
        ("Hadi Firmansyah", "082234567807", 28, "Surabaya", "Sarjana", "Referral Internal", "Diterima", m2, None),
        ("Indah Sari", "082234567808", 25, "Semarang", "Diploma", "LinkedIn", "Baru", m2, days(2)),
        ("Kevin Halim", "082234567809", 24, "Medan", "SMA", "Facebook", "Ditolak", None, None),
        ("Lina Marlina", "082234567810", 23, "Makassar", "Diploma", "JobStreet", "Baru", None, None),
    ]

    docs = []
    for nama, no_wa, usia, kota, profesi, trading, sumber, status, owner, follow in nasabah:
        created = now_utc()
        notes = []
        if status != "Baru":
            notes.append(
                {
                    "id": str(uuid.uuid4()),
                    "text": f"Status diperbarui menjadi {status} (data contoh).",
                    "status": status,
                    "created_by": (owner or admin)["id"],
                    "created_by_name": (owner or admin)["name"],
                    "created_at": created,
                }
            )
        docs.append(
            {
                "id": str(uuid.uuid4()),
                "type": "nasabah",
                "nama": nama,
                "no_wa": no_wa,
                "usia": usia,
                "kota": kota,
                "profesi": profesi,
                "pernah_trading": trading,
                "sumber": sumber,
                "pendidikan": None,
                "cv_file_id": None,
                "cv_filename": None,
                "status": status,
                "catatan": None,
                "tanggal_follow_up": follow,
                "assigned_to": owner["id"] if owner else None,
                "assigned_to_name": owner["name"] if owner else None,
                "created_by": admin["id"],
                "created_by_name": admin["name"],
                "created_at": created,
                "updated_at": created,
                "closed_at": created if status in ("Deal", "Diterima") else None,
                "notes": notes,
            }
        )

    for nama, no_wa, usia, kota, pendidikan, sumber, status, owner, follow in pelamar:
        created = now_utc()
        notes = []
        if status != "Baru":
            notes.append(
                {
                    "id": str(uuid.uuid4()),
                    "text": f"Status diperbarui menjadi {status} (data contoh).",
                    "status": status,
                    "created_by": (owner or admin)["id"],
                    "created_by_name": (owner or admin)["name"],
                    "created_at": created,
                }
            )
        docs.append(
            {
                "id": str(uuid.uuid4()),
                "type": "pelamar",
                "nama": nama,
                "no_wa": no_wa,
                "usia": usia,
                "kota": kota,
                "profesi": None,
                "pernah_trading": None,
                "sumber": sumber,
                "pendidikan": pendidikan,
                "cv_file_id": None,
                "cv_filename": None,
                "status": status,
                "catatan": None,
                "tanggal_follow_up": follow,
                "assigned_to": owner["id"] if owner else None,
                "assigned_to_name": owner["name"] if owner else None,
                "created_by": admin["id"],
                "created_by_name": admin["name"],
                "created_at": created,
                "updated_at": created,
                "closed_at": created if status in ("Deal", "Diterima") else None,
                "notes": notes,
            }
        )

    await db.leads.insert_many(docs)

    # A couple of prospecting appointments so the new menu is not empty on first open.
    jadwal_rows = [
        (m1, "Ahmad Wijaya", "Kantor Pusat, Jakarta Selatan", days(1), "10:00", "Mobil Pribadi", "Terjadwal", None),
        (m1, "Hendra Gunawan", "Cafe Tunjungan, Surabaya", days(0), "14:30", "Transportasi Online", "Terjadwal", None),
        (m2, "Bambang Setiawan", "Rumah Klien, Malang", days(-1), "09:00", "Motor", "Selesai", "Klien tertarik, minta simulasi profit dulu sebelum deposit."),
    ]
    jadwal_docs = []
    for owner, client, lokasi, tanggal, jam, kendaraan, status, hasil in jadwal_rows:
        created = now_utc()
        jadwal_docs.append(
            {
                "id": str(uuid.uuid4()),
                "client_nama": client,
                "marketing_id": owner["id"],
                "marketing_name": owner["name"],
                "lokasi": lokasi,
                "tanggal": tanggal,
                "jam": jam,
                "kendaraan": kendaraan,
                "status": status,
                "hasil_pertemuan": hasil,
                "lead_id": None,
                "created_by": owner["id"],
                "created_by_name": owner["name"],
                "created_at": created,
                "updated_at": created,
            }
        )
    await db.jadwal.insert_many(jadwal_docs)

    print(f"Seeded {len(docs)} leads dan {len(jadwal_docs)} jadwal prospek.")
    print("Admin login: admin@quickpro.id / admin123")
    print("Marketing login: rina@quickpro.id / budi@quickpro.id / siti@quickpro.id — password123")


if __name__ == "__main__":
    asyncio.run(main(reset="--reset" in sys.argv))
