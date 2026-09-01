/**
 * Aplikasi Manajemen Data Pelanggan & Kolektor
 * - Admin: input kolektor, import file, export PDF, dashboard analisa
 * - Kolektor: kelola data pelanggan masing-masing (edit, hapus, kirim pesan)
 *
 * Stack: Express + JSON file storage. Import via SheetJS (CSV/XLSX), export PDF via pdfkit.
 */
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ---------------------------------------------------------------------------
// Konstanta opsi (harus sinkron dengan frontend)
// ---------------------------------------------------------------------------
const STATUS_OPTIONS = ['aktif', 'blokir', 'putus', 'cuti'];
const INFRA_OPTIONS = ['wireless', 'fiber optic'];
const TAGIHAN_OPTIONS = ['yes', 'no', 'free'];
const KELOMPOK_OPTIONS = [
  'pelanggan lancar',
  'minta invoice',
  'butuh konfirmasi',
  'blokir dulu baru bayar',
  'bayar ke kantor',
  'minta jemput',
];

// ---------------------------------------------------------------------------
// Data layer (JSON file)
// ---------------------------------------------------------------------------
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDB() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const db = seedDB();
    saveDB(db);
    return db;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    const db = seedDB();
    saveDB(db);
    return db;
  }
}

function saveDB(db) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------
function uid(prefix) {
  return prefix + '-' + crypto.randomBytes(6).toString('hex');
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

function normKey(k) {
  return String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normStatus(v) {
  const s = String(v).toLowerCase().trim();
  if (s.includes('aktif')) return 'aktif';
  if (s.includes('blokir') || s.includes('blok')) return 'blokir';
  if (s.includes('putus')) return 'putus';
  if (s.includes('cuti')) return 'cuti';
  return null;
}

function normInfra(v) {
  const s = String(v).toLowerCase().trim();
  if (s.includes('fiber') || s.includes('fo') || s === 'optik' || s.includes('optic')) return 'fiber optic';
  if (s.includes('wireless') || s.includes('nirkabel') || s.includes('wifi')) return 'wireless';
  return null;
}

function normTagihan(v) {
  const s = String(v).toLowerCase().trim();
  if (['yes', 'y', 'ya', '1', 'ada', 'aktif'].includes(s)) return 'yes';
  if (['no', 'n', 'tidak', '0', 'tdk'].includes(s)) return 'no';
  if (['free', 'gratis', 'f'].includes(s)) return 'free';
  return null;
}

function normKelompok(v) {
  const s = String(v).toLowerCase().trim();
  const map = {
    'pelangganlancar': 'pelanggan lancar',
    'lancar': 'pelanggan lancar',
    'mintainvoice': 'minta invoice',
    'invoice': 'minta invoice',
    'butuhkonfirmasi': 'butuh konfirmasi',
    'konfirmasi': 'butuh konfirmasi',
    'blokirdulubarubayar': 'blokir dulu baru bayar',
    'blokirdulubayar': 'blokir dulu baru bayar',
    'bayarkekantor': 'bayar ke kantor',
    'kantor': 'bayar ke kantor',
    'mintajemput': 'minta jemput',
    'jemput': 'minta jemput',
  };
  const key = normKey(s);
  if (map[key]) return map[key];
  // fallback: cari substring
  if (s.includes('lancar')) return 'pelanggan lancar';
  if (s.includes('invoice')) return 'minta invoice';
  if (s.includes('konfirmasi')) return 'butuh konfirmasi';
  if (s.includes('blokir') && s.includes('bayar')) return 'blokir dulu baru bayar';
  if (s.includes('kantor')) return 'bayar ke kantor';
  if (s.includes('jemput')) return 'minta jemput';
  return null;
}

function parseNumber(v) {
  if (v === null || v === undefined) return 0;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Seed data awal
// ---------------------------------------------------------------------------
function seedDB() {
  const kolektor1 = { id: uid('klk'), username: 'andi', name: 'Andi Saputra', role: 'kolektor', password: hashPassword('kolektor123') };
  const kolektor2 = { id: uid('klk'), username: 'budi', name: 'Budi Santoso', role: 'kolektor', password: hashPassword('kolektor123') };
  const kolektor3 = { id: uid('klk'), username: 'citra', name: 'Citra Lestari', role: 'kolektor', password: hashPassword('kolektor123') };
  const kolektors = [kolektor1, kolektor2, kolektor3];

  const names = [
    'Bambang Sutrisno', 'Siti Aminah', 'Agus Prasetyo', 'Dewi Kartika', 'Eko Wijaya',
    'Rina Marlina', 'Hendra Gunawan', 'Lilis Suryani', 'Joko Susilo', 'Maya Anggraini',
    'Fajar Nugroho', 'Nur Hayati', 'Rudi Hartono', 'Sri Wahyuni', 'Tono Santoso',
    'Wati Kurnia', 'Yanto Prabowo', 'Zahra Fitriani', 'Adi Setiawan', 'Bella Safira',
    'Candra Wijaya', 'Dina Oktaviani', 'Eko Prasetyo', 'Fitri Handayani', 'Galih Permana',
    'Hesti Rahayu', 'Iwan Setiawan', 'Jumiati', 'Krisna Aditya', 'Lestari Ningrum',
    'Miftahul Huda', 'Nadia Ramadhani', 'Oki Firmansyah', 'Putri Ayu', 'Rizky Ramadhan',
    'Sari Dewi', 'Taufik Hidayat', 'Umi Kulsum', 'Vina Melinda', 'Wawan Setiawan',
    'Yuni Astuti', 'Zainal Abidin', 'Ayu Lestari', 'Bagus Saputra', 'Cici Paramita',
    'Dedi Kurniawan', 'Elsa Maharani', 'Fauzi Rahman', 'Gita Puspita', 'Hari Mulyadi',
    'Indah Permata', 'Jajang Nurjaman', 'Kiki Amelia', 'Lukman Hakim', 'Mila Rosita',
    'Nanda Pratama', 'Oscar Simanjuntak', 'Puspita Dewi', 'Qori Amelia', 'Restu Wibowo',
    'Sinta Nurjanah', 'Teguh Prasetyo', 'Ujang Koswara', 'Vera Susanti', 'Widya Kusuma',
  ];

  // pseudo-random deterministik agar data seed bervariasi & konsisten
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  const pelanggan = [];
  names.forEach((nama, i) => {
    const kolektor = kolektors[i % 3];
    const roll = rnd();
    let status = 'aktif';
    if (roll < 0.6) status = 'aktif';
    else if (roll < 0.78) status = 'blokir';
    else if (roll < 0.9) status = 'cuti';
    else status = 'putus';

    const infrastruktur = pick(INFRA_OPTIONS);

    let tagihan = 'no';
    if (status === 'aktif') tagihan = rnd() < 0.85 ? 'yes' : 'no';
    else if (status === 'cuti') tagihan = rnd() < 0.5 ? 'free' : 'no';
    else if (status === 'blokir') tagihan = rnd() < 0.7 ? 'no' : 'yes';

    let kelompok = 'pelanggan lancar';
    if (status === 'blokir') kelompok = pick(['blokir dulu baru bayar', 'butuh konfirmasi', 'minta invoice']);
    else if (status === 'putus') kelompok = pick(['butuh konfirmasi', 'bayar ke kantor']);
    else if (status === 'cuti') kelompok = pick(['minta invoice', 'butuh konfirmasi', 'bayar ke kantor']);
    else kelompok = pick(['pelanggan lancar', 'minta invoice', 'minta jemput', 'bayar ke kantor', 'butuh konfirmasi']);

    let jumlahTagihan = 0;
    if (tagihan === 'yes') jumlahTagihan = Math.round((150000 + rnd() * 400000) / 1000) * 1000;
    else if (tagihan === 'free') jumlahTagihan = 0;

    const noHp = '08' + String(1200000000 + Math.floor(rnd() * 879999999)).padStart(10, '0');
    pelanggan.push({
      id: 'PLG-' + String(i + 1).padStart(4, '0'),
      kolektorId: kolektor.id,
      nama,
      noHp,
      status,
      infrastruktur,
      tagihan,
      kelompok,
      jumlahTagihan,
      createdAt: new Date().toISOString(),
    });
  });

  return {
    meta: { seqPelanggan: pelanggan.length, seqKolektor: kolektors.length },
    users: [{ id: uid('adm'), username: 'admin', name: 'Administrator', role: 'admin', password: hashPassword('admin123') }, ...kolektors],
    pelanggan,
    pesan: [],
  };
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 },
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Nonaktifkan cache untuk file statis agar browser selalu memuat versi terbaru
app.use((req, res, next) => {
  if (req.path === '/' || /\.(html|js|css)$/.test(req.path)) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// --- Auth helpers ---
// Token-based auth (lebih andal di dalam iframe/preview yang memblokir cookie pihak ketiga).
const tokenStore = new Map(); // token -> userId

function extractToken(req) {
  let token = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();
  if (!token && req.query && req.query.token) token = String(req.query.token);
  if (!token && req.body && req.body.token) token = String(req.body.token);
  return token;
}

function currentUser(req) {
  const token = extractToken(req);
  if (token && tokenStore.has(token)) {
    const u = db.users.find((x) => x.id === tokenStore.get(token));
    if (u) return u;
  }
  // fallback: session cookie (lingkungan non-iframe)
  if (req.session && req.session.userId) {
    return db.users.find((u) => u.id === req.session.userId) || null;
  }
  return null;
}
function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  req.user = u;
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Akses khusus admin.' });
  next();
}

// Logging diagnostik untuk permintaan API (membantu men-debug masalah login/preview)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const token = extractToken(req);
    const u = currentUser(req);
    console.log(`[REQ] ${req.method} ${req.path} | token=${token ? 'ya' : 'tidak'} | session=${req.session && req.session.userId ? 'ya' : 'tidak'} | user=${u ? u.username : 'null'}`);
  }
  next();
});

// --- Auth API ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.users.find((x) => x.username === String(username || '').trim().toLowerCase());
  if (!u || !verifyPassword(password, u.password)) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  req.session.userId = u.id; // tetap set session sebagai fallback
  const token = crypto.randomBytes(24).toString('hex');
  tokenStore.set(token, u.id);
  res.json({ user: publicUser(u), token });
});

app.post('/api/logout', (req, res) => {
  const token = extractToken(req);
  if (token) tokenStore.delete(token);
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Belum login.' });
  res.json({ user: publicUser(u) });
});

// --- Kolektor (admin) ---
app.get('/api/kolektor', requireAuth, requireAdmin, (req, res) => {
  const list = db.users.filter((u) => u.role === 'kolektor').map((u) => {
    const pl = db.pelanggan.filter((p) => p.kolektorId === u.id);
    return {
      ...publicUser(u),
      jumlahPelanggan: pl.length,
      totalTagihan: pl.reduce((s, p) => s + (p.jumlahTagihan || 0), 0),
    };
  });
  res.json({ kolektor: list });
});

app.post('/api/kolektor', requireAuth, requireAdmin, (req, res) => {
  const { name, username, password } = req.body || {};
  const uname = String(username || '').trim().toLowerCase();
  if (!uname || !name) return res.status(400).json({ error: 'Nama dan username wajib diisi.' });
  if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) return res.status(400).json({ error: 'Username 3-30 karakter (huruf/angka/._-).' });
  if (db.users.some((u) => u.username === uname)) return res.status(400).json({ error: 'Username sudah dipakai.' });
  if (!password || String(password).length < 4) return res.status(400).json({ error: 'Password minimal 4 karakter.' });

  db.meta.seqKolektor += 1;
  const user = { id: uid('klk'), username: uname, name: String(name).trim(), role: 'kolektor', password: hashPassword(password) };
  db.users.push(user);
  saveDB(db);
  res.json({ user: publicUser(user) });
});

app.put('/api/kolektor/:id', requireAuth, requireAdmin, (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id && x.role === 'kolektor');
  if (!u) return res.status(404).json({ error: 'Kolektor tidak ditemukan.' });
  const { name, password } = req.body || {};
  if (name) u.name = String(name).trim();
  if (password) {
    if (String(password).length < 4) return res.status(400).json({ error: 'Password minimal 4 karakter.' });
    u.password = hashPassword(password);
  }
  saveDB(db);
  res.json({ user: publicUser(u) });
});

app.delete('/api/kolektor/:id', requireAuth, requireAdmin, (req, res) => {
  const idx = db.users.findIndex((x) => x.id === req.params.id && x.role === 'kolektor');
  if (idx === -1) return res.status(404).json({ error: 'Kolektor tidak ditemukan.' });
  const [removed] = db.users.splice(idx, 1);
  db.pelanggan = db.pelanggan.filter((p) => p.kolektorId !== removed.id);
  db.pesan = db.pesan.filter((p) => p.kolektorId !== removed.id);
  saveDB(db);
  res.json({ ok: true });
});

// --- Pelanggan ---
function scopedPelanggan(user) {
  if (user.role === 'admin') return db.pelanggan;
  return db.pelanggan.filter((p) => p.kolektorId === user.id);
}

app.get('/api/pelanggan', requireAuth, (req, res) => {
  let list = scopedPelanggan(req.user);
  const { kolektorId } = req.query;
  if (req.user.role === 'admin' && kolektorId) {
    list = list.filter((p) => p.kolektorId === kolektorId);
  }
  const kolektorNames = {};
  db.users.forEach((u) => { kolektorNames[u.id] = u.name; });
  res.json({ pelanggan: list.map((p) => ({ ...p, kolektorNama: kolektorNames[p.kolektorId] || '-' })) });
});

function validatePelanggan(body) {
  const nama = String(body.nama || '').trim();
  const noHp = String(body.noHp || '').trim();
  if (!nama) return { error: 'Nama pelanggan wajib diisi.' };
  if (!noHp) return { error: 'No HP/WA wajib diisi.' };
  const status = STATUS_OPTIONS.includes(body.status) ? body.status : 'aktif';
  const infrastruktur = INFRA_OPTIONS.includes(body.infrastruktur) ? body.infrastruktur : 'wireless';
  const tagihan = TAGIHAN_OPTIONS.includes(body.tagihan) ? body.tagihan : 'no';
  const kelompok = KELOMPOK_OPTIONS.includes(body.kelompok) ? body.kelompok : 'pelanggan lancar';
  const jumlahTagihan = parseNumber(body.jumlahTagihan);
  return { data: { nama, noHp, status, infrastruktur, tagihan, kelompok, jumlahTagihan } };
}

app.post('/api/pelanggan', requireAuth, (req, res) => {
  const v = validatePelanggan(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  let kolektorId = req.user.id;
  if (req.user.role === 'admin' && req.body.kolektorId) {
    const k = db.users.find((u) => u.id === req.body.kolektorId && u.role === 'kolektor');
    if (!k) return res.status(400).json({ error: 'Kolektor tidak valid.' });
    kolektorId = k.id;
  }
  // ID: gunakan ID dari input bila diisi & unik; jika kosong, buat otomatis.
  let id = String(req.body.id || '').trim();
  if (id) {
    if (db.pelanggan.some((p) => p.id === id)) {
      return res.status(400).json({ error: 'ID "' + id + '" sudah digunakan. Gunakan ID lain.' });
    }
  } else {
    db.meta.seqPelanggan += 1;
    id = 'PLG-' + String(db.meta.seqPelanggan).padStart(4, '0');
  }
  const pelanggan = { id, kolektorId, ...v.data, createdAt: new Date().toISOString() };
  db.pelanggan.push(pelanggan);
  saveDB(db);
  res.json({ pelanggan });
});

app.put('/api/pelanggan/:id', requireAuth, (req, res) => {
  const p = db.pelanggan.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
  if (req.user.role !== 'admin' && p.kolektorId !== req.user.id) {
    return res.status(403).json({ error: 'Anda tidak punya akses ke data ini.' });
  }
  const v = validatePelanggan(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  Object.assign(p, v.data);
  if (req.user.role === 'admin' && req.body.kolektorId) {
    const k = db.users.find((u) => u.id === req.body.kolektorId && u.role === 'kolektor');
    if (k) p.kolektorId = k.id;
  }
  saveDB(db);
  res.json({ pelanggan: p });
});

app.delete('/api/pelanggan/:id', requireAuth, (req, res) => {
  const idx = db.pelanggan.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
  const p = db.pelanggan[idx];
  if (req.user.role !== 'admin' && p.kolektorId !== req.user.id) {
    return res.status(403).json({ error: 'Anda tidak punya akses ke data ini.' });
  }
  db.pelanggan.splice(idx, 1);
  db.pesan = db.pesan.filter((m) => m.pelangganId !== p.id);
  saveDB(db);
  res.json({ ok: true });
});

// --- Pesan (WhatsApp) ---
app.post('/api/pelanggan/:id/message', requireAuth, (req, res) => {
  const p = db.pelanggan.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
  if (req.user.role !== 'admin' && p.kolektorId !== req.user.id) {
    return res.status(403).json({ error: 'Anda tidak punya akses ke data ini.' });
  }
  const teks = String(req.body.teks || '').trim();
  if (!teks) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  const msg = { id: uid('msg'), pelangganId: p.id, kolektorId: req.user.id, teks, waktu: new Date().toISOString() };
  db.pesan.push(msg);
  saveDB(db);
  res.json({ ok: true, wa: waLink(p.noHp, teks) });
});

app.get('/api/pesan', requireAuth, (req, res) => {
  let list = req.user.role === 'admin' ? db.pesan : db.pesan.filter((m) => m.kolektorId === req.user.id);
  const names = {};
  db.pelanggan.forEach((p) => { names[p.id] = p.nama; });
  const users = {};
  db.users.forEach((u) => { users[u.id] = u.name; });
  list = list
    .slice()
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
    .slice(0, 50)
    .map((m) => ({ ...m, pelangganNama: names[m.pelangganId] || '-', kolektorNama: users[m.kolektorId] || '-' }));
  res.json({ pesan: list });
});

function waLink(noHp, teks) {
  let digits = String(noHp).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(teks);
}

// --- Import file (CSV / XLSX) ---
app.post('/api/import', requireAuth, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
  const kolektorId = req.body.kolektorId;
  const k = db.users.find((u) => u.id === kolektorId && u.role === 'kolektor');
  if (!k) return res.status(400).json({ error: 'Pilih kolektor tujuan terlebih dahulu.' });

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch (e) {
    return res.status(400).json({ error: 'Gagal membaca file. Pastikan format CSV/XLSX benar.' });
  }
  if (!rows.length) return res.status(400).json({ error: 'File kosong / tidak ada baris data.' });

  const FIELD_MAP = {
    id: 'id',
    nama: 'nama', namapelanggan: 'nama', namapelangggan: 'nama', pelanggan: 'nama',
    nohp: 'noHp', hp: 'noHp', nohpwa: 'noHp', nowa: 'noHp', whatsapp: 'noHp', wa: 'noHp', notelepon: 'noHp', notelp: 'noHp', telepon: 'noHp', nomor: 'noHp',
    status: 'status',
    infrastruktur: 'infrastruktur', infra: 'infrastruktur',
    tagihan: 'tagihan', statustagihan: 'tagihan',
    kelompok: 'kelompok',
    jumlahtagihan: 'jumlahTagihan', jumlah: 'jumlahTagihan', nominal: 'jumlahTagihan', nominaltagihan: 'jumlahTagihan', tagihanjumlah: 'jumlahTagihan',
  };

  const imported = [];
  const errors = [];
  const importedIds = new Set();
  rows.forEach((raw, i) => {
    const mapped = {};
    Object.keys(raw).forEach((key) => {
      const canon = FIELD_MAP[normKey(key)];
      if (canon) mapped[canon] = raw[key];
    });
    if (!mapped.nama && !mapped.noHp) {
      errors.push(`Baris ${i + 2}: tidak ada kolom nama/no HP yang dikenali.`);
      return;
    }
    const nama = String(mapped.nama || '').trim();
    const noHp = String(mapped.noHp || '').trim();
    if (!nama && !noHp) return; // baris kosong
    if (!nama) { errors.push(`Baris ${i + 2}: nama kosong.`); return; }
    if (!noHp) { errors.push(`Baris ${i + 2}: no HP kosong.`); return; }

    // ID mengikuti data import (tidak dibuat otomatis oleh sistem)
    const id = (mapped.id === null || mapped.id === undefined) ? '' : String(mapped.id).trim();
    if (!id) {
      errors.push(`Baris ${i + 2}: ID kosong — baris dilewati (ID harus diisi sesuai data Anda).`);
      return;
    }
    if (db.pelanggan.some((p) => p.id === id) || importedIds.has(id)) {
      errors.push(`Baris ${i + 2}: ID "${id}" sudah ada / duplikat — baris dilewati.`);
      return;
    }
    importedIds.add(id);

    const status = normStatus(mapped.status) || 'aktif';
    const infrastruktur = normInfra(mapped.infrastruktur) || 'wireless';
    const tagihan = normTagihan(mapped.tagihan) || 'no';
    const kelompok = normKelompok(mapped.kelompok) || 'pelanggan lancar';
    const jumlahTagihan = parseNumber(mapped.jumlahTagihan);

    db.pelanggan.push({ id, kolektorId: k.id, nama, noHp, status, infrastruktur, tagihan, kelompok, jumlahTagihan, createdAt: new Date().toISOString() });
    imported.push({ id, nama, noHp });
  });

  saveDB(db);
  res.json({ imported: imported.length, errors, kolektor: k.name });
});

// --- Template import ---
app.get('/api/template.csv', requireAuth, requireAdmin, (req, res) => {
  const header = ['ID', 'Nama Pelanggan', 'No HP / WA', 'Status', 'Infrastruktur', 'Tagihan', 'Kelompok', 'Jumlah Tagihan'];
  const contoh = [
    ['P-001', 'Rudi Hartono', '081234567890', 'aktif', 'wireless', 'yes', 'pelanggan lancar', '250000'],
    ['P-002', 'Siti Aminah', '081298765432', 'blokir', 'fiber optic', 'no', 'blokir dulu baru bayar', '0'],
  ];
  const lines = [header.join(','), ...contoh.map((r) => r.join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="template-import-pelanggan.csv"');
  res.send('\uFEFF' + lines.join('\n'));
});

// --- Dashboard / analisa ---
function aggregate(list) {
  const count = (fn) => list.filter(fn).length;
  const sum = list.reduce((s, p) => s + (p.jumlahTagihan || 0), 0);
  return {
    totalPelanggan: list.length,
    totalTagihan: sum,
    aktif: count((p) => p.status === 'aktif'),
    blokir: count((p) => p.status === 'blokir'),
    putus: count((p) => p.status === 'putus'),
    cuti: count((p) => p.status === 'cuti'),
    statusCounts: STATUS_OPTIONS.map((s) => ({ label: s, value: count((p) => p.status === s) })),
    infraCounts: INFRA_OPTIONS.map((s) => ({ label: s, value: count((p) => p.infrastruktur === s) })),
    tagihanCounts: TAGIHAN_OPTIONS.map((s) => ({ label: s, value: count((p) => p.tagihan === s) })),
    kelompokCounts: KELOMPOK_OPTIONS.map((s) => ({ label: s, value: count((p) => p.kelompok === s) })),
  };
}

app.get('/api/dashboard', requireAuth, (req, res) => {
  const list = scopedPelanggan(req.user);
  const data = aggregate(list);
  if (req.user.role === 'admin') {
    data.totalKolektor = db.users.filter((u) => u.role === 'kolektor').length;
    data.perKolektor = db.users.filter((u) => u.role === 'kolektor').map((u) => {
      const pl = db.pelanggan.filter((p) => p.kolektorId === u.id);
      const a = aggregate(pl);
      return { kolektorId: u.id, nama: u.name, username: u.username, ...a };
    });
  } else {
    data.perKolektor = [];
  }
  const names = {};
  db.pelanggan.forEach((p) => { names[p.id] = p.nama; });
  const users = {};
  db.users.forEach((u) => { users[u.id] = u.name; });
  data.recentPesan = db.pesan
    .filter((m) => req.user.role === 'admin' || m.kolektorId === req.user.id)
    .slice()
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
    .slice(0, 8)
    .map((m) => ({ ...m, pelangganNama: names[m.pelangganId] || '-', kolektorNama: users[m.kolektorId] || '-' }));
  res.json(data);
});

// --- Export HTML (tampilan laporan di halaman, bisa dicetak/simpan sebagai PDF) ---
app.get('/api/export/:kolektorId/html', requireAuth, requireAdmin, (req, res) => {
  const k = db.users.find((u) => u.id === req.params.kolektorId && u.role === 'kolektor');
  if (!k) return res.status(404).json({ error: 'Kolektor tidak ditemukan.' });
  const pelanggan = db.pelanggan.filter((p) => p.kolektorId === k.id);
  const a = aggregate(pelanggan);
  const today = new Date().toLocaleString('id-ID', { dateStyle: 'long' });

  const rows = pelanggan.map((p, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${escHtml(p.id)}</td>
      <td>${escHtml(p.nama)}</td>
      <td>${escHtml(p.noHp)}</td>
      <td><span class="pill pill-${escHtml(p.status)}">${escHtml(p.status)}</span></td>
      <td>${escHtml(p.infrastruktur)}</td>
      <td>${escHtml(p.tagihan)}</td>
      <td>${escHtml(p.kelompok)}</td>
      <td class="r">${(p.jumlahTagihan || 0).toLocaleString('id-ID')}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Laporan ${escHtml(k.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
  .head { border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
  .head h1 { margin: 0; font-size: 20px; }
  .head p { margin: 2px 0; font-size: 13px; color: #334155; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 28px; margin-bottom: 16px; font-size: 13px; }
  .meta b { color: #0f766e; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .card { flex: 1 1 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
  .card .v { font-size: 20px; font-weight: 800; }
  .card .l { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #0f172a; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pill-aktif { background:#dcfce7; color:#15803d; }
  .pill-blokir { background:#fee2e2; color:#b91c1c; }
  .pill-putus { background:#e2e8f0; color:#475569; }
  .pill-cuti { background:#fef3c7; color:#b45309; }
  .foot { margin-top: 14px; font-size: 11px; color: #94a3b8; }
  @media print {
    body { padding: 0; }
    @page { size: A4 landscape; margin: 10mm; }
    .foot { display: none; }
  }
</style></head>
<body>
  <div class="head">
    <h1>Laporan Data Pelanggan — ${escHtml(k.name)}</h1>
    <p>Sistem Manajemen Kolektor &amp; Pelanggan</p>
  </div>
  <div class="meta">
    <span>Nama Kolektor: <b>${escHtml(k.name)}</b></span>
    <span>Username: <b>${escHtml(k.username)}</b></span>
    <span>Tanggal: <b>${escHtml(today)}</b></span>
  </div>
  <div class="cards">
    <div class="card"><div class="v">${pelanggan.length}</div><div class="l">Total Pelanggan</div></div>
    <div class="card"><div class="v">${a.aktif}</div><div class="l">Aktif</div></div>
    <div class="card"><div class="v">${a.blokir}</div><div class="l">Blokir</div></div>
    <div class="card"><div class="v">${a.putus}</div><div class="l">Putus</div></div>
    <div class="card"><div class="v">${a.cuti}</div><div class="l">Cuti</div></div>
    <div class="card"><div class="v">${a.totalTagihan.toLocaleString('id-ID')}</div><div class="l">Total Tagihan (Rp)</div></div>
  </div>
  <table>
    <thead><tr><th>No</th><th>ID</th><th>Nama Pelanggan</th><th>No HP / WA</th><th>Status</th><th>Infrastruktur</th><th>Tagihan</th><th>Kelompok</th><th>Jumlah Tagihan</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="9">Tidak ada data.</td></tr>'}</tbody>
  </table>
  <div class="foot">Dicetak ${escHtml(today)} — KolektorApp</div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// --- Export PDF per kolektor ---
app.get('/api/export/:kolektorId/pdf', requireAuth, requireAdmin, async (req, res) => {
  const k = db.users.find((u) => u.id === req.params.kolektorId && u.role === 'kolektor');
  if (!k) return res.status(404).json({ error: 'Kolektor tidak ditemukan.' });
  const pelanggan = db.pelanggan.filter((p) => p.kolektorId === k.id);
  try {
    const buffer = await generateKolektorPDF(k, pelanggan);
    const fname = 'laporan-' + k.username + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    // view=1 → tampilkan inline (untuk dibuka di tab baru), default → unduh
    const disp = req.query.view === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', disp + '; filename="' + fname + '"');
    res.send(buffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal membuat PDF.' });
  }
});

function generateKolektorPDF(kolektor, pelanggan) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 40;
    const pageW = doc.page.width;
    const contentW = pageW - M * 2;
    const today = new Date().toLocaleString('id-ID', { dateStyle: 'long' });

    // Kop / header
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a')
      .text('LAPORAN DATA PELANGGAN', M, 40, { width: contentW, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#334155')
      .text('Sistem Manajemen Kolektor & Pelanggan', M, 58, { width: contentW, align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#0f172a')
      .text('Nama Kolektor   : ' + kolektor.name)
      .text('Username        : ' + kolektor.username)
      .text('Tanggal Cetak   : ' + today)
      .moveDown(0.6);

    // Ringkasan
    const aktif = pelanggan.filter((p) => p.status === 'aktif').length;
    const blokir = pelanggan.filter((p) => p.status === 'blokir').length;
    const putus = pelanggan.filter((p) => p.status === 'putus').length;
    const cuti = pelanggan.filter((p) => p.status === 'cuti').length;
    const totalTagihan = pelanggan.reduce((s, p) => s + (p.jumlahTagihan || 0), 0);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Ringkasan');
    const summary = [
      ['Total Pelanggan', String(pelanggan.length)],
      ['Aktif', String(aktif)],
      ['Blokir', String(blokir)],
      ['Putus', String(putus)],
      ['Cuti', String(cuti)],
      ['Total Jumlah Tagihan', 'Rp ' + totalTagihan.toLocaleString('id-ID')],
    ];
    let sy = doc.y;
    const boxW = 200;
    summary.forEach(([l, v], i) => {
      const rowH = 16;
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(l, M, sy + 3, { width: boxW - 60 });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(v, M + boxW - 60, sy + 3, { width: 60, align: 'right' });
      if (i < summary.length - 1) {
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(M, sy + rowH - 1).lineTo(M + boxW, sy + rowH - 1).stroke();
      }
      sy += rowH;
    });
    doc.moveDown(1);

    // Tabel
    const cols = [
      { label: 'No', width: 22, align: 'center' },
      { label: 'ID', width: 50, align: 'left' },
      { label: 'Nama Pelanggan', width: 90, align: 'left' },
      { label: 'No HP / WA', width: 76, align: 'left' },
      { label: 'Status', width: 40, align: 'left' },
      { label: 'Infra', width: 52, align: 'left' },
      { label: 'Tagihan', width: 38, align: 'left' },
      { label: 'Kelompok', width: 90, align: 'left' },
      { label: 'Jumlah', width: 57, align: 'right' },
    ];
    const tableW = cols.reduce((s, c) => s + c.width, 0);
    const headerH = 18;
    const cellPad = 3;
    const fontSize = 7;

    const drawHeader = () => {
      const y = doc.y;
      let x = M;
      doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#ffffff');
      doc.rect(M, y, tableW, headerH).fill('#1e293b');
      cols.forEach((c) => {
        doc.text(c.label, x + (c.align === 'right' ? c.width - cellPad : cellPad), y + headerH / 2 - 3, {
          width: c.width - cellPad * 2, align: c.align, lineBreak: false,
        });
        x += c.width;
      });
      doc.fillColor('#0f172a');
      doc.y = y + headerH;
    };

    drawHeader();

    pelanggan.forEach((p, i) => {
      const cells = [
        String(i + 1),
        p.id,
        p.nama,
        p.noHp,
        p.status,
        p.infrastruktur,
        p.tagihan,
        p.kelompok,
        'Rp ' + (p.jumlahTagihan || 0).toLocaleString('id-ID'),
      ];
      // hitung tinggi baris
      let rowH = 12;
      cols.forEach((c, ci) => {
        const h = doc.heightOfString(cells[ci], { width: c.width - cellPad * 2 }) + cellPad * 2;
        if (h > rowH) rowH = h;
      });
      if (doc.y + rowH > doc.page.height - M - 20) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      if (i % 2 === 1) {
        doc.rect(M, y, tableW, rowH).fill('#f1f5f9');
      }
      doc.font('Helvetica').fontSize(fontSize).fillColor('#1e293b');
      let x = M;
      cols.forEach((c, ci) => {
        const ty = y + (rowH - (doc.heightOfString(cells[ci], { width: c.width - cellPad * 2 }))) / 2;
        doc.text(cells[ci], x + (c.align === 'right' ? c.width - cellPad : cellPad), ty, {
          width: c.width - cellPad * 2, align: c.align, lineBreak: true,
        });
        x += c.width;
      });
      // garis bawah
      doc.strokeColor('#e2e8f0').lineWidth(0.4).moveTo(M, y + rowH).lineTo(M + tableW, y + rowH).stroke();
      doc.y = y + rowH;
    });

    // footer halaman
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7.5).fillColor('#94a3b8')
        .text('Halaman ' + (i + 1) + ' dari ' + range.count, M, doc.page.height - 30, { width: contentW, align: 'center' });
    }

    doc.end();
  });
}

// fallback SPA (opsional)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aplikasi berjalan di http://0.0.0.0:${PORT}`);
  console.log('Login admin: admin / admin123');
  console.log('Login kolektor: andi|budi|citra / kolektor123');
});
