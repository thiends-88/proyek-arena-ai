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
Form input dibagi menjadi **3 bagian** — Identitas & Lokasi, Langganan & Layanan, Penagihan.

| Field | Bagian | Nilai |
|-------|--------|-------|
| ID | Identitas | otomatis (`PLG-0001`, dst.) atau isi manual (mis. dari data import) |
| Nama Pelanggan | Identitas | teks **(wajib)** |
| No HP / WA | Identitas | teks **(wajib)** — pemisah dibersihkan otomatis, minimal 8 angka |
| Alamat / Patok | Identitas | teks panjang |
| Status | Langganan | `aktif` · `blokir` · `putus` · `cuti` |
| Infrastruktur | Langganan | `wireless` · `fiber optic` |
| Produk | Langganan | `internet` · `wifi.net` · `hotspot` · `dedicated` |
| Kecepatan Paket | Langganan | teks, mis. `20 Mbps` |
| Tanggal Pasang | Langganan | tanggal (pilih di kalender) |
| Tagihan | Penagihan | `yes` · `no` · `free` |
| Kelompok | Penagihan | `pelanggan lancar` · `minta invoice` · `butuh konfirmasi` · `blokir dulu baru bayar` · `bayar ke kantor` · `minta jemput` |
| Jumlah Tagihan | Penagihan | angka — diketik biasa, tampil otomatis `150.000` |
| Jatuh Tempo | Penagihan | tanggal 1–28 tiap bulan |
| Catatan | Penagihan | teks panjang (tidak ditampilkan di tabel, muncul di laporan PDF) |

> Semua field di atas **otomatis** ikut dipakai di: form input, tabel data, template import CSV/XLSX,
> pencocokan kolom saat import, dan kolom laporan PDF/HTML.

### 🔧 Menambah / memindah kolom
Cukup edit **satu konfigurasi** di dua tempat (urutannya = urutan tampilan):
- `public/app.js` → array `PELANGGAN_FIELDS` (label, tipe, ukuran, dan `section` tujuan) + `IMPORT_LABELS`
- `server.js` → array `PELANGGAN_FIELDS` (label, tipe, alias kolom import, nilai default)

Tipe yang tersedia: `text` · `phone` · `longtext` · `select` · `currency` · `date` · `day` · `number`.
Di tabel data, tombol **⚙️ Kolom** dipakai menampilkan/menyembunyikan kolom tambahan (preferensi disimpan di browser).

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
