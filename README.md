# 📡 KolektorApp — Manajemen Data Pelanggan & Kolektor

Aplikasi web untuk mengelola data **kolektor** dan **pelanggan** (internet), lengkap dengan
**dashboard analisa**, **import file**, **export PDF**, dan **kirim pesan WhatsApp** ke pelanggan.

## ✨ Fitur

### 👤 Admin
- **Input kolektor** — tambah/edit/hapus akun kolektor (username + password).
- **Import file** — import data pelanggan dari file **CSV / XLSX** ke kolektor tertentu.
- **Export PDF** — cetak laporan data pelanggan per kolektor (ringkasan + tabel lengkap).
- **Dashboard analisa** — grafik & statistik menarik (status, infrastruktur, tagihan, kelompok, rekap per kolektor).

### 🧑‍💼 Kolektor
- Hanya bisa melihat data pelanggan **miliknya sendiri** (data lain di-blokir oleh server).
- Fitur per data pelanggan: **Edit**, **Hapus**, dan **Kirim pesan** ke pelanggan (via WhatsApp).

### 📋 Data Pelanggan (per kolektor)
| Field | Nilai |
|-------|-------|
| ID | otomatis (PLG-0001, dst.) |
| Nama Pelanggan | teks |
| No HP / WA | teks |
| Status | `aktif` · `blokir` · `putus` · `cuti` |
| Infrastruktur | `wireless` · `fiber optic` |
| Tagihan | `yes` · `no` · `free` |
| Kelompok | `pelanggan lancar` · `minta invoice` · `butuh konfirmasi` · `blokir dulu baru bayar` · `bayar ke kantor` · `minta jemput` |
| Jumlah Tagihan | angka (Rp) |

## 🔑 Akun Demo

| Peran | Username | Password |
|-------|----------|----------|
| Admin | `admin` | `admin123` |
| Kolektor | `andi` / `budi` / `citra` | `kolektor123` |

## 🚀 Menjalankan

```bash
npm install
npm start
```

Buka **http://localhost:3000** (server berjalan di port `3000`).

## 🖥️ Deploy ke Server (Proxmox / Linux)

Panduan lengkap (LXC container, VM, systemd service, nginx, backup, keamanan)
tersedia di **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## 📥 Format File Import (CSV / XLSX)

Kolom header (urutan bebas, tidak case-sensitive):

```
ID, Nama Pelanggan, No HP / WA, Status, Infrastruktur, Tagihan, Kelompok, Jumlah Tagihan
```

- `ID` **wajib diisi & unik** — ID mengikuti data import Anda (tidak dibuat otomatis oleh sistem).
- Nilai kategori dinormalisasi otomatis (mis. `fiber` → `fiber optic`, `blok` → `blokir`).
- Contoh baris:

```csv
ID,Nama Pelanggan,No HP / WA,Status,Infrastruktur,Tagihan,Kelompok,Jumlah Tagihan
P-001,Rudi Hartono,081234567890,aktif,wireless,yes,pelanggan lancar,250000
P-002,Siti Aminah,081298765432,blokir,fiber optic,no,blokir dulu baru bayar,0
```

> Untuk tambah pelanggan manual, kolom ID bersifat opsional: jika diisi akan dipakai
> (harus unik), jika dikosongkan sistem membuatkan ID otomatis.

> 💡 Template dapat diunduh langsung dari halaman **Kolektor → Import** atau dari
> endpoint `/api/template.csv`.

## 🗂️ Struktur Proyek

```
├── server.js          # Backend Express (API, import, export PDF, auth)
├── public/
│   ├── index.html     # Skeleton SPA
│   ├── styles.css     # Styling
│   └── app.js         # Logika frontend (SPA + Chart.js)
├── data/db.json       # Penyimpanan data (dibuat otomatis, tidak di-commit)
└── package.json
```

## 🛠️ Teknologi

- **Backend:** Node.js + Express, `express-session` (auth), `multer` (upload),
  `xlsx` (import CSV/XLSX), `pdfkit` (export PDF), penyimpanan JSON file.
- **Frontend:** Vanilla JS SPA + **Chart.js** (dashboard).

## 🔌 Ringkasan API

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Info user aktif |
| GET/POST/PUT/DELETE | `/api/kolektor[/:id]` | Kelola kolektor (admin) |
| GET/POST/PUT/DELETE | `/api/pelanggan[/:id]` | Kelola pelanggan (scope per kolektor) |
| POST | `/api/pelanggan/:id/message` | Kirim pesan WA + catat riwayat |
| GET | `/api/pesan` | Riwayat pesan |
| POST | `/api/import` | Import file CSV/XLSX (admin) |
| GET | `/api/dashboard` | Data analisa dashboard |
| GET | `/api/export/:kolektorId/pdf` | Export PDF per kolektor (admin) |
| GET | `/api/template.csv` | Unduh template import |
