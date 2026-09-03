"""Guess which spreadsheet column feeds which lead field, so an import needs no template.

The admin always sees and can correct the guess before anything is written, so a wrong
match here costs a click — never a bad record.
"""

import re
from typing import Dict, List, Optional, Tuple

# (field key, Indonesian label shown in the mapping screen, required)
FIELD_LABELS: List[Tuple[str, str, bool]] = [
    ("nama", "Nama", True),
    ("no_wa", "No. WhatsApp", True),
    ("tipe", "Tipe Leads (nasabah/pelamar)", False),
    ("usia", "Usia", False),
    ("kota", "Kota / Domisili", False),
    ("profesi", "Profesi / Pekerjaan", False),
    ("pernah_trading", "Pernah Trading", False),
    ("sumber", "Sumber Leads", False),
    ("pendidikan", "Pendidikan Terakhir", False),
    ("status", "Status", False),
    ("tanggal_follow_up", "Tanggal Follow Up", False),
    ("catatan", "Catatan", False),
    ("marketing_email", "Email Marketing (penugasan)", False),
]

FIELD_KEYS = [key for key, _, _ in FIELD_LABELS]

# Normalised spellings seen in real client spreadsheets. Order follows FIELD_LABELS, and a
# column is consumed by the first field that claims it.
ALIASES: Dict[str, Tuple[str, ...]] = {
    "nama": ("nama", "nama lengkap", "nama nasabah", "nama pelamar", "nama klien",
             "nama customer", "nama calon", "name", "full name", "client name", "customer name"),
    "no_wa": ("no wa", "nowa", "no whatsapp", "whatsapp", "wa", "no hp", "nohp", "no handphone",
              "handphone", "no telepon", "no telp", "telepon", "telp", "hp", "phone",
              "phone number", "nomor", "no kontak", "kontak", "mobile", "no whatsapp aktif"),
    "tipe": ("tipe", "type", "jenis", "jenis leads", "kategori", "tipe leads"),
    "usia": ("usia", "umur", "age"),
    "kota": ("kota", "kota domisili", "domisili", "city", "daerah", "alamat", "lokasi", "asal kota"),
    "profesi": ("profesi", "pekerjaan", "job", "occupation", "profession", "bidang pekerjaan"),
    "pernah_trading": ("pernah trading", "pengalaman trading", "sudah pernah trading", "trading",
                       "riwayat trading"),
    "sumber": ("sumber", "sumber leads", "source", "channel", "asal", "asal leads", "dari mana",
               "media", "sumber informasi", "referensi"),
    "pendidikan": ("pendidikan", "pendidikan terakhir", "education", "jenjang", "lulusan",
                   "jenjang pendidikan"),
    "status": ("status", "status leads", "stage", "tahap", "progress"),
    "tanggal_follow_up": ("tanggal follow up", "tgl follow up", "follow up", "followup",
                          "jadwal follow up", "next follow up", "tanggal followup"),
    "catatan": ("catatan", "keterangan", "note", "notes", "remark", "remarks", "deskripsi",
                "komentar"),
    "marketing_email": ("marketing email", "email marketing", "email", "email pic", "pic email",
                        "sales email", "penanggung jawab", "pic", "marketing"),
}


def normalise(header: str) -> str:
    """Fold a header down to bare words: 'No. WhatsApp / HP' -> 'no whatsapp hp'."""
    return re.sub(r"[^a-z0-9]+", " ", (header or "").lower()).strip()


def suggest_mapping(headers: List[str]) -> Dict[str, Optional[str]]:
    """Field key -> the column that most likely feeds it (None when nothing fits)."""
    normalised = {h: normalise(h) for h in headers}
    mapping: Dict[str, Optional[str]] = {key: None for key in FIELD_KEYS}
    taken: set = set()

    # Pass 1: the header IS an alias. Exact hits outrank any partial match anywhere else.
    for key in FIELD_KEYS:
        for header in headers:
            if header not in taken and normalised[header] in ALIASES[key]:
                mapping[key] = header
                taken.add(header)
                break

    # Pass 2: an alias appears as a whole word inside the header ("Nama Lengkap Nasabah").
    for key in FIELD_KEYS:
        if mapping[key]:
            continue
        for header in headers:
            if header in taken:
                continue
            if any(re.search(rf"\b{re.escape(a)}\b", normalised[header]) for a in ALIASES[key]):
                mapping[key] = header
                taken.add(header)
                break

    return mapping


def unmapped(headers: List[str], mapping: Dict[str, Optional[str]]) -> List[str]:
    """Columns no field claimed — kept as an extra note so no data is lost."""
    used = {v for v in mapping.values() if v}
    return [h for h in headers if h not in used]
