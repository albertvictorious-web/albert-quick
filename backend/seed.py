"""Idempotent seed script for QuickPro Leads CRM.

Run with: cd /app/backend && python seed.py
"""
import asyncio
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


async def main():
    admin = await upsert_user("Admin QuickPro", "admin@quickpro.id", "admin123", "admin")
    m1 = await upsert_user("Rina Marlina", "rina@quickpro.id", "password123", "marketing")
    m2 = await upsert_user("Budi Santoso", "budi@quickpro.id", "password123", "marketing")
    m3 = await upsert_user("Siti Aminah", "siti@quickpro.id", "password123", "marketing")

    existing_leads = await db.leads.count_documents({})
    if existing_leads > 0:
        print("Leads sudah ada, skip seeding leads.")
        print("Admin login: admin@quickpro.id / admin123")
        return

    today = now_utc().date()

    def days(offset):
        return (today + timedelta(days=offset)).isoformat()

    nasabah_leads = [
        {"nama": "Ahmad Wijaya", "no_hp": "081234567801", "email": "ahmad.wijaya@gmail.com", "alamat": "Jl. Sudirman No. 12, Jakarta Selatan", "produk": "KPR / Kredit Pemilikan Rumah", "sumber": "Website QuickPro", "status": "Baru", "owner": m1, "follow": days(1)},
        {"nama": "Dewi Lestari", "no_hp": "081234567802", "email": "dewi.lestari@gmail.com", "alamat": "Jl. Gatot Subroto No. 5, Bandung", "produk": "Deposito Berjangka", "sumber": "Meta Ads (Facebook/IG)", "status": "Diproses", "owner": m1, "follow": days(-1)},
        {"nama": "Hendra Gunawan", "no_hp": "081234567803", "email": "hendra.g@gmail.com", "alamat": "Jl. Diponegoro No. 8, Surabaya", "produk": "Kredit Usaha Rakyat (KUR)", "sumber": "Referral Sales", "status": "Follow Up", "owner": m1, "follow": days(0)},
        {"nama": "Maya Puspita", "no_hp": "081234567804", "email": "maya.puspita@gmail.com", "alamat": "Jl. Ahmad Yani No. 20, Semarang", "produk": "Tabungan Bisnis", "sumber": "Walk-in Branch", "status": "Deal", "owner": m1, "follow": None},
        {"nama": "Rudi Hartono", "no_hp": "081234567805", "email": "rudi.hartono@gmail.com", "alamat": "Jl. Pahlawan No. 3, Medan", "produk": "Kartu Kredit Corporate", "sumber": "Telemarketing", "status": "Gagal", "owner": m1, "follow": None},
        {"nama": "Sri Wahyuni", "no_hp": "081234567806", "email": "sri.wahyuni@gmail.com", "alamat": "Jl. Merdeka No. 15, Yogyakarta", "produk": "Asuransi / Bancassurance", "sumber": "Pameran / Event", "status": "Baru", "owner": m2, "follow": days(2)},
        {"nama": "Bambang Setiawan", "no_hp": "081234567807", "email": "bambang.s@gmail.com", "alamat": "Jl. Veteran No. 9, Malang", "produk": "KPR / Kredit Pemilikan Rumah", "sumber": "Website QuickPro", "status": "Diproses", "owner": m2, "follow": days(-2)},
        {"nama": "Fitriani Ramadhani", "no_hp": "081234567808", "email": "fitriani.r@gmail.com", "alamat": "Jl. Imam Bonjol No. 11, Palembang", "produk": "Deposito Berjangka", "sumber": "Referral Sales", "status": "Follow Up", "owner": m2, "follow": days(0)},
        {"nama": "Agus Prasetyo", "no_hp": "081234567809", "email": "agus.p@gmail.com", "alamat": "Jl. Kartini No. 7, Makassar", "produk": "Kredit Usaha Rakyat (KUR)", "sumber": "Meta Ads (Facebook/IG)", "status": "Deal", "owner": m2, "follow": None},
        {"nama": "Yuni Kartika", "no_hp": "081234567810", "email": "yuni.kartika@gmail.com", "alamat": "Jl. Cendrawasih No. 4, Denpasar", "produk": "Tabungan Bisnis", "sumber": "Walk-in Branch", "status": "Baru", "owner": None, "follow": None},
        {"nama": "Joko Susilo", "no_hp": "081234567811", "email": "joko.susilo@gmail.com", "alamat": "Jl. Diponegoro No. 22, Balikpapan", "produk": "Kartu Kredit Corporate", "sumber": "Telemarketing", "status": "Baru", "owner": None, "follow": None},
    ]

    pelamar_leads = [
        {"nama": "Andi Saputra", "no_hp": "082234567801", "email": "andi.saputra@gmail.com", "posisi": "Sales Executive", "nik": "3201010101010001", "tanggal_lahir": "1998-03-12", "sumber": "JobStreet", "status": "Baru", "owner": m3, "follow": days(1)},
        {"nama": "Citra Ayu", "no_hp": "082234567802", "email": "citra.ayu@gmail.com", "posisi": "Marketing Officer", "nik": "3201010101010002", "tanggal_lahir": "1997-07-21", "sumber": "LinkedIn", "status": "Interview", "owner": m3, "follow": days(0)},
        {"nama": "Doni Kurniawan", "no_hp": "082234567803", "email": "doni.k@gmail.com", "posisi": "Admin Staff", "nik": "3201010101010003", "tanggal_lahir": "1999-11-05", "sumber": "Instagram Career", "status": "Diterima", "owner": m3, "follow": None},
        {"nama": "Eka Putri", "no_hp": "082234567804", "email": "eka.putri@gmail.com", "posisi": "Digital Marketer", "nik": "3201010101010004", "tanggal_lahir": "2000-01-18", "sumber": "Referral Internal", "status": "Ditolak", "owner": m3, "follow": None},
        {"nama": "Fajar Nugroho", "no_hp": "082234567805", "email": "fajar.n@gmail.com", "posisi": "Branch Supervisor", "nik": "3201010101010005", "tanggal_lahir": "1995-05-30", "sumber": "Website Karir", "status": "Baru", "owner": m1, "follow": days(-1)},
        {"nama": "Gita Permata", "no_hp": "082234567806", "email": "gita.permata@gmail.com", "posisi": "Customer Service", "nik": "3201010101010006", "tanggal_lahir": "2001-09-09", "sumber": "Bursa Kerja / Job Fair", "status": "Interview", "owner": m1, "follow": days(0)},
        {"nama": "Hadi Firmansyah", "no_hp": "082234567807", "email": "hadi.f@gmail.com", "posisi": "Sales Executive", "nik": "3201010101010007", "tanggal_lahir": "1996-12-25", "sumber": "JobStreet", "status": "Diterima", "owner": m2, "follow": None},
        {"nama": "Indah Sari", "no_hp": "082234567808", "email": "indah.sari@gmail.com", "posisi": "Marketing Officer", "nik": "3201010101010008", "tanggal_lahir": "1998-06-14", "sumber": "LinkedIn", "status": "Baru", "owner": m2, "follow": days(2)},
        {"nama": "Kevin Halim", "no_hp": "082234567809", "email": "kevin.halim@gmail.com", "posisi": "Admin Staff", "nik": "3201010101010009", "tanggal_lahir": "1999-02-28", "sumber": "Instagram Career", "status": "Ditolak", "owner": None, "follow": None},
        {"nama": "Lina Marlina", "no_hp": "082234567810", "email": "lina.marlina@gmail.com", "posisi": "Digital Marketer", "nik": "3201010101010010", "tanggal_lahir": "2000-04-17", "sumber": "Website Karir", "status": "Baru", "owner": None, "follow": None},
    ]

    def build_lead(data, lead_type):
        owner = data.pop("owner")
        follow = data.pop("follow")
        created_at = now_utc()
        notes = []
        if data["status"] != "Baru":
            notes.append(
                {
                    "id": str(uuid.uuid4()),
                    "text": f"Status diperbarui menjadi {data['status']} oleh sistem seed data.",
                    "status": data["status"],
                    "created_by": (owner or admin)["id"],
                    "created_by_name": (owner or admin)["name"],
                    "created_at": created_at,
                }
            )
        return {
            "id": str(uuid.uuid4()),
            "type": lead_type,
            "sumber": data["sumber"],
            "status": data["status"],
            "catatan": None,
            "tanggal_follow_up": follow,
            "assigned_to": owner["id"] if owner else None,
            "assigned_to_name": owner["name"] if owner else None,
            "created_by": admin["id"],
            "created_by_name": admin["name"],
            "created_at": created_at,
            "updated_at": created_at,
            "notes": notes,
            **{k: v for k, v in data.items() if k not in ("sumber", "status")},
        }

    docs = [build_lead(d, "nasabah") for d in nasabah_leads] + [
        build_lead(d, "pelamar") for d in pelamar_leads
    ]
    await db.leads.insert_many(docs)
    print(f"Seeded {len(docs)} leads.")
    print("Admin login: admin@quickpro.id / admin123")
    print("Marketing login: rina@quickpro.id / password123 (dan lainnya) / password123")


if __name__ == "__main__":
    asyncio.run(main())
