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
Form input **rata/flat** dengan urutan persis seperti template import — tidak ada bagian lain.

| # | Field | Nilai |
|---|-------|-------|
| 1 | ID | otomatis (`PLG-0001`, dst.) — boleh diisi manual (ID dari data Anda, harus unik) |
| 2 | Nama Pelanggan | teks **(wajib)** |
| 3 | Alamat | teks (multi-baris) |
| 4 | No HP / WA | teks — spasi/tanda hubung dibersihkan otomatis, `62…` → `0…` |
| 5 | Status | `aktif` · `blokir` · `putus` · `cuti` |
| 6 | Infrastruktur | `wireless` · `fiber optic` |
| 7 | Tagihan | `yes` · `no` · `free` |
| 8 | Kelompok | `pelanggan lancar` · `minta invoice` · `butuh konfirmasi` · `blokir dulu baru bayar` · `bayar ke kantor` · `minta jemput` |
| 9 | Jumlah Tagihan | angka — diketik biasa, tampil otomatis `150.000` |
| 10 | Bulan Tagihan | bulan + tahun — pilih `Agustus 2026` (input bulan), tersimpan `YYYY-MM` |
| 11 | Pengiriman inv | **`done`** / **`belum`** |
| 12 | Reminder1 | **`done`** / **`belum`** |
| 13 | Reminder2 | **`done`** / **`belum`** |
| 14 | Reminder3 | **`done`** / **`belum`** |
| 15 | Reminder4 | **`done`** / **`belum`** |

> Kolom ke-11 s/d 15 hanya punya dua nilai. Saat import, nilai apa pun yang berarti selesai
> (`done`, `selesai`, `sudah`, `ya`, `1`, `ok`, `sent`) dibaca sebagai `done`; sisanya `belum`.
Bulan Tagihan juga menerima tulisan bebas: `Agustus 2026`, `agu 26`, `8/2026`, `2026-08` → disimpan `2026-08`.

**Dipakai otomatis di 5 tempat:** form input · tabel data (kolom **⚙️ Kolom** untuk
menyembunyikan/menampilkan kolom) · template import CSV/XLSX · pencocokan kolom saat import ·
laporan PDF/HTML. Di tabel, badge `belum` bisa **diklik** untuk menandai `done` tanpa membuka form.

### 🔧 Menambah / memindah / menghapus kolom
Cukup edit **satu array di dua file** (urutan array = urutan tampilan):
- `public/app.js` → `PELANGGAN_FIELDS` (label, tipe, `size: 'full'|'half'`, `def`, `required`)
  — header template CSV (`IMPORT_LABELS`) mengikuti array ini secara otomatis
- `server.js` → `PELANGGAN_FIELDS` (label, tipe, `aliases` untuk pencocokan kolom import, `def`)

Tipe tersedia: `text` · `phone` · `longtext` · `select` · `currency` · `month` · `day` · `done` · `number`.

> ⚠️ Menghapus field dari `server.js` menghentikan perawatannya; data lama field itu tetap
> ada di `data/db.json` tetapi tidak ditampilkan lagi dan akan tertimpa nilai default saat
> record diedit. Backup dulu lewat menu **💾 Backup & Restore** sebelum mengubah struktur.

## 🔑 Akun Awal

Saat pertama kali dijalankan, aplikasi membuat akun **contoh** (admin + 3 kolektor) beserta
data pelanggan dummy di `data/db.json`. Kredensialnya **tidak lagi dicantumkan di README/UI**
— lihat langkah pertamanya di **[DEPLOYMENT.md → bagian G. Keamanan & Akun](DEPLOYMENT.md)**,
yang berisi cara langsung menggantinya.

> ⚠️ **Ganti semua password bawaan sebelum aplikasi dipakai**, apalagi bila dipasang di server yang bisa diakses orang lain.

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
| GET | `/api/export/:kolektorId/html` | Laporan HTML siap cetak (admin) |
| GET | `/api/template.csv` | Unduh template import |
| GET | `/api/backup` | Ambil backup data (admin) |
| POST | `/api/restore` | Pulihkan data dari file backup (admin) |
