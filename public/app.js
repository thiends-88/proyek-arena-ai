/* ============================================================
 * KolektorApp — Frontend SPA (vanilla JS)
 * ============================================================ */
const OPTIONS = {
  status: ['aktif', 'blokir', 'putus', 'cuti'],
  infrastruktur: ['wireless', 'fiber optic'],
  tagihan: ['yes', 'no', 'free'],
  kelompok: [
    'pelanggan lancar',
    'minta invoice',
    'butuh konfirmasi',
    'blokir dulu baru bayar',
    'bayar ke kantor',
    'minta jemput',
  ],
};

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
  const header = ['ID', 'Nama Pelanggan', 'No HP / WA', 'Status', 'Infrastruktur', 'Tagihan', 'Kelompok', 'Jumlah Tagihan'];
  const rows = [
    ['P-001', 'Rudi Hartono', '081234567890', 'aktif', 'wireless', 'yes', 'pelanggan lancar', '250000'],
    ['P-002', 'Siti Aminah', '081298765432', 'blokir', 'fiber optic', 'no', 'blokir dulu baru bayar', '0'],
  ];
  const lines = [header.join(','), ...rows.map((r) => r.join(','))];
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

function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  renderSidebar();
  go('dashboard');
}

/* ---------- Navigation ---------- */
const NAV = {
  admin: [
    { id: 'dashboard', label: 'Dashboard Analisa', ico: '📊' },
    { id: 'kolektor', label: 'Kolektor', ico: '👤' },
    { id: 'pelanggan', label: 'Data Pelanggan', ico: '📋' },
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
  document.querySelectorAll('.nav-item').forEach((el) => el.addEventListener('click', () => go(el.dataset.view)));
  $('#user-avatar').textContent = (u.name || '?').charAt(0).toUpperCase();
  $('#user-name').textContent = u.name;
  $('#user-role').textContent = u.role === 'admin' ? 'Administrator' : 'Kolektor';
}

function go(view, opts = {}) {
  state.view = view;
  Object.values(state.charts).forEach((ch) => { try { ch.destroy(); } catch (e) {} });
  state.charts = {};
  renderSidebar();
  const titles = { dashboard: 'Dashboard Analisa', kolektor: 'Manajemen Kolektor', pelanggan: 'Data Pelanggan' };
  $('#page-title').textContent = (titles[view] || 'Dashboard');
  renderTopbarActions(view);
  if (view === 'dashboard') renderDashboard();
  else if (view === 'kolektor') renderKolektor();
  else if (view === 'pelanggan') renderPelanggan(opts);
}

function renderTopbarActions(view) {
  const el = $('#topbar-right');
  if (state.user.role === 'admin') {
    if (view === 'kolektor') el.innerHTML = `<button class="btn btn-primary" onclick="openKolektorModal()">＋ Tambah Kolektor</button>`;
    else if (view === 'pelanggan') el.innerHTML = `<button class="btn btn-primary" onclick="openPelangganModal()">＋ Tambah Pelanggan</button>`;
    else el.innerHTML = `<span class="hint">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>`;
  } else {
    if (view === 'pelanggan') el.innerHTML = `<button class="btn btn-primary" onclick="openPelangganModal()">＋ Tambah Pelanggan</button>`;
    else el.innerHTML = `<span class="hint">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>`;
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
        <div style="display:flex;flex-wrap:wrap;gap:10px">
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
        <div class="table-wrap"><table class="data"><thead><tr>
          <th>Kolektor</th><th>Username</th><th class="num">Pelanggan</th><th class="num">Aktif</th><th class="num">Blokir</th><th class="num">Putus</th><th class="num">Cuti</th><th class="num">Total Tagihan</th><th style="width:230px">Aksi</th>
        </tr></thead><tbody>
        ${d.perKolektor.map((k) => `<tr>
          <td><strong>${esc(k.nama)}</strong></td><td>${esc(k.username)}</td>
          <td class="num">${k.totalPelanggan}</td><td class="num">${k.aktif}</td><td class="num">${k.blokir}</td><td class="num">${k.putus}</td><td class="num">${k.cuti}</td>
          <td class="num"><strong>${fmtRp(k.totalTagihan)}</strong></td>
          <td><div class="row-actions">
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
    <div class="card">
      <div class="table-wrap"><table class="data"><thead><tr>
        <th>#</th><th>Nama Kolektor</th><th>Username</th><th class="num">Jumlah Pelanggan</th><th class="num">Total Tagihan</th><th style="width:320px">Aksi</th>
      </tr></thead><tbody>
      ${list.length ? list.map((k, i) => `<tr>
        <td>${i + 1}</td>
        <td><div class="avatar" style="width:30px;height:30px;flex:0 0 30px;font-size:13px;display:inline-flex;vertical-align:middle;margin-right:8px">${esc(k.name.charAt(0).toUpperCase())}</div><strong>${esc(k.name)}</strong></td>
        <td><code>${esc(k.username)}</code></td>
        <td class="num">${k.jumlahPelanggan}</td>
        <td class="num"><strong>${fmtRp(k.totalTagihan)}</strong></td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" onclick="go('pelanggan', {kolektorId:'${k.id}'})">📋 Lihat Data</button>
          <button class="btn btn-outline btn-sm" onclick="openImportModal('${k.id}')">⬆️ Import</button>
          <button class="btn btn-accent btn-sm" onclick="exportPDF('${k.id}')">📄 Export PDF</button>
          <button class="btn btn-outline btn-sm" onclick="openKolektorModal('${k.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteKolektor('${k.id}')">🗑️</button>
        </div></td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">Belum ada kolektor. Klik "Tambah Kolektor".</td></tr>`}
      </tbody></table></div>
    </div>
    <div class="hint" style="margin-top:14px">💡 Import file CSV/XLSX untuk menambahkan banyak pelanggan sekaligus ke kolektor terpilih. Format kolom: <code>ID, Nama Pelanggan, No HP / WA, Status, Infrastruktur, Tagihan, Kelompok, Jumlah Tagihan</code> — <strong>ID mengikuti data import Anda</strong> (wajib diisi &amp; unik). <a href="#" onclick="event.preventDefault();downloadTemplate()">Unduh template</a>.</div>`;
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
        Kolom: <code>ID, Nama Pelanggan, No HP / WA, Status, Infrastruktur, Tagihan, Kelompok, Jumlah Tagihan</code>.
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

function renderPelangganTable() {
  const c = $('#content');
  const isAdmin = state.user.role === 'admin';
  const f = state.pelFilter;
  let rows = state.pelanggan;
  if (isAdmin && f.kolektorId && f.kolektorId !== 'all') rows = rows.filter((p) => p.kolektorId === f.kolektorId);
  if (f.search) {
    const q = f.search.toLowerCase();
    rows = rows.filter((p) => (p.nama || '').toLowerCase().includes(q) || (p.noHp || '').includes(q) || (p.id || '').toLowerCase().includes(q));
  }
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  if (f.page > pages) f.page = pages;
  const start = (f.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);

  const kolektorFilter = isAdmin ? `
    <select class="input" id="pel-filter-kolektor" style="width:200px" onchange="setPelFilter('kolektorId', this.value)">
      <option value="all">Semua Kolektor</option>
      ${state.kolektor.map((k) => `<option value="${k.id}" ${f.kolektorId === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}
    </select>` : '';

  c.innerHTML = `
    <div class="toolbar">
      ${kolektorFilter}
      <div class="search-box"><input type="text" id="pel-search" placeholder="Cari nama / no HP / ID…" value="${esc(f.search)}" oninput="setPelFilter('search', this.value)" /></div>
      <div class="grow"></div>
      <span class="hint">${total} data</span>
      <button class="btn btn-primary" onclick="openPelangganModal()">＋ Tambah Pelanggan</button>
    </div>
    <div class="card"><div class="table-wrap"><table class="data"><thead><tr>
      <th>ID</th><th>Nama Pelanggan</th><th>No HP / WA</th><th>Status</th><th>Infrastruktur</th><th>Tagihan</th><th>Kelompok</th><th class="num">Jumlah Tagihan</th>
      ${isAdmin ? '<th>Kolektor</th>' : ''}<th style="width:170px">Aksi</th>
    </tr></thead><tbody>
    ${pageRows.length ? pageRows.map((p) => `<tr>
      <td><code>${esc(p.id)}</code></td>
      <td><strong>${esc(p.nama)}</strong></td>
      <td>${esc(p.noHp)}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${infraBadge(p.infrastruktur)}</td>
      <td>${tagihanBadge(p.tagihan)}</td>
      <td>${kelompokBadge(p.kelompok)}</td>
      <td class="num"><strong>${fmtRp(p.jumlahTagihan)}</strong></td>
      ${isAdmin ? `<td>${esc(p.kolektorNama || '-')}</td>` : ''}
      <td><div class="row-actions">
        <button class="btn btn-outline btn-sm" title="Edit" onclick="openPelangganModal('${jsAttr(p.id)}')">✏️</button>
        <button class="btn btn-accent btn-sm" title="Kirim Pesan" onclick="openMessageModal('${jsAttr(p.id)}')">💬</button>
        <button class="btn btn-danger btn-sm" title="Hapus" onclick="deletePelanggan('${jsAttr(p.id)}')">🗑️</button>
      </div></td>
    </tr>`).join('') : `<tr><td colspan="${isAdmin ? 10 : 9}" class="empty"><div class="big">📭</div>Belum ada data pelanggan.</td></tr>`}
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

function openPelangganModal(id) {
  const p = id ? state.pelanggan.find((x) => x.id === id) : null;
  const isAdmin = state.user.role === 'admin';
  const title = p ? 'Edit Pelanggan' : 'Tambah Pelanggan';
  const opt = (arr, sel) => arr.map((o) => `<option value="${o}" ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');
  const kolektorSelect = isAdmin ? `
    <div class="field"><label>Kolektor</label>
      <select class="input" id="pl-kolektor">
        ${state.kolektor.map((k) => `<option value="${k.id}" ${p && p.kolektorId === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}
      </select></div>` : '';
  const idField = p
    ? `<div class="field full"><label>ID</label><input class="input" value="${esc(p.id)}" disabled /></div>`
    : `<div class="field full"><label>ID <span class="hint" style="font-weight:400">(opsional — kosongkan untuk otomatis)</span></label><input class="input" id="pl-id" placeholder="mis. P-001" /></div>`;

  openModal(`
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div id="pl-error" class="form-error hidden"></div>
      <div class="form-grid">
        ${idField}
        <div class="field full"><label>Nama Pelanggan <span class="req">*</span></label><input class="input" id="pl-nama" value="${esc(p ? p.nama : '')}" placeholder="Nama lengkap" /></div>
        <div class="field full"><label>No HP / WA <span class="req">*</span></label><input class="input" id="pl-nohp" value="${esc(p ? p.noHp : '')}" placeholder="mis. 081234567890" /></div>
        ${kolektorSelect}
        <div class="field"><label>Status</label><select class="input" id="pl-status">${opt(OPTIONS.status, p ? p.status : 'aktif')}</select></div>
        <div class="field"><label>Infrastruktur</label><select class="input" id="pl-infra">${opt(OPTIONS.infrastruktur, p ? p.infrastruktur : 'wireless')}</select></div>
        <div class="field"><label>Tagihan</label><select class="input" id="pl-tagihan">${opt(OPTIONS.tagihan, p ? p.tagihan : 'no')}</select></div>
        <div class="field"><label>Kelompok</label><select class="input" id="pl-kelompok">${opt(OPTIONS.kelompok, p ? p.kelompok : 'pelanggan lancar')}</select></div>
        <div class="field full"><label>Jumlah Tagihan (Rp)</label><input class="input" id="pl-jumlah" type="number" min="0" value="${p ? p.jumlahTagihan : 0}" /></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="pl-save">Simpan</button>
    </div>`);
  $('#pl-save').addEventListener('click', async () => {
    const errEl = $('#pl-error');
    errEl.classList.add('hidden');
    const payload = {
      nama: $('#pl-nama').value,
      noHp: $('#pl-nohp').value,
      status: $('#pl-status').value,
      infrastruktur: $('#pl-infra').value,
      tagihan: $('#pl-tagihan').value,
      kelompok: $('#pl-kelompok').value,
      jumlahTagihan: $('#pl-jumlah').value,
    };
    if (isAdmin) payload.kolektorId = $('#pl-kolektor').value;
    if (!p) payload.id = $('#pl-id').value;
    try {
      if (p) await api('/api/pelanggan/' + enc(p.id), { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/api/pelanggan', { method: 'POST', body: JSON.stringify(payload) });
      closeModal(); toast(p ? 'Data pelanggan diperbarui.' : 'Pelanggan ditambahkan.');
      renderPelanggan();
    } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  });
}

async function deletePelanggan(id) {
  const ok = await confirmDialog('Hapus Pelanggan', 'Yakin hapus data pelanggan ini? Tindakan tidak bisa dibatalkan.');
  if (!ok) return;
  try { await api('/api/pelanggan/' + enc(id), { method: 'DELETE' }); toast('Pelanggan dihapus.'); renderPelanggan(); } catch (e) { toast(e.message, 'error'); }
}

/* ---------- Kirim Pesan (WhatsApp) ---------- */
function openMessageModal(id) {
  const p = state.pelanggan.find((x) => x.id === id);
  if (!p) return;
  const templates = [
    `Assalamualaikum Bpk/Ibu ${p.nama}, mohon maaf mengganggu. Terkait tagihan internet Anda sebesar ${fmtRp(p.jumlahTagihan)}, mohon konfirmasinya. Terima kasih.`,
    `Halo Bpk/Ibu ${p.nama}, ini dari tim kolektor. Apakah ada kendala pada layanan internet Anda? Silakan balas pesan ini. Terima kasih.`,
    `Selamat siang Bpk/Ibu ${p.nama}, kami informasikan bahwa pembayaran tagihan dapat dilakukan via transfer atau di kantor. Terima kasih.`,
  ];
  openModal(`
    <div class="modal-head"><h3>💬 Kirim Pesan</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div id="msg-error" class="form-error hidden"></div>
      <div class="list-plain" style="margin-bottom:14px">
        <li><span class="dim">Nama</span><strong>${esc(p.nama)}</strong></li>
        <li><span class="dim">No HP / WA</span><strong>${esc(p.noHp)}</strong></li>
        <li><span class="dim">Kelompok</span>${kelompokBadge(p.kelompok)}</li>
      </div>
      <div class="field"><label>Pesan</label>
        <textarea class="input" id="msg-teks" rows="5" placeholder="Tulis pesan untuk pelanggan…">${esc(templates[0])}</textarea></div>
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px" id="msg-templates">
        ${templates.map((t, i) => `<button type="button" class="btn btn-ghost btn-sm" data-idx="${i}">Template ${i + 1}</button>`).join('')}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-accent" id="msg-send">💬 Kirim via WhatsApp</button>
    </div>`);
  document.querySelectorAll('#msg-templates button').forEach((b) => {
    b.addEventListener('click', () => { $('#msg-teks').value = templates[Number(b.dataset.idx)]; });
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
  $('#btn-logout').addEventListener('click', doLogout);
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
