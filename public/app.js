/* ============================================================
 * KolektorApp — Frontend SPA (vanilla JS)
 * ============================================================ */
const OPTIONS = {
  status: ['aktif', 'blokir', 'putus', 'cuti'],
  infrastruktur: ['wireless', 'fiber optic'],
  tagihan: ['yes', 'no', 'free'],
  done: ['belum', 'done'],
  kelompok: [
    'pelanggan lancar',
    'minta invoice',
    'butuh konfirmasi',
    'blokir dulu baru bayar',
    'bayar ke kantor',
    'minta jemput',
  ],
};

/* ---------- Konfigurasi form & kolom pelanggan ----------
 * SATU daftar untuk: urutan field di form input, kolom tabel data, dan header
 * template import CSV. Urutan array = urutan tampilan (rata/flat, tanpa bagian).
 *   key        : nama field di database
 *   label      : judul di form, tabel, dan template CSV
 *   type       : text | phone | longtext | select | currency | day | done
 *                (done → hanya dua pilihan: done / belum)
 *   size       : 'full' = selebar 2 kolom, 'half' = setengah baris
 *   required   : wajib diisi
 * Menghapus kolom dari semuanya: hapus barisnya di sini DAN di server.js.
 */
const PELANGGAN_FIELDS = [
  { key: 'id',            label: 'ID',                type: 'text',     size: 'half', placeholder: 'kosongkan → otomatis', hint: 'diisi otomatis bila kosong' },
  { key: 'nama',          label: 'Nama Pelanggan',    type: 'text',     size: 'full', required: true, placeholder: 'Nama lengkap' },
  { key: 'alamat',        label: 'Alamat',            type: 'longtext', size: 'full', placeholder: 'Jalan, No. Rumah, RT/RW, Desa' },
  { key: 'noHp',          label: 'No HP / WA',        type: 'phone',    size: 'half', placeholder: '08xxxxxxxxxx', inputmode: 'tel', hint: 'minimal 8 angka' },
  { key: 'status',        label: 'Status',            type: 'select', options: OPTIONS.status,        size: 'half', def: 'aktif' },
  { key: 'infrastruktur', label: 'Infrastruktur',     type: 'select', options: OPTIONS.infrastruktur, size: 'half', def: 'wireless' },
  { key: 'tagihan',       label: 'Tagihan',            type: 'select', options: OPTIONS.tagihan,       size: 'half', def: 'no' },
  { key: 'kelompok',      label: 'Kelompok',          type: 'select', options: OPTIONS.kelompok,      size: 'half', def: 'pelanggan lancar' },
  { key: 'jumlahTagihan', label: 'Jumlah Tagihan',    type: 'currency', size: 'half', def: 0 },
  { key: 'jatuhTempo',    label: 'Jatuh Tempo (tgl)', type: 'day',      size: 'half', def: 15, hint: '1–28' },
  { key: 'pengirimanInv', label: 'Pengiriman inv',    type: 'done',     size: 'half', def: 'belum' },
  { key: 'reminder1',     label: 'Reminder1', type: 'done', size: 'half', def: 'belum' },
  { key: 'reminder2',     label: 'Reminder2', type: 'done', size: 'half', def: 'belum' },
  { key: 'reminder3',     label: 'Reminder3', type: 'done', size: 'half', def: 'belum' },
  { key: 'reminder4',     label: 'Reminder4', type: 'done', size: 'half', def: 'belum' },
];

// Header template import CSV — diambil otomatis dari urutan di atas
const IMPORT_LABELS = PELANGGAN_FIELDS.map((f) => f.label);

const PALETTE = ['#0f766e', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#64748b', '#14b8a6', '#f97316', '#ec4899'];

const state = {
  user: null,
  token: null,
  view: 'dashboard',
  charts: {},
  pelanggan: [],
  kolektor: [],
  pelFilter: { search: '', kolektorId: 'all', page: 1 },
  pageSize: 15,
};

/* ---------- Util ---------- */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Aman untuk dipakai di dalam string literal JS pada atribut onclick (ID dari data import bisa berisi karakter khusus)
const jsAttr = (s) => String(s == null ? '' : s)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, '\\u0027')
  .replace(/"/g, '\\u0022')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');
const enc = (s) => encodeURIComponent(String(s == null ? '' : s));
const fmtRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const fmtRpShort = (n) => {
  n = Number(n || 0);
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace('.0', '') + ' M';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.0', '') + ' jt';
  if (n >= 1e3) return 'Rp ' + (n / 1e3).toFixed(0) + ' rb';
  return 'Rp ' + n;
};

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + esc(msg);
  $('#toast-root').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

function authedUrl(path) {
  const token = getToken();
  if (!token) return path;
  return path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
}

// Penyimpanan token yang aman: in-memory (state.token) + localStorage (jika tersedia).
// Di dalam iframe preview, akses localStorage bisa diblokir; fallback in-memory memastikan
// login tetap berfungsi selama sesi halaman tidak di-reload.
function getToken() {
  if (state.token) return state.token;
  try { return localStorage.getItem('token') || null; } catch (e) { return null; }
}
function setToken(t) {
  state.token = t || null;
  try {
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  } catch (e) { /* localStorage tidak tersedia — abaikan */ }
}

async function api(path, opts = {}) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
    // Fallback: sertakan token via query string juga, untuk berjaga-jaga bila proxy
    // preview menghapus header Authorization.
    path = authedUrl(path);
  }
  if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...opts, headers });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-json */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Terjadi kesalahan (' + res.status + ')');
    err.status = res.status;
    if (res.status === 401 && path !== '/api/login' && !/\/api\/me$/.test(path)) {
      // sesi kedaluwarsa → kembali ke login
      setToken(null);
      state.user = null;
      $('#app').classList.add('hidden');
      $('#login-screen').classList.remove('hidden');
    }
    throw err;
  }
  return data;
}

// Ambil file sebagai blob (dengan auth token).
async function fetchBlob(url) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(authedUrl(url), { headers });
  if (!res.ok) {
    let msg = 'Gagal memuat file (' + res.status + ')';
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { /* bukan JSON */ }
    throw new Error(msg);
  }
  return res.blob();
}

// Simpan blob sebagai file (best-effort — bisa diblokir di iframe/preview).
function saveBlob(blob, filename) {
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename || 'file';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 4000);
}

// Salin teks ke clipboard dengan fallback untuk lingkungan yang membatasi clipboard API.
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* lanjut ke fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

// Isi template import (di-generate di sisi klien agar selalu bisa diakses, bahkan tanpa unduhan).
function templateCSV() {
  const rows = [
    ['P-001', 'Rudi Hartono', 'Jl. Merdeka No. 12, RT 02/RW 03', '081234567890', 'aktif', 'wireless', 'yes', 'pelanggan lancar', '250000', '15', 'done', 'done', 'belum', 'belum', 'belum'],
    ['P-002', 'Siti Aminah', 'Perum Griya Indah B-7', '081298765432', 'blokir', 'fiber optic', 'no', 'blokir dulu baru bayar', '0', '20', 'belum', 'belum', 'belum', 'belum', 'belum'],
  ];
  const csvCell = (s) => (/[",\n;]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
  const lines = [IMPORT_LABELS.join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  return '\uFEFF' + lines.join('\n');
}

function downloadTemplate() {
  const csv = templateCSV();
  openModal(`
    <div class="modal-head"><h3>📥 Template Import</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="hint" style="margin-bottom:10px">
        ⚠️ Di lingkungan preview, unduhan sering diblokir. Cara paling andal: klik
        <strong>📋 Salin Semua</strong>, lalu tempel (paste) ke Excel/Notepad dan simpan sebagai <code>.csv</code>.
      </div>
      <textarea class="input" id="tpl-csv" rows="7" readonly style="font-family:monospace;font-size:12px;white-space:pre">${esc(csv)}</textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" id="tpl-download">⬇️ Unduh CSV</button>
      <button class="btn btn-primary" id="tpl-copy">📋 Salin Semua</button>
    </div>`);
  $('#tpl-copy').addEventListener('click', async () => {
    const ok = await copyText(csv);
    toast(ok ? 'Teks template disalin ke clipboard.' : 'Gagal menyalin — blok teks lalu salin manual.', ok ? 'success' : 'error');
  });
  $('#tpl-download').addEventListener('click', () => {
    try {
      saveBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), 'template-import-pelanggan.csv');
      toast('Template CSV diunduh. Jika tidak muncul, gunakan tombol "Salin Semua".');
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------- Badges ---------- */
const statusBadge = (s) => `<span class="badge b-${esc(s)}"><span class="dot"></span>${esc(s)}</span>`;
const infraBadge = (s) => {
  const cls = s === 'fiber optic' ? 'fiber-optic' : s;
  return `<span class="badge b-${cls}"><span class="dot"></span>${esc(s)}</span>`;
};
const tagihanBadge = (s) => `<span class="badge b-${esc(s)}"><span class="dot"></span>${esc(s)}</span>`;
const kelompokBadge = (s) => {
  const i = OPTIONS.kelompok.indexOf(s);
  return `<span class="badge b-kelompok${i < 0 ? 0 : i}"><span class="dot"></span>${esc(s)}</span>`;
};

/* ---------- Modal helpers ---------- */
function openModal(html, size = '') {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop">
      <div class="modal ${size}">${html}</div>
    </div>`;
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  return root;
}
function closeModal() { $('#modal-root').innerHTML = ''; }

function confirmDialog(title, message, danger = true) {
  return new Promise((resolve) => {
    openModal(`
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
      <div class="modal-body"><p style="font-size:14px;line-height:1.6">${message}</p></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="closeModal();window.__confirmResolve(false)">Batal</button>
        <button class="btn ${danger ? 'btn-primary' : 'btn-primary'}" id="confirm-yes" style="${danger ? 'background:var(--danger)' : ''}">Ya, Lanjutkan</button>
      </div>`);
    window.__confirmResolve = (v) => { closeModal(); resolve(v); };
    $('#confirm-yes').addEventListener('click', () => window.__confirmResolve(true));
  });
}

/* ---------- Auth ---------- */
async function doLogin(e) {
  e.preventDefault();
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const errEl = $('#login-error');
  errEl.classList.add('hidden');
  try {
    const { user, token } = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (token) setToken(token);
    state.user = user;
    showApp();
    toast('Selamat datang, ' + user.name + '!');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function doLogout() {
  try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
  setToken(null);
  state.user = null;
  state.pelanggan = [];
  state.kolektor = [];
  $('#app').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
  $('#login-password').value = '';
}

function openUbahPasswordModal() {
  openModal(`
    <div class="modal-head"><h3>🔑 Ubah Password</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div id="pw-error" class="form-error hidden"></div>
      <div class="form-grid">
        <div class="field full"><label>Password Lama <span class="req">*</span></label><input class="input" type="password" id="pw-lama" placeholder="Password saat ini" /></div>
        <div class="field full"><label>Password Baru <span class="req">*</span></label><input class="input" type="password" id="pw-baru" placeholder="min. 4 karakter" /></div>
        <div class="field full"><label>Ulangi Password Baru <span class="req">*</span></label><input class="input" type="password" id="pw-baru2" placeholder="Ketik ulang password baru" /></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="pw-save">Simpan</button>
    </div>`);
  $('#pw-save').addEventListener('click', async () => {
    const errEl = $('#pw-error');
    errEl.classList.add('hidden');
    const lama = $('#pw-lama').value;
    const baru = $('#pw-baru').value;
    const baru2 = $('#pw-baru2').value;
    if (!lama) { errEl.textContent = 'Password lama wajib diisi.'; errEl.classList.remove('hidden'); return; }
    if (!baru || baru.length < 4) { errEl.textContent = 'Password baru minimal 4 karakter.'; errEl.classList.remove('hidden'); return; }
    if (baru !== baru2) { errEl.textContent = 'Konfirmasi password baru tidak sama.'; errEl.classList.remove('hidden'); return; }
    try {
      await api('/api/ubah-password', { method: 'POST', body: JSON.stringify({ passwordLama: lama, passwordBaru: baru }) });
      closeModal();
      toast('Password berhasil diubah.');
    } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  });
}

function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  renderSidebar();
  go('dashboard');
}

/* ---------- Backup & Restore (admin) ---------- */
async function renderBackup() {
  const c = $('#content');
  c.innerHTML = `<div class="empty"><span class="spin">⏳</span> Memuat info data…</div>`;
  let info;
  try { info = await api('/api/backup'); } catch (e) { c.innerHTML = `<div class="empty"><div class="big">⚠️</div>${esc(e.message)}</div>`; return; }

  c.innerHTML = `
    <div class="grid two-col">
      <div class="card card-pad">
        <div class="card-head"><div><div class="card-title">💾 Backup Data</div><div class="card-sub">Simpan seluruh data aplikasi (kolektor, pelanggan, riwayat pesan) ke file JSON</div></div></div>
        <div class="list-plain" style="margin-bottom:16px">
          <li><span class="dim">Kolektor</span><strong>${info.ringkasan.kolektor}</strong></li>
          <li><span class="dim">Pelanggan</span><strong>${info.ringkasan.pelanggan}</strong></li>
          <li><span class="dim">Riwayat Pesan</span><strong>${info.ringkasan.pesan}</strong></li>
          <li><span class="dim">Waktu backup</span><strong>${new Date().toLocaleString('id-ID')}</strong></li>
        </div>
        <button class="btn btn-primary" onclick="openBackupModal()">💾 Buat Backup</button>
      </div>
      <div class="card card-pad">
        <div class="card-head"><div><div class="card-title">♻️ Restore Data</div><div class="card-sub">Pulihkan data dari file backup (.json)</div></div></div>
        <div class="hint" style="margin-bottom:12px">⚠️ <strong>Restore akan MENGGANTI seluruh data saat ini</strong> dengan isi file backup. Pastikan Anda sudah punya backup terbaru.</div>
        <div class="field" style="margin-bottom:12px"><label>File Backup (.json)</label>
          <input class="input" type="file" id="restore-file" accept=".json,application/json" /></div>
        <button class="btn btn-accent" onclick="doRestore()">♻️ Restore Sekarang</button>
        <div id="restore-result" style="margin-top:12px"></div>
      </div>
    </div>`;
}

async function openBackupModal() {
  let data;
  try { data = await api('/api/backup'); } catch (e) { toast(e.message, 'error'); return; }
  openModal(`
    <div class="modal-head"><h3>💾 Backup Data</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="hint" style="margin-bottom:10px">
        Salin seluruh teks di bawah lalu simpan ke file bernama <code>${esc(data.namaFile)}</code>.
        Di server lokal Anda, tombol <strong>⬇️ Unduh File</strong> juga berfungsi normal.
      </div>
      <textarea class="input" id="bk-json" rows="14" readonly style="font-family:monospace;font-size:11.5px;white-space:pre">${esc(data.json)}</textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" id="bk-download">⬇️ Unduh File</button>
      <button class="btn btn-primary" id="bk-copy">📋 Salin Semua</button>
    </div>`, 'wide');
  $('#bk-copy').addEventListener('click', async () => {
    const ok = await copyText(data.json);
    toast(ok ? 'Backup disalin ke clipboard.' : 'Gagal menyalin — blok teks lalu salin manual.', ok ? 'success' : 'error');
  });
  $('#bk-download').addEventListener('click', () => {
    try {
      saveBlob(new Blob([data.json], { type: 'application/json' }), data.namaFile);
      toast('Mengunduh ' + data.namaFile + '…');
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function doRestore() {
  const fileInput = document.getElementById('restore-file');
  const file = fileInput && fileInput.files[0];
  if (!file) { toast('Pilih file backup terlebih dahulu.', 'error'); return; }
  const ok = await confirmDialog('Restore Data', 'Yakin mengganti <strong>seluruh data saat ini</strong> dengan isi file backup? Data saat ini akan ditimpa.');
  if (!ok) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await api('/api/restore', { method: 'POST', body: fd });
    document.getElementById('restore-result').innerHTML = `<div class="form-error" style="background:#dcfce7;color:#15803d;margin:0">✅ Restore berhasil — ${r.ringkasan.kolektor} kolektor, ${r.ringkasan.pelanggan} pelanggan dimuat.</div>`;
    toast('Restore berhasil.');
  } catch (e) { toast(e.message, 'error'); }
}

/* ---------- Navigation ---------- */
const NAV = {
  admin: [
    { id: 'dashboard', label: 'Dashboard Analisa', ico: '📊' },
    { id: 'kolektor', label: 'Kolektor', ico: '👤' },
    { id: 'pelanggan', label: 'Data Pelanggan', ico: '📋' },
    { id: 'backup', label: 'Backup & Restore', ico: '💾' },
  ],
  kolektor: [
    { id: 'dashboard', label: 'Dashboard Saya', ico: '📊' },
    { id: 'pelanggan', label: 'Data Pelanggan', ico: '📋' },
  ],
};

function renderSidebar() {
  const u = state.user;
  $('#nav').innerHTML = (NAV[u.role] || []).map((n) =>
    `<div class="nav-item ${state.view === n.id ? 'active' : ''}" data-view="${n.id}">
       <span class="ico">${n.ico}</span> ${esc(n.label)}
     </div>`).join('');
  document.querySelectorAll('.nav-item').forEach((el) => el.addEventListener('click', () => { closeSidebar(); go(el.dataset.view); }));
  $('#user-avatar').textContent = (u.name || '?').charAt(0).toUpperCase();
  $('#user-name').textContent = u.name;
  $('#user-role').textContent = u.role === 'admin' ? 'Administrator' : 'Kolektor';
}

/* ---------- Sidebar mobile (drawer) ---------- */
// Di layar ≤ 900px sidebar disembunyikan dan dibuka lewat tombol ☰ di topbar.
function openSidebar() {
  document.body.classList.add('sidebar-open');
  const b = $('#btn-menu'); if (b) b.setAttribute('aria-expanded', 'true');
}
function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  const b = $('#btn-menu'); if (b) b.setAttribute('aria-expanded', 'false');
}
function toggleSidebar() {
  if (document.body.classList.contains('sidebar-open')) closeSidebar(); else openSidebar();
}

function go(view, opts = {}) {
  state.view = view;
  Object.values(state.charts).forEach((ch) => { try { ch.destroy(); } catch (e) {} });
  state.charts = {};
  renderSidebar();
  const titles = { dashboard: 'Dashboard Analisa', kolektor: 'Manajemen Kolektor', pelanggan: 'Data Pelanggan', backup: 'Backup & Restore Data' };
  $('#page-title').textContent = (titles[view] || 'Dashboard');
  renderTopbarActions(view);
  if (view === 'dashboard') renderDashboard();
  else if (view === 'kolektor') renderKolektor();
  else if (view === 'pelanggan') renderPelanggan(opts);
  else if (view === 'backup') renderBackup();
}

function renderTopbarActions(view) {
  const el = $('#topbar-right');
  // Di layar kecil, label tombol dipersingkat ("＋ Tambah") agar muat di samping judul halaman.
  const addBtn = (fn, objek) => `<button class="btn btn-primary" onclick="${fn}()">＋ Tambah<span class="hide-xs"> ${objek}</span></button>`;
  const dateInfo = `<span class="hint">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>`;
  if (state.user.role === 'admin') {
    if (view === 'kolektor') el.innerHTML = addBtn('openKolektorModal', 'Kolektor');
    else if (view === 'pelanggan') el.innerHTML = addBtn('openPelangganModal', 'Pelanggan');
    else el.innerHTML = dateInfo;
  } else {
    if (view === 'pelanggan') el.innerHTML = addBtn('openPelangganModal', 'Pelanggan');
    else el.innerHTML = dateInfo;
  }
}

/* ---------- Chart helper ---------- */
function renderChart(canvasId, config) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (!window.Chart) { el.parentElement.innerHTML = '<div class="empty">Chart.js tidak dapat dimuat.</div>'; return; }
  if (state.charts[canvasId]) state.charts[canvasId].destroy();
  state.charts[canvasId] = new Chart(el.getContext('2d'), config);
}

const doughnut = (labels, values, colors) => ({
  type: 'doughnut',
  data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
  options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } } },
});
const bar = (labels, values, colors, horizontal = false) => ({
  type: 'bar',
  data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, maxBarThickness: 34 }] },
  options: {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: horizontal
      ? { x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } }
      : { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } } },
  },
});

/* ---------- Dashboard ---------- */
async function renderDashboard() {
  const c = $('#content');
  c.innerHTML = `<div class="empty"><span class="spin">⏳</span> Memuat dashboard…</div>`;
  let d;
  try { d = await api('/api/dashboard'); } catch (e) { c.innerHTML = `<div class="empty"><div class="big">⚠️</div>${esc(e.message)}</div>`; return; }

  const isAdmin = state.user.role === 'admin';
  if (isAdmin && !state.kolektor.length) {
    try { state.kolektor = (await api('/api/kolektor')).kolektor; } catch (e) { /* ignore */ }
  }
  const kpis = isAdmin
    ? [
        { ico: '👥', label: 'Total Pelanggan', value: d.totalPelanggan, tone: 'tone-blue', foot: 'semua kolektor' },
        { ico: '🧑‍💼', label: 'Total Kolektor', value: d.totalKolektor, tone: 'tone-purple', foot: 'terdaftar' },
        { ico: '💰', label: 'Total Jumlah Tagihan', value: fmtRpShort(d.totalTagihan), tone: 'tone-green', foot: fmtRp(d.totalTagihan) },
        { ico: '🟢', label: 'Aktif', value: d.aktif, tone: 'tone-green', foot: 'pelanggan aktif' },
        { ico: '🔴', label: 'Blokir', value: d.blokir, tone: 'tone-red', foot: 'pelanggan diblokir' },
        { ico: '⏸️', label: 'Putus & Cuti', value: d.putus + d.cuti, tone: 'tone-amber', foot: `putus ${d.putus} · cuti ${d.cuti}` },
      ]
    : [
        { ico: '👥', label: 'Total Pelanggan', value: d.totalPelanggan, tone: 'tone-blue', foot: 'milik saya' },
        { ico: '💰', label: 'Total Jumlah Tagihan', value: fmtRpShort(d.totalTagihan), tone: 'tone-green', foot: fmtRp(d.totalTagihan) },
        { ico: '🟢', label: 'Aktif', value: d.aktif, tone: 'tone-green', foot: 'pelanggan aktif' },
        { ico: '🔴', label: 'Blokir', value: d.blokir, tone: 'tone-red', foot: 'pelanggan diblokir' },
        { ico: '⛔', label: 'Putus', value: d.putus, tone: 'tone-slate', foot: 'pelanggan putus' },
        { ico: '🌴', label: 'Cuti', value: d.cuti, tone: 'tone-amber', foot: 'pelanggan cuti' },
      ];

  c.innerHTML = `
    <div class="grid kpi-grid">
      ${kpis.map((k) => `
        <div class="card kpi ${k.tone}">
          <span class="kpi-ico">${k.ico}</span>
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${esc(k.value)}</div>
          <div class="kpi-foot">${esc(k.foot)}</div>
        </div>`).join('')}
    </div>

    <div class="grid dash-grid" style="margin-top:18px">
      ${isAdmin ? `
      <div class="col-12"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">⚡ Aksi Cepat — Import &amp; Export Data Pelanggan</div><div class="card-sub">Kelola data pelanggan banyak sekaligus atau cetak laporan PDF</div></div></div>
        <div class="quick-actions">
          <button class="btn btn-primary" onclick="openImportModal()">⬆️ Import Data Pelanggan (CSV/XLSX)</button>
          <button class="btn btn-accent" onclick="openExportModal()">📄 Export PDF Laporan</button>
          <button class="btn btn-outline" onclick="downloadTemplate()">📥 Unduh Template Import</button>
        </div>
      </div></div>` : ''}
      <div class="col-4"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">Status Pelanggan</div><div class="card-sub">Distribusi aktif / blokir / putus / cuti</div></div></div>
        <div class="chart-box"><canvas id="ch-status"></canvas></div>
      </div></div>
      <div class="col-8"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">Kelompok Pelanggan</div><div class="card-sub">Kategori penanganan pelanggan</div></div></div>
        <div class="chart-box"><canvas id="ch-kelompok"></canvas></div>
      </div></div>
      <div class="col-4"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">Infrastruktur</div><div class="card-sub">Wireless vs fiber optic</div></div></div>
        <div class="chart-box short"><canvas id="ch-infra"></canvas></div>
      </div></div>
      <div class="col-4"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">Status Tagihan</div><div class="card-sub">yes / no / free</div></div></div>
        <div class="chart-box short"><canvas id="ch-tagihan"></canvas></div>
      </div></div>
      <div class="col-4"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">Pesan Terakhir</div><div class="card-sub">Riwayat kirim pesan WA</div></div></div>
        ${d.recentPesan.length ? d.recentPesan.slice(0, 4).map((m) => `
          <div class="msg-bubble" style="margin-bottom:8px">${esc(m.teks)}
            <div class="msg-meta">→ ${esc(m.pelangganNama)} · ${esc(m.kolektorNama)} · ${new Date(m.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>`).join('') : '<div class="hint">Belum ada pesan.</div>'}
      </div></div>
      ${isAdmin ? `
      <div class="col-12"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">Total Jumlah Tagihan per Kolektor</div><div class="card-sub">Perbandingan antar kolektor</div></div></div>
        <div class="chart-box" style="height:300px"><canvas id="ch-perkolektor"></canvas></div>
      </div></div>
      <div class="col-12"><div class="card card-pad">
        <div class="card-head"><div><div class="card-title">Rekap per Kolektor</div><div class="card-sub">Import &amp; export per kolektor</div></div></div>
        <div class="table-wrap"><table class="data cards"><thead><tr>
          <th>Kolektor</th><th>Username</th><th class="num">Pelanggan</th><th class="num">Aktif</th><th class="num">Blokir</th><th class="num">Putus</th><th class="num">Cuti</th><th class="num">Total Tagihan</th><th style="width:230px">Aksi</th>
        </tr></thead><tbody>
        ${d.perKolektor.map((k) => `<tr>
          <td class="cell-title"><strong>${esc(k.nama)}</strong></td><td data-label="Username">${esc(k.username)}</td>
          <td class="num" data-label="Pelanggan">${k.totalPelanggan}</td><td class="num" data-label="Aktif">${k.aktif}</td><td class="num" data-label="Blokir">${k.blokir}</td><td class="num" data-label="Putus">${k.putus}</td><td class="num" data-label="Cuti">${k.cuti}</td>
          <td class="num" data-label="Total Tagihan"><strong>${fmtRp(k.totalTagihan)}</strong></td>
          <td class="cell-actions"><div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick="openImportModal('${k.kolektorId}')">⬆️ Import</button>
            <button class="btn btn-accent btn-sm" onclick="exportPDF('${k.kolektorId}')">📄 Export PDF</button>
            <button class="btn btn-outline btn-sm" onclick="go('pelanggan', {kolektorId:'${k.kolektorId}'})">📋 Data</button>
          </div></td>
        </tr>`).join('')}
        </tbody></table></div>
      </div></div>` : ''}
    </div>`;

  // charts
  renderChart('ch-status', doughnut(d.statusCounts.map((x) => x.label), d.statusCounts.map((x) => x.value), ['#10b981', '#ef4444', '#64748b', '#f59e0b']));
  renderChart('ch-kelompok', bar(d.kelompokCounts.map((x) => x.label), d.kelompokCounts.map((x) => x.value), PALETTE, true));
  renderChart('ch-infra', doughnut(d.infraCounts.map((x) => x.label), d.infraCounts.map((x) => x.value), ['#14b8a6', '#8b5cf6']));
  renderChart('ch-tagihan', doughnut(d.tagihanCounts.map((x) => x.label), d.tagihanCounts.map((x) => x.value), ['#10b981', '#ef4444', '#3b82f6']));
  if (isAdmin) {
    renderChart('ch-perkolektor', bar(d.perKolektor.map((x) => x.nama), d.perKolektor.map((x) => x.totalTagihan), PALETTE));
  }
}

/* ---------- Kolektor (admin) ---------- */
async function renderKolektor() {
  const c = $('#content');
  c.innerHTML = `<div class="empty"><span class="spin">⏳</span> Memuat data kolektor…</div>`;
  let list;
  try { list = (await api('/api/kolektor')).kolektor; } catch (e) { c.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  state.kolektor = list;

  c.innerHTML = `
    <div class="card table-card">
      <div class="table-wrap"><table class="data cards"><thead><tr>
        <th>#</th><th>Nama Kolektor</th><th>Username</th><th class="num">Jumlah Pelanggan</th><th class="num">Total Tagihan</th><th style="width:320px">Aksi</th>
      </tr></thead><tbody>
      ${list.length ? list.map((k, i) => `<tr>
        <td class="hide-sm">${i + 1}</td>
        <td class="cell-title"><div class="avatar" style="width:30px;height:30px;flex:0 0 30px;font-size:13px;display:inline-flex;vertical-align:middle;margin-right:8px">${esc(k.name.charAt(0).toUpperCase())}</div><strong>${esc(k.name)}</strong></td>
        <td data-label="Username"><code>${esc(k.username)}</code></td>
        <td class="num" data-label="Jumlah Pelanggan">${k.jumlahPelanggan}</td>
        <td class="num" data-label="Total Tagihan"><strong>${fmtRp(k.totalTagihan)}</strong></td>
        <td class="cell-actions"><div class="row-actions">
          <button class="btn btn-ghost btn-sm" onclick="go('pelanggan', {kolektorId:'${k.id}'})">📋 Lihat Data</button>
          <button class="btn btn-outline btn-sm" onclick="openImportModal('${k.id}')">⬆️ Import</button>
          <button class="btn btn-accent btn-sm" onclick="exportPDF('${k.id}')">📄 Export PDF</button>
          <button class="btn btn-outline btn-sm" title="Edit" onclick="openKolektorModal('${k.id}')">✏️<span class="show-sm"> Edit</span></button>
          <button class="btn btn-danger btn-sm" title="Hapus" onclick="deleteKolektor('${k.id}')">🗑️<span class="show-sm"> Hapus</span></button>
        </div></td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">Belum ada kolektor. Klik "Tambah Kolektor".</td></tr>`}
      </tbody></table></div>
    </div>
    <div class="hint" style="margin-top:14px">💡 Import file CSV/XLSX untuk menambahkan banyak pelanggan sekaligus ke kolektor terpilih. Format kolom: <code>${IMPORT_LABELS.join(', ')}</code> — <strong>ID mengikuti data import Anda</strong> (wajib diisi &amp; unik). <a href="#" onclick="event.preventDefault();downloadTemplate()">Unduh template</a>.</div>`;
}

async function openKolektorModal(id) {
  const k = id ? state.kolektor.find((x) => x.id === id) || (await api('/api/kolektor')).kolektor.find((x) => x.id === id) : null;
  const title = k ? 'Edit Kolektor' : 'Tambah Kolektor';
  openModal(`
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div id="kol-error" class="form-error hidden"></div>
      <div class="form-grid">
        <div class="field full"><label>Nama Kolektor <span class="req">*</span></label><input class="input" id="kol-name" value="${esc(k ? k.name : '')}" placeholder="mis. Andi Saputra" /></div>
        <div class="field"><label>Username <span class="req">*</span></label><input class="input" id="kol-username" value="${esc(k ? k.username : '')}" placeholder="mis. andi" ${k ? 'disabled' : ''} /></div>
        <div class="field"><label>Password ${k ? '(kosongkan jika tetap)' : '<span class="req">*</span>'}</label><input class="input" type="password" id="kol-password" placeholder="min. 4 karakter" /></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="kol-save">Simpan</button>
    </div>`);
  $('#kol-save').addEventListener('click', async () => {
    const errEl = $('#kol-error');
    errEl.classList.add('hidden');
    const payload = { name: $('#kol-name').value, password: $('#kol-password').value };
    if (!k) payload.username = $('#kol-username').value;
    try {
      if (k) await api('/api/kolektor/' + k.id, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/api/kolektor', { method: 'POST', body: JSON.stringify(payload) });
      closeModal(); toast(k ? 'Kolektor diperbarui.' : 'Kolektor ditambahkan.');
      renderKolektor();
    } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  });
}

async function deleteKolektor(id) {
  const k = state.kolektor.find((x) => x.id === id);
  if (!k) return;
  const ok = await confirmDialog('Hapus Kolektor', `Yakin hapus kolektor <strong>${esc(k.name)}</strong>? Semua data pelanggan miliknya juga akan dihapus.`);
  if (!ok) return;
  try { await api('/api/kolektor/' + id, { method: 'DELETE' }); toast('Kolektor dihapus.'); renderKolektor(); } catch (e) { toast(e.message, 'error'); }
}

async function exportPDF(id) {
  const k = state.kolektor.find((x) => x.id === id);
  const uname = k ? k.username : id;
  const fname = 'laporan-' + uname + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
  const htmlUrl = authedUrl('/api/export/' + id + '/html');

  openModal(`
    <div class="modal-head"><h3>📄 Laporan Data Pelanggan</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="hint" style="margin-bottom:10px">
        Laporan tampil di bawah. Untuk menyimpannya, klik <strong>🖨️ Print / Simpan PDF</strong> lalu pilih <em>Save as PDF</em> pada dialog cetak.
      </div>
      <iframe id="report-frame" src="${htmlUrl}" style="width:100%;height:66vh;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
      <button class="btn btn-accent" id="rep-download">⬇️ Unduh PDF</button>
      <button class="btn btn-primary" id="rep-print">🖨️ Print / Simpan PDF</button>
    </div>`, 'xwide');

  $('#rep-print').addEventListener('click', () => {
    const f = document.getElementById('report-frame');
    if (f && f.contentWindow) {
      f.contentWindow.focus();
      setTimeout(() => {
        try { f.contentWindow.print(); }
        catch (e) { toast('Tidak bisa mencetak di lingkungan ini. Coba tombol "Unduh PDF".', 'error'); }
      }, 300);
    }
  });

  $('#rep-download').addEventListener('click', async () => {
    try {
      const blob = await fetchBlob('/api/export/' + id + '/pdf');
      saveBlob(blob, fname);
      toast('Mengunduh ' + fname + '… Jika tidak muncul, gunakan "Print / Simpan PDF".');
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------- Import ---------- */
async function openImportModal(preselectId) {
  if (!state.kolektor.length) {
    try { state.kolektor = (await api('/api/kolektor')).kolektor; } catch (e) { toast(e.message, 'error'); return; }
  }
  const opts = state.kolektor.map((k) => `<option value="${k.id}" ${k.id === preselectId ? 'selected' : ''}>${esc(k.name)} (${esc(k.username)})</option>`).join('');
  openModal(`
    <div class="modal-head"><h3>Import Data Pelanggan</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div id="imp-error" class="form-error hidden"></div>
      <div class="field" style="margin-bottom:14px"><label>Kolektor Tujuan <span class="req">*</span></label>
        <select class="input" id="imp-kolektor">${opts}</select></div>
      <div class="field" style="margin-bottom:6px"><label>File (CSV / XLSX) <span class="req">*</span></label>
        <input class="input" type="file" id="imp-file" accept=".csv,.xlsx,.xls" /></div>
      <div class="hint" style="margin-bottom:12px">
        Kolom: <code>${IMPORT_LABELS.join(', ')}</code>.
        <strong>ID mengikuti data Anda</strong> (wajib diisi &amp; unik). <a href="#" onclick="event.preventDefault();downloadTemplate()">Unduh template CSV</a>.
      </div>
      <div id="imp-result"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="imp-run">⬆️ Import Sekarang</button>
    </div>`);
  $('#imp-run').addEventListener('click', async () => {
    const errEl = $('#imp-error');
    errEl.classList.add('hidden');
    const file = $('#imp-file').files[0];
    if (!file) { errEl.textContent = 'Pilih file terlebih dahulu.'; errEl.classList.remove('hidden'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kolektorId', $('#imp-kolektor').value);
    const btn = $('#imp-run');
    btn.disabled = true; btn.textContent = 'Mengimpor…';
    try {
      const r = await api('/api/import', { method: 'POST', body: fd });
      let html = `<div class="form-error" style="background:#dcfce7;color:#15803d;margin:0">✅ Berhasil import <strong>${r.imported}</strong> pelanggan ke <strong>${esc(r.kolektor)}</strong>.</div>`;
      if (r.errors.length) html += `<div style="margin-top:10px;max-height:140px;overflow:auto">${r.errors.map((e) => `<div class="hint">⚠️ ${esc(e)}</div>`).join('')}</div>`;
      $('#imp-result').innerHTML = html;
      toast(r.imported + ' pelanggan berhasil diimport.');
      btn.disabled = false; btn.textContent = '⬆️ Import Sekarang';
    } catch (e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = '⬆️ Import Sekarang';
    }
  });
}

async function openExportModal() {
  if (!state.kolektor.length) {
    try { state.kolektor = (await api('/api/kolektor')).kolektor; } catch (e) { toast(e.message, 'error'); return; }
  }
  const opts = state.kolektor.map((k) => `<option value="${k.id}">${esc(k.name)} (${esc(k.username)})</option>`).join('');
  openModal(`
    <div class="modal-head"><h3>📄 Export PDF Laporan</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Pilih Kolektor</label>
        <select class="input" id="exp-kolektor">${opts}</select></div>
      <div class="hint" style="margin-top:12px">Laporan berisi ringkasan statistik + tabel lengkap data pelanggan kolektor terpilih.</div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-accent" id="exp-run">📄 Download PDF</button>
    </div>`);
  $('#exp-run').addEventListener('click', () => {
    exportPDF($('#exp-kolektor').value);
    closeModal();
  });
}

/* ---------- Pelanggan ---------- */
async function renderPelanggan(opts = {}) {
  if (opts.kolektorId) state.pelFilter.kolektorId = opts.kolektorId;
  const c = $('#content');
  c.innerHTML = `<div class="empty"><span class="spin">⏳</span> Memuat data pelanggan…</div>`;
  let list;
  try { list = (await api('/api/pelanggan')).pelanggan; } catch (e) { c.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  state.pelanggan = list;

  if (state.user.role === 'admin' && !state.kolektor.length) {
    try { state.kolektor = (await api('/api/kolektor')).kolektor; } catch (e) { /* ignore */ }
  }

  renderPelangganTable();
}

/* ---------- Kolom tabel (dikendalikan PELANGGAN_FIELDS + preferensi user) ---------- */
const COL_KEY = 'kolektorapp.pelColumns.v1';
const DEFAULT_ON = ['id', 'nama', 'alamat', 'noHp', 'status', 'infrastruktur', 'tagihan', 'kelompok',
  'jumlahTagihan', 'jatuhTempo', 'pengirimanInv', 'reminder1', 'reminder2', 'reminder3', 'reminder4'];

function visibleColumns() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(COL_KEY) || 'null'); } catch (e) { saved = null; }
  return PELANGGAN_FIELDS.filter((f) => f.table !== false).map((f) => ({
    f,
    on: saved ? (Array.isArray(saved) ? saved.includes(f.key) : saved[f.key] !== false) : DEFAULT_ON.includes(f.key),
  }));
}

function saveColumnPref(list) {
  const map = {};
  list.forEach(({ f, on }) => { map[f.key] = on; });
  try { localStorage.setItem(COL_KEY, JSON.stringify(map)); } catch (e) { /* preview bisa memblokir */ }
  renderPelangganTable();
}

function toggleColumnMenu() {
  const old = document.getElementById('col-menu');
  if (old) { old.remove(); return; }
  const cols = visibleColumns();
  const menu = document.createElement('div');
  menu.id = 'col-menu';
  menu.className = 'card col-menu';
  menu.innerHTML = `
    <div class="col-menu-head">Tampilkan kolom</div>
    ${cols.map(({ f, on }, i) => `<label class="col-opt"><input type="checkbox" data-i="${i}" ${on ? 'checked' : ''}/> ${esc(f.label)}</label>`).join('')}
    <div class="col-menu-foot">
      <button class="btn btn-ghost btn-sm" id="col-default">Setelan awal</button>
    </div>`;
  document.body.appendChild(menu);
  const bar = document.getElementById('pel-col-btn');
  if (bar && bar.getBoundingClientRect) {
    const r = bar.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 230)) + 'px';
  }
  menu.addEventListener('change', (e) => {
    const i = e.target.dataset && e.target.dataset.i;
    if (i === undefined) return;
    cols[Number(i)].on = e.target.checked;
    saveColumnPref(cols);
    const m2 = document.getElementById('col-menu');
    if (m2) m2.remove();
  });
  menu.querySelector('#col-default').addEventListener('click', () => {
    try { localStorage.removeItem(COL_KEY); } catch (e) {}
    document.getElementById('col-menu').remove();
    renderPelangganTable();
  });
  setTimeout(() => {
    const close = (ev) => {
      if (menu.contains(ev.target) || (bar && bar.contains(ev.target))) return;
      menu.remove();
      document.removeEventListener('click', close);
    };
    document.addEventListener('click', close);
  }, 0);
}

function renderCell(f, p) {
  const v = p[f.key];
  switch (f.key) {
    case 'id': return `<code>${esc(v)}</code>`;
    case 'nama': return `<strong>${esc(v)}</strong>`;
    case 'status': return statusBadge(v);
    case 'infrastruktur': return infraBadge(v);
    case 'tagihan': return tagihanBadge(v);
    case 'kelompok': return kelompokBadge(v);
    case 'jumlahTagihan': return `<strong>${fmtRp(v)}</strong>`;
    case 'jatuhTempo': return v ? `<strong>tgl ${esc(v)}</strong>` : '-';
    default:
      if (f.type === 'done') {
        const isDone = v === 'done';
        const inner = isDone ? '<span class="badge b-done">✓ done</span>' : '<span class="badge b-todo">belum</span>';
        return isDone ? inner
          : `<span class="badge-click" title="Klik: tandai done" onclick="event.stopPropagation();toggleDoneField('${jsAttr(p.id)}','${f.key}')">${inner}</span>`;
      }
      return v ? esc(v) : '-';
  }
}

function renderPelangganTable() {
  const c = $('#content');
  const isAdmin = state.user.role === 'admin';
  const f = state.pelFilter;
  let rows = state.pelanggan;
  if (isAdmin && f.kolektorId && f.kolektorId !== 'all') rows = rows.filter((p) => p.kolektorId === f.kolektorId);
  if (f.search) {
    const q = f.search.toLowerCase();
    rows = rows.filter((p) => (p.nama || '').toLowerCase().includes(q) || (p.noHp || '').includes(q) || (p.id || '').toLowerCase().includes(q) || (p.alamat || '').toLowerCase().includes(q));
  }
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  if (f.page > pages) f.page = pages;
  const start = (f.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);

  const kolektorFilter = isAdmin ? `
    <select class="input toolbar-select" id="pel-filter-kolektor" onchange="setPelFilter('kolektorId', this.value)">
      <option value="all">Semua Kolektor</option>
      ${state.kolektor.map((k) => `<option value="${k.id}" ${f.kolektorId === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}
    </select>` : '';

  const cols = visibleColumns().filter((x) => x.on).map((x) => x.f);
  const head = cols.map((f2) => `<th${f2.type === 'currency' ? ' class="num"' : ''}>${esc(f2.label)}</th>`).join('')
    + (isAdmin ? '<th>Kolektor</th>' : '') + '<th style="width:170px">Aksi</th>';
  const body = pageRows.length ? pageRows.map((p) => `<tr>
    ${cols.map((f2) => `<td${f2.type === 'currency' ? ' class="num"' : ''} data-label="${esc(f2.label)}">${renderCell(f2, p)}</td>`).join('')}
    ${isAdmin ? `<td data-label="Kolektor">${esc(p.kolektorNama || '-')}</td>` : ''}
    <td class="cell-actions"><div class="row-actions">
      <button class="btn btn-outline btn-sm" title="Edit" onclick="openPelangganModal('${jsAttr(p.id)}')">✏️<span class="show-sm"> Edit</span></button>
      <button class="btn btn-accent btn-sm" title="Kirim Pesan" onclick="openMessageModal('${jsAttr(p.id)}')">💬<span class="show-sm"> Pesan</span></button>
      <button class="btn btn-danger btn-sm" title="Hapus" onclick="deletePelanggan('${jsAttr(p.id)}')">🗑️<span class="show-sm"> Hapus</span></button>
    </div></td>
  </tr>`).join('') : `<tr><td colspan="${cols.length + (isAdmin ? 2 : 1)}" class="empty"><div class="big">📭</div>Belum ada data pelanggan.</td></tr>`;

  c.innerHTML = `
    <div class="toolbar">
      ${kolektorFilter}
      <div class="search-box"><input type="text" id="pel-search" placeholder="Cari nama / no HP / ID / alamat…" value="${esc(f.search)}" oninput="setPelFilter('search', this.value)" /></div>
      <button class="btn btn-outline btn-sm" id="pel-col-btn" onclick="toggleColumnMenu()">⚙️ Kolom</button>
      <div class="grow"></div>
      <span class="hint">${total} data</span>
      <button class="btn btn-primary hide-sm" onclick="openPelangganModal()">＋ Tambah Pelanggan</button>
    </div>
    <div class="card table-card"><div class="table-wrap"><table class="data cards"><thead><tr>
      ${head}
    </tr></thead><tbody>
      ${body}
    </tbody></table></div></div>
    <div class="pagination">
      <span>Halaman ${f.page} / ${pages}</span>
      <button onclick="setPelFilter('page', ${f.page - 1})" ${f.page <= 1 ? 'disabled' : ''}>‹</button>
      <button onclick="setPelFilter('page', ${f.page + 1})" ${f.page >= pages ? 'disabled' : ''}>›</button>
    </div>`;
}
function setPelFilter(key, value) {
  if (key === 'search') state.pelFilter.search = value;
  if (key === 'kolektorId') { state.pelFilter.kolektorId = value; state.pelFilter.page = 1; }
  if (key === 'page') state.pelFilter.page = Number(value) || 1;
  renderPelangganTable();
  if (key === 'search') {
    const si = $('#pel-search');
    if (si) { si.focus(); const len = si.value.length; si.setSelectionRange(len, len); }
  }
}

/* ---------- Pembangun form pelanggan (berbasis PELANGGAN_FIELDS) ---------- */
const fieldInput = (f) => 'pl-' + f.key;

function renderFormField(f, p, isAdmin) {
  const id = fieldInput(f);
  const star = f.required ? ' <span class="req">*</span>' : '';
  const hint = f.hint ? ` <span class="fld-hint">${esc(f.hint)}</span>` : '';
  const label = `<label for="${id}">${esc(f.label)}${star}${hint}</label>`;
  const cls = 'input' + (f.size === 'full' ? ' fld-full' : '');

  // field khusus
  if (f.key === 'id' && p) {
    return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}
      <input class="${cls}" value="${esc(p.id)}" disabled /></div>`;
  }
  if (f.key === 'kolektorId' && isAdmin) {
    const opts = state.kolektor.map((k) => `<option value="${k.id}" ${p && p.kolektorId === k.id ? 'selected' : ''}>${esc(k.name)} (${esc(k.username)})</option>`).join('');
    return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}<select class="${cls}" id="${id}">${opts}</select></div>`;
  }

  const val = p && p[f.key] !== undefined && p[f.key] !== null ? p[f.key] : (f.def === undefined ? '' : f.def);
  switch (f.type) {
    case 'select': {
      const opts = (f.options || []).map((o) => `<option value="${esc(o)}" ${String(o) === String(val) ? 'selected' : ''}>${esc(o)}</option>`).join('');
      return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}<select class="${cls}" id="${id}">${opts}</select></div>`;
    }
    case 'longtext':
      return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}
        <textarea class="${cls}" id="${id}" rows="2" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea></div>`;
    case 'currency':
      return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}
        <div class="rp-wrap"><span class="rp">Rp</span><input class="${cls} rp-input" id="${id}" type="text" inputmode="numeric"
          data-money value="${esc(Number(val || 0).toLocaleString('id-ID'))}" /></div></div>`;
    case 'day':
      return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}
        <input class="${cls}" id="${id}" type="number" min="1" max="28" value="${esc(val)}" /></div>`;
    case 'done': {
      const opts = (f.options || OPTIONS.done);
      return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}
        <div class="seg2" id="${id}" data-val="${esc(val)}">
          ${opts.map((o) => `<button type="button" class="seg2-btn ${String(o) === String(val) ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}
        </div></div>`;
    }
    default:
      const phoneAttr = f.type === 'phone' ? ' data-phone' : '';
      return `<div class="field ${f.size === 'full' ? 'full' : ''}">${label}
        <input class="${cls}" id="${id}" type="text" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}"
          ${f.inputmode ? `inputmode="${f.inputmode}"` : ''}${phoneAttr} maxlength="${f.type === 'longtext' ? 500 : 200}" /></div>`;
  }
}

// Susunan form: rata/flat, urutan = urutan konfigurasi. Kolektor ditaruh di akhir
// (khusus admin) agar 16 kolom utama tetap persis seperti template import.
function renderFormFields(p, isAdmin) {
  const fields = PELANGGAN_FIELDS.slice();
  if (isAdmin) fields.push({ key: 'kolektorId', label: 'Kolektor', type: 'text', size: 'full', required: false });
  return `<div class="form-grid">${fields.map((f) => renderFormField(f, p, isAdmin)).join('')}</div>`;
}

// Ambil nilai form → payload (angka Rp dilepas titik tisinya)
function collectFormPayload(isAdmin) {
  const payload = {};
  PELANGGAN_FIELDS.forEach((f) => {
    if (f.key === 'id') return;
    const el = document.getElementById(fieldInput(f));
    if (!el) return;
    if (f.type === 'done') { payload[f.key] = el.dataset.val || f.def; return; }
    payload[f.key] = f.type === 'currency' ? String(el.value).replace(/\D/g, '') : el.value;
  });
  if (isAdmin) {
    const k = document.getElementById(fieldInput('kolektorId'));
    if (k) payload.kolektorId = k.value;
  }
  return payload;
}

// Validasi ringan di sisi klien sebelum kirim (server tetap memvalidasi ulang)
function validateFormClient(isAdmin) {
  const missing = [];
  PELANGGAN_FIELDS.forEach((f) => {
    if (!f.required) return;
    const el = document.getElementById(fieldInput(f));
    if (!el) return;
    const v = f.type === 'done' ? (el.dataset.val || '') : String(el.value).trim();
    if (!v) missing.push(f.label);
  });
  if (missing.length) return 'Belum diisi: ' + missing.join(', ') + '.';
  const hp = document.getElementById(fieldInput('noHp'));
  if (hp && hp.value.replace(/\D/g, '').length < 8) return 'No HP/WA minimal 8 angka.';
  if (isAdmin && !state.kolektor.length) return 'Belum ada kolektor — tambahkan kolektor dulu.';
  return '';
}

function openPelangganModal(id) {
  const p = id ? state.pelanggan.find((x) => x.id === id) : null;
  const isAdmin = state.user.role === 'admin';
  const title = p ? 'Edit Pelanggan' : 'Tambah Pelanggan';

  openModal(`
    <div class="modal-head"><h3>${p ? '✏️' : '＋'} ${title}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body form-scroll">
      <div id="pl-error" class="form-error hidden"></div>
      ${renderFormFields(p, isAdmin)}
    </div>
    <div class="modal-foot">
      <span class="foot-note hide-sm">Kolom bertanda <span class="req">*</span> wajib diisi</span>
      <div class="grow"></div>
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="pl-save">💾 Simpan</button>
    </div>`, 'wide');

  // format ribuan otomatis untuk field Rp
  document.querySelectorAll('[data-money]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const digits = inp.value.replace(/\D/g, '').slice(0, 12);
      inp.value = digits ? Number(digits).toLocaleString('id-ID') : '0';
    });
    inp.addEventListener('focus', () => inp.select());
  });
  // tombol done / belum
  document.querySelectorAll('.seg2').forEach((wrap) => {
    wrap.querySelectorAll('.seg2-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        wrap.dataset.val = btn.dataset.v;
        wrap.querySelectorAll('.seg2-btn').forEach((b) => b.classList.toggle('on', b === btn));
      });
    });
  });
  // bersih-bersih input nomor HP/WA (buang karakter non-angka, spasi akan dirapikan server)
  document.querySelectorAll('[data-phone]').forEach((inp) => {
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^\d+\-\s]/g, ''); });
    inp.addEventListener('blur', () => { inp.value = inp.value.replace(/[\s\-()+]/g, (m) => (m === ' ' ? '' : m)).replace(/\s/g, ''); });
  });
  // Enter di field terakhir = simpan
  const form = document.getElementById('pl-form');
  if (form) form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); $('#pl-save').click(); } });

  $('#pl-save').addEventListener('click', async () => {
    const errEl = $('#pl-error');
    const clientErr = validateFormClient(isAdmin);
    if (clientErr) { errEl.textContent = clientErr; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    const payload = collectFormPayload(isAdmin);
    if (!p) payload.id = (document.getElementById(fieldInput('id')) || {}).value || '';
    try {
      if (p) await api('/api/pelanggan/' + enc(p.id), { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/api/pelanggan', { method: 'POST', body: JSON.stringify(payload) });
      closeModal(); toast(p ? 'Data pelanggan diperbarui.' : 'Pelanggan ditambahkan.');
      renderPelanggan();
    } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  });
}

// Toggle cepat done ↔ belum langsung dari tabel (PUT menimpa semua field, jadi kirim utuh)
async function toggleDoneField(id, key) {
  const p = state.pelanggan.find((x) => x.id === id);
  if (!p) return;
  const payload = {};
  PELANGGAN_FIELDS.forEach((f) => { if (f.key !== 'id') payload[f.key] = p[f.key]; });
  payload[key] = p[key] === 'done' ? 'belum' : 'done';
  if (state.user.role === 'admin' && p.kolektorId) payload.kolektorId = p.kolektorId;
  try {
    await api('/api/pelanggan/' + enc(id), { method: 'PUT', body: JSON.stringify(payload) });
    await renderPelanggan();
    toast(fLabel(key) + ': ' + (payload[key] === 'done' ? 'done ✓' : 'belum'));
  } catch (e) { toast(e.message, 'error'); }
}

const fLabel = (key) => (PELANGGAN_FIELDS.find((f) => f.key === key) || {}).label || key;

async function deletePelanggan(id) {
  const ok = await confirmDialog('Hapus Pelanggan', 'Yakin hapus data pelanggan ini? Tindakan tidak bisa dibatalkan.');
  if (!ok) return;
  try { await api('/api/pelanggan/' + enc(id), { method: 'DELETE' }); toast('Pelanggan dihapus.'); renderPelanggan(); } catch (e) { toast(e.message, 'error'); }
}

/* ---------- Kirim Pesan (WhatsApp) ---------- */
// Nama bulan dalam Bahasa Indonesia — dipakai template tagihan agar bulan menyesuaikan otomatis.
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Template pengumuman tagihan bulanan: bulan pemakaian = bulan lalu, masa bayar = bulan ini (1 s/d 10).
function tagihanBulananTemplate(p) {
  // jatuh tempo mengikuti data pelanggan (fallback: tanggal 10)
  const jtw = (p && p.jatuhTempo) ? Number(p.jatuhTempo) : 10;
  const now = new Date();
  const tahun = now.getFullYear();
  const bulanIni = BULAN_ID[now.getMonth()];
  const bulanLalu = BULAN_ID[(now.getMonth() + 11) % 12];
  return [
    `Assalamualaikum, dari CinoxmediaNet, kembali memberitahukan kepada bapak/ibu bahwa tagihan internet pemakaian ${bulanLalu.toUpperCase()} sudah diterbitkan dan sudah dapat dibayarkan per tanggal 1 ${bulanIni.toUpperCase()} ${tahun} dan jatuh tempo pada tanggal ${jtw} ${bulanIni.toUpperCase()} ${tahun}`,
    '',
    'Pembayaran ke kantor buka setiap hari senin-sabtu pada jam kerja (08:00-17:00).',
    'BAYAR KE KANTOR AKAN DIKENAKAN BIAYA ADMIN 5000',
    '',
    'Pembayaran melalui transfer harap mengirimkan bukti transfer ke WA ini agar transfer tersebut dapat diverifikasi sebagai pembayaran sah kecuali pembayaran melalui BRIVA, VA Mandiri Nagari VA, dan BNI VA',
    '',
    'Terimakasih',
  ].join('\n');
}

function openMessageModal(id) {
  const p = state.pelanggan.find((x) => x.id === id);
  if (!p) return;
  const templates = [
    { label: 'Konfirmasi Tagihan', text: `Assalamualaikum Bpk/Ibu ${p.nama}, mohon maaf mengganggu. Terkait tagihan internet Anda sebesar ${fmtRp(p.jumlahTagihan)}, mohon konfirmasinya. Terima kasih.` },
    { label: 'Cek Kendala Layanan', text: `Halo Bpk/Ibu ${p.nama}, ini dari tim kolektor. Apakah ada kendala pada layanan internet Anda? Silakan balas pesan ini. Terima kasih.` },
    { label: 'Pengumuman Tagihan Bulanan', text: tagihanBulananTemplate(p) },
  ];
  openModal(`
    <div class="modal-head"><h3>💬 Kirim Pesan</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div id="msg-error" class="form-error hidden"></div>
      <div class="list-plain" style="margin-bottom:14px">
        <li><span class="dim">Nama</span><strong>${esc(p.nama)}</strong></li>
        <li><span class="dim">No HP / WA</span><strong>${esc(p.noHp)}</strong></li>
        ${p.alamat ? `<li><span class="dim">Alamat</span><span>${esc(p.alamat)}</span></li>` : ''}
        <li><span class="dim">Kelompok</span>${kelompokBadge(p.kelompok)}</li>
        <li><span class="dim">Jatuh Tempo</span><span>tanggal ${esc(p.jatuhTempo || 10)} tiap bulan</span></li>
      </div>
      <div class="field"><label>Pesan</label>
        <textarea class="input" id="msg-teks" rows="8" placeholder="Tulis pesan untuk pelanggan…">${esc(templates[0].text)}</textarea></div>
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px" id="msg-templates">
        ${templates.map((t, i) => `<button type="button" class="btn btn-ghost btn-sm" data-idx="${i}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="hint" style="margin-top:8px">ℹ️ Template "Pengumuman Tagihan Bulanan" otomatis menyesuaikan bulan pemakaian &amp; masa bayar sesuai tanggal saat ini.</div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-accent" id="msg-send">💬 Kirim via WhatsApp</button>
    </div>`);
  document.querySelectorAll('#msg-templates button').forEach((b) => {
    b.addEventListener('click', () => { $('#msg-teks').value = templates[Number(b.dataset.idx)].text; });
  });
  $('#msg-send').addEventListener('click', async () => {
    const teks = $('#msg-teks').value.trim();
    const errEl = $('#msg-error');
    errEl.classList.add('hidden');
    if (!teks) { errEl.textContent = 'Pesan tidak boleh kosong.'; errEl.classList.remove('hidden'); return; }
    try {
      const r = await api('/api/pelanggan/' + enc(p.id) + '/message', { method: 'POST', body: JSON.stringify({ teks }) });
      closeModal();
      toast('Pesan tercatat. Membuka WhatsApp…');
      window.open(r.wa, '_blank');
    } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  });
}

/* ---------- Init ---------- */
async function init() {
  $('#login-form').addEventListener('submit', doLogin);
  $('#btn-logout').addEventListener('click', () => { closeSidebar(); doLogout(); });
  $('#btn-password').addEventListener('click', () => { closeSidebar(); openUbahPasswordModal(); });

  // Sidebar mobile: tombol ☰, tombol ✕, klik area gelap, tombol Escape, dan saat layar diperbesar
  $('#btn-menu').addEventListener('click', toggleSidebar);
  $('#btn-sidebar-close').addEventListener('click', closeSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
  const mqDesktop = window.matchMedia('(min-width: 901px)');
  const onMq = (e) => { if (e.matches) closeSidebar(); };
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onMq);
  else if (mqDesktop.addListener) mqDesktop.addListener(onMq); // Safari/WebView lama
  try {
    const { user } = await api('/api/me');
    state.user = user;
    showApp();
  } catch (e) {
    setToken(null);
    $('#login-screen').classList.remove('hidden');
  }
}
init();
