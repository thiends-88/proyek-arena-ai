# 🚀 Panduan Deploy ke Server Lokal Proxmox

Panduan ini menjelaskan cara memindahkan **KolektorApp** ke server **Proxmox VE** milik Anda,
mulai dari membuat container/VM sampai aplikasi berjalan otomatis & bisa diakses dari jaringan lokal.

---

## Ringkasan Kebutuhan

| Komponen | Keterangan |
|----------|------------|
| Sistem | Linux (Debian/Ubuntu) — disarankan **LXC Container** (ringan) |
| Runtime | **Node.js 18 / 20 / 22** (LTS) |
| Port | **3000** (bisa diubah) |
| Database | **File JSON** (`data/db.json`) — tidak butuh MySQL/PostgreSQL |
| Internet | Tidak wajib saat runtime (Chart.js sudah dibundel lokal) |

> 💡 Aplikasi ini **stateless terhadap DB eksternal** — semua data tersimpan di file `data/db.json`.
> Backup cukup dengan menyalin folder `data/`.

---

## A. Buat Container / VM di Proxmox

### Opsi 1 — LXC Container (direkomendasikan, paling hemat resource)

1. Di Proxmox UI: pilih node → **Create CT**.
2. Pilih **Template** distro, mis. `ubuntu-22.04-standard` atau `debian-12-standard`.
   (Kalau template belum ada: pilih storage `local` → **CT Templates** → **Templates** → download.)
3. Atur resource: **CPU 1**, **RAM 512–1024 MB**, **Disk 4–8 GB** (sudah lebih dari cukup).
4. **Network**: pakai `bridge` (`vmbr0`) dengan **DHCP** atau IP statis LAN Anda.
5. Selesai → **Start** container → buka **Console**.

> Alternatif via shell Proxmox (opsional):
> ```bash
> pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
>   --hostname kolektorapp --storage local-lvm --rootfs local-lvm:8 \
>   --cores 1 --memory 1024 --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1
> pct start 100
> pct enter 100
> ```

### Opsi 2 — VM (Virtual Machine)

1. **Create VM** → install **Ubuntu Server 22.04/24.04** atau **Debian 12** seperti biasa.
2. Setelah install, login via SSH atau Console Proxmox.

---

## B. Install Node.js

Jalankan perintah berikut di dalam container/VM:

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS dari NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Cek versi
node -v      # harus v20.x atau v22.x
npm -v
```

---

## C. Ambil Kode Aplikasi

### Cara 1 — Git clone (paling mudah)

```bash
cd /opt
sudo git clone https://github.com/thiends-88/proyek-arena-ai.git kolektorapp
cd kolektorapp

# Pastikan ada di branch terbaru (branch sesi pengembangan)
sudo git checkout arena/01a05fcb-proyek-arena-ai

# Beri hak akses ke user biasa (mis. user 'kolektor' atau user login Anda)
sudo chown -R $USER:$USER /opt/kolektorapp
```

### Cara 2 — Salin manual dari komputer Anda (tanpa internet)

Di **komputer lokal** Anda:

```bash
# Buat arsip (tanpa node_modules & data)
cd /path/ke/proyek-arena-ai
tar --exclude=node_modules --exclude=data -czf kolektorapp.tar.gz \
  server.js package.json package-lock.json public README.md
```

Kirim ke server:

```bash
scp kolektorapp.tar.gz user@<IP-SERVER>:/tmp/
```

Di **server**:

```bash
sudo mkdir -p /opt/kolektorapp
sudo tar -xzf /tmp/kolektorapp.tar.gz -C /opt/kolektorapp
cd /opt/kolektorapp
sudo chown -R $USER:$USER /opt/kolektorapp
```

---

## D. Install Dependensi & Tes Jalan

```bash
cd /opt/kolektorapp

# Install dependensi
npm install

# Jalankan tes
npm start
```

Kalau muncul:

```
Aplikasi berjalan di http://0.0.0.0:3000
Login admin: admin / admin123
```

berarti sukses. Buka `http://<IP-SERVER>:3000` di browser → login `admin` / `admin123`.

> **PENTING:** Segera ganti password default di langkah Keamanan (bagian G) sebelum dipakai sungguhan.

Tekan `Ctrl+C` untuk berhenti dulu (nanti dijalankan sebagai service).

---

## D2. Migrasi Data / Database (PENTING)

> 💡 **Konsep database aplikasi ini:** semua data tersimpan dalam **satu file JSON**
> di `data/db.json`. Folder `data/` **tidak ada di GitHub** (sengaja di-ignore). Saat
> pertama kali dijalankan, aplikasi **membuat `data/db.json` otomatis** berisi data contoh
> (demo). Untuk memindahkan data asli Anda, gunakan salah satu cara berikut.

### Cara A — Migrasi lewat file (paling akurat)

1. **Di aplikasi lama** (tempat data Anda berada sekarang):
   - Login admin → menu **💾 Backup & Restore** → **Buat Backup** → **📋 Salin Semua**.
   - Simpan teksnya ke file `db.json` di komputer Anda.

2. **Kirim ke server Proxmox** (dari komputer Anda):
   ```bash
   scp db.json user@<IP-SERVER>:/tmp/db.json
   ```

3. **Di server**, hentikan aplikasi lalu timpa:
   ```bash
   sudo systemctl stop kolektorapp
   sudo mkdir -p /opt/kolektorapp/data
   sudo cp /tmp/db.json /opt/kolektorapp/data/db.json
   sudo chown $USER:$USER /opt/kolektorapp/data/db.json
   sudo systemctl start kolektorapp
   ```

### Cara B — Migrasi lewat UI aplikasi

1. Di server, aplikasi sudah berjalan → login admin.
2. Menu **💾 Backup & Restore** → **Restore Data** → pilih file `backup-*.json` → **Restore Sekarang**.
3. Selesai. (Setelah restore, Anda mungkin perlu login ulang.)

### Cara C — Tanpa data lama (mulai kosong / data contoh)

- Cukup jalankan aplikasi; `data/db.json` dibuat otomatis berisi **data contoh**.
- Untuk data asli Anda, gunakan menu **Data Pelanggan → Import** dengan file CSV/XLSX Anda.

---

## E. Jalankan sebagai Service (auto-start saat server menyala)

Buat file service systemd:

```bash
sudo nano /etc/systemd/system/kolektorapp.service
```

Isi dengan:

```ini
[Unit]
Description=KolektorApp - Manajemen Data Pelanggan
After=network.target

[Service]
Type=simple
# Ganti 'kolektor' dengan user Linux Anda
User=kolektor
WorkingDirectory=/opt/kolektorapp
ExecStart=/usr/bin/node /opt/kolektorapp/server.js
Restart=always
RestartSec=3
# Opsional: set port & node environment
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Simpan, lalu aktifkan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kolektorapp
sudo systemctl status kolektorapp     # cek status
sudo journalctl -u kolektorapp -f     # lihat log realtime
```

Sekarang aplikasi otomatis jalan kembali meski server di-reboot.

---

## F. Buka Akses dari Jaringan (Firewall)

Aplikasi sudah mendengarkan di `0.0.0.0:3000`, jadi tinggal pastikan firewall membuka port:

```bash
# Jika pakai ufw
sudo ufw allow 3000/tcp
sudo ufw status
```

Akses dari komputer lain di LAN:

```
http://<IP-SERVER>:3000
```

> Bila perlu akses lewat **port 80** (tanpa `:3000`), pasang Nginx sebagai reverse proxy (opsional):

```bash
sudo apt install -y nginx
```

```bash
sudo nano /etc/nginx/sites-available/kolektorapp
```

```nginx
server {
    listen 80;
    server_name <IP-SERVER-ATAU-DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kolektorapp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## G. Keamanan & Akun (WAJIB sebelum dipakai)

**1. Ganti password admin** (akun `admin` / `admin123`):

- Login sebagai admin → klik ikon **🔑** di pojok kiri bawah (samping tombol keluar).
- Isi **password lama** (`admin123`) → **password baru** → **ulangi password baru** → **Simpan**.

**2. Ganti password tiap kolektor** (default `kolektor123`):

- Login sebagai admin → menu **Kolektor** → klik ikon **✏️** pada baris kolektor.
- Isi **Password** baru (biarkan nama tetap) → **Simpan**.

**3. Amankan jaringan:**

- Batasi akses hanya ke jaringan lokal (jangan buka port ke internet tanpa HTTPS).
- Untuk akses dari luar kantor, gunakan **VPN** (WireGuard/Tailscale) daripada mengekspos port.

---

## H. Backup Data (PENTING — data tersimpan di file JSON)

**Cara 1 — Dari aplikasi (disarankan):**

Login sebagai admin → menu **💾 Backup & Restore**:
- **Backup**: klik "Buat Backup" → salin seluruh teks (tombol *Salin Semua*) atau unduh file
  `backup-kolektorapp-YYYY-MM-DD.json`.
- **Restore**: pilih file backup (.json) → "Restore Sekarang" (seluruh data saat ini akan diganti).

**Cara 2 — Langsung dari file di server:**

Semua data ada di `/opt/kolektorapp/data/db.json`. Backup cukup dengan menyalin satu file itu:

```bash
# Backup manual
cp /opt/kolektorapp/data/db.json /root/backup/db-$(date +%F).json

# Backup otomatis harian via cron
sudo crontab -e
# tambahkan:
0 2 * * * cp /opt/kolektorapp/data/db.json /root/backup/db-$(date +\%F).json
```

Restore:

```bash
sudo systemctl stop kolektorapp
cp /root/backup/db-2026-09-01.json /opt/kolektorapp/data/db.json
sudo systemctl start kolektorapp
```

---

## I. Update Aplikasi (saat ada versi baru)

Versi terbaru (termasuk **tampilan responsive mobile**) ada di branch `arena/01a05fcb-proyek-arena-ai`.

```bash
cd /opt/kolektorapp
git fetch origin
git checkout arena/01a05fcb-proyek-arena-ai      # cukup sekali; selanjutnya langsung git pull
git pull origin arena/01a05fcb-proyek-arena-ai
npm install
sudo systemctl restart kolektorapp
```

> Data di `data/db.json` **tidak** terpengaruh oleh `git pull` (folder `data/` di-ignore git).

> Setelah update, buka aplikasi di HP lalu **refresh** (tarik ke bawah / tekan ⟳). Jika tampilan lama masih
> muncul, tutup tab browser lalu buka kembali — server sudah mengirim header no-cache sehingga file baru
> otomatis dipakai.

---

## Ringkasan Cepat

1. Buat **LXC/VM** (Ubuntu/Debian) di Proxmox.
2. Install **Node.js 20 LTS**.
3. `git clone` repo → `npm install` → `npm start` (tes).
4. Daftarkan sebagai **systemd service**.
5. Buka firewall port **3000** → akses `http://IP:3000`.
6. Ganti **password default** + siapkan **backup `data/db.json`**.
