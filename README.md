# 📡 KolektorApp — Manajemen Data Pelanggan & Kolektor

Aplikasi web untuk mengelola data **kolektor** dan **pelanggan** (internet), lengkap dengan
**dashboard analisa**, **import file**, **export PDF**, dan **kirim pesan WhatsApp** ke pelanggan.

## ✨ Fitur

### 👤 Admin
- **Input kolektor** — tambah/edit/hapus akun kolektor (username + password).
- **Import file** — import data pelanggan dari file **CSV / XLSX** ke kolektor tertentu.
- **Export PDF** — cetak laporan data pelanggan per kolektor (ringkasan + tabel lengkap).
- **Dashboard analisa** — grafik & statistik menarik (status, pembayaran, progress pengiriman/reminder, dan rekap per kolektor).

### 🧑‍💼 Kolektor
- Hanya bisa melihat data pelanggan **miliknya sendiri** (data lain di-blokir oleh server).
- Fitur per data pelanggan: **Edit**, **Hapus**, dan **Kirim pesan** ke pelanggan (via WhatsApp).

### 📋 Data Pelanggan (per kolektor)
Form input dan tabel dibuat **rata/flat** agar sama dengan format data kolektor yang sudah digunakan sebelumnya. Urutan kolomnya:

| # | Field | Nilai |
|---|-------|-------|
| 1 | ID | boleh diisi manual (contoh `PG000163`); bila input manual dikosongkan, sistem membuat ID otomatis |
| 2 | Customer | teks **(wajib)** — dapat berisi format lama, misalnya `(PG000163) PENGADILAN AGAMA SOLOK (Aktif)` |
| 3 | Status | `Aktif` · `Blokir` · `Cuti` · `Putus` |
| 4 | Alamat Customer | teks alamat |
| 5 | Telepon Customer | nomor telepon/WA; spasi/tanda hubung dibersihkan otomatis, `62…` → `0…` |
| 6 | Bulan | bulan + tahun, misalnya `Agustus 2026`; tersimpan sebagai `YYYY-MM` |
| 7 | Total | angka — diketik biasa, tampil otomatis dengan pemisah ribuan |
| 8 | Pembayaran | `Lunas` · `Belum` |
| 9 | Pengiriman inv | `done` · `belum` |
| 10 | Reminder 1 | `done` · `belum` |
| 11 | Reminder 2 | `done` · `belum` |
| 12 | Reminder 3 | `done` · `belum` |
| 13 | Reminder 4 | `done` · `belum` |

Saat import, status dan pembayaran tidak case-sensitive. Format pembayaran lama `yes` diterjemahkan menjadi `Lunas`, sedangkan `no`/`free` menjadi `Belum`. Nilai reminder seperti `selesai`, `sudah`, `ya`, `1`, `ok`, atau `sent` diterjemahkan menjadi `done`; sisanya menjadi `belum`.

Bulan menerima tulisan bebas: `Agustus 2026`, `agu 26`, `8/2026`, `2026-08` → disimpan `2026-08`.

**Dipakai otomatis di 5 tempat:** form input · tabel data (kolom **⚙️ Kolom** untuk menyembunyikan/menampilkan kolom) · template import CSV/XLSX · pencocokan kolom saat import · laporan PDF/HTML. Di tabel, badge `belum` bisa **diklik** untuk menandai `done` tanpa membuka form.

### 🔧 Menambah / memindah / menghapus kolom
Cukup edit **satu array di dua file** (urutan array = urutan tampilan):
- `public/app.js` → `PELANGGAN_FIELDS` (label, tipe, `size: 'full'|'half'`, `def`, `required`)
  — header template CSV (`IMPORT_LABELS`) mengikuti array ini secara otomatis
- `server.js` → `PELANGGAN_FIELDS` (label, tipe, `aliases` untuk pencocokan kolom import, `def`)

Tipe tersedia: `text` · `phone` · `longtext` · `select` · `currency` · `month` · `day` · `done` · `number`.

> ⚠️ Field lama `Infrastruktur` dan `Kelompok` tidak lagi ditampilkan di form, tabel, template import, atau laporan. Data lama yang masih menyimpan kedua properti tersebut tetap aman di backup JSON.

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

Kolom header mengikuti format file kolektor lama (urutan bebas, tidak case-sensitive):

```
ID, Customer, Status, Alamat Customer, Telepon Customer, Bulan, Total, Pembayaran, Pengiriman inv, Reminder 1, Reminder 2, Reminder 3, Reminder 4
```

- `ID` **wajib diisi saat import** dan boleh digunakan kembali pada bulan yang berbeda.
- Header lama seperti `Nama Pelanggan`, `No HP / WA`, `Telpon Customer`, `Bulan Tagihan`, `Jumlah Tagihan`, dan `Tagihan` tetap dikenali.
- Nilai status/pembayaran dinormalisasi otomatis, misalnya `aktif` → `Aktif` dan `yes`/`lunas` → `Lunas`.
- Contoh sesuai format data sebelumnya:

```csv
ID,Customer,Status,Alamat Customer,Telepon Customer,Bulan,Total,Pembayaran,Pengiriman inv,Reminder 1,Reminder 2,Reminder 3,Reminder 4
PG000163,"(PG000163) PENGADILAN AGAMA SOLOK (Aktif)",Aktif,"JL. KAPT. BAHAR HAMID, KEL LAING, KEC. TJ. HARAPAN, KOTA SOLOK",085237571144,"Agustus 2026",14000000,Lunas,belum,belum,belum,belum,belum
```

> Untuk tambah pelanggan manual, kolom ID bersifat opsional: jika diisi akan dipakai (harus unik), jika dikosongkan sistem membuatkan ID otomatis.

> 💡 Template dapat diunduh langsung dari halaman **Dashboard → Unduh Template Import** atau endpoint `/api/template.csv`.

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
