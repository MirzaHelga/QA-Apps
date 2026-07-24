/* =========================================================
   ROUTER: navigasi SPA tanpa reload halaman
   ---------------------------------------------------------
   Sidebar & topbar dibangun SEKALI (lihat layout.js). Saat
   pindah menu, hanya konten #content-root dan #modals-root
   yang di-fetch & diganti — sidebar tidak pernah ikut reload.

   Setiap halaman "controller" (report.js, complaint.js, dst)
   TIDAK auto-jalan lagi saat file-nya dimuat. Sebagai gantinya
   dia mendaftarkan diri ke window.PageControllers.<key>, dan
   router yang memanggilnya setelah konten selesai disuntik.
========================================================= */

const ROUTES = {
  'index.html': {
    active: 'dashboard', title: 'Dashboard',
    breadcrumb: 'Quality Assurance System / Dashboard',
    script: 'js/dashboard.js', init: 'dashboard',
  },
  'complaint.html': {
    active: 'complaint', title: 'Complaint',
    breadcrumb: 'Quality Assurance System / Complaint',
    script: 'js/complaint.js', init: 'complaint',
  },
  'report.html': {
    active: 'report', title: 'Report QC',
    breadcrumb: 'Quality Assurance System / Report QC',
    script: 'js/report.js', init: 'report',
  },
  'verifikasi.html': {
    active: 'verifikasi', title: 'Verifikasi Quality',
    breadcrumb: 'Quality Assurance System / Verifikasi Quality',
    script: 'js/verifikasi.js', init: 'verifikasi',
  },
  'akun.html': {
    active: 'akun', title: 'Kelola Akun',
    breadcrumb: 'Quality Assurance System / Kelola Akun',
    script: 'js/akun.js', init: 'akun', adminOnly: true,
  },
};

/* ---------------- Auth guard ----------------
   Dipanggil PALING AWAL, sebelum sidebar/konten apa pun dirender,
   supaya halaman terproteksi tidak sempat "kelihatan" sebelum
   redirect ke login.html kalau sesi belum ada / bukan admin. */
async function guardRoute(route) {
  const session = await requireAuth(); // requireAuth() sudah redirect ke login.html kalau kosong
  if (!session) return false;

  if (route.adminOnly) {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== 'Admin') {
      window.location.href = 'index.html';
      return false;
    }
  }
  return true;
}

function revealApp() {
  const shell = document.querySelector('.app-shell');
  if (shell) shell.style.visibility = 'visible';
}

window.PageControllers = window.PageControllers || {};

let _currentPath = null;
const _loadedScripts = new Set();

function getCurrentPath() {
  let p = window.location.pathname.split('/').pop();
  if (!p) p = 'index.html';
  return p;
}

function ensureScriptLoaded(src) {
  if (_loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => { _loadedScripts.add(src); resolve(); };
    s.onerror = () => reject(new Error('Gagal memuat ' + src));
    document.body.appendChild(s);
  });
}

/* ---------------- Progress bar tipis di atas ---------------- */
function progressEl() {
  let el = document.getElementById('route-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'route-progress';
    document.body.appendChild(el);
  }
  return el;
}
function startProgress() {
  const el = progressEl();
  el.classList.remove('done');
  void el.offsetWidth; // force reflow biar transisi kepicu ulang
  el.classList.add('active');
}
function finishProgress() {
  const el = progressEl();
  el.classList.remove('active');
  el.classList.add('done');
  setTimeout(() => el.classList.remove('done'), 350);
}

function playContentFade() {
  const el = document.getElementById('content-root');
  if (!el) return;
  el.classList.remove('route-anim');
  void el.offsetWidth;
  el.classList.add('route-anim');
}

/* ---------------- Navigasi utama ---------------- */
async function navigateTo(path, { push = true } = {}) {
  const route = ROUTES[path];
  if (!route) { window.location.href = path; return; }

  // Guard ulang tiap pindah halaman (mis. sesi kadaluarsa, atau role
  // berubah) — penting khusus untuk rute adminOnly seperti akun.html.
  const allowed = await guardRoute(route);
  if (!allowed) return;

  startProgress();
  try {
    if (path !== _currentPath) {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error('Halaman tidak ditemukan');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const newContent = doc.getElementById('content-root');
      const newModals = doc.getElementById('modals-root');
      const contentRoot = document.getElementById('content-root');
      const modalsRoot = document.getElementById('modals-root');

      if (contentRoot) contentRoot.innerHTML = newContent ? newContent.innerHTML : '';
      if (modalsRoot) modalsRoot.innerHTML = newModals ? newModals.innerHTML : '';
      document.title = doc.title;
      playContentFade();
    }

    if (push) history.pushState({ path }, '', path);
    _currentPath = path;

    updateTopbar(route.title, route.breadcrumb);
    applyActiveNav(route.active);

    await ensureScriptLoaded(route.script);
    const controller = window.PageControllers[route.init];
    if (typeof controller === 'function') await controller();
  } catch (err) {
    console.error(err);
    if (typeof toast === 'function') toast('Gagal memuat halaman: ' + err.message, 'error');
  } finally {
    finishProgress();
  }
}

/* ---------------- Klik link internal -> SPA, bukan reload ---------------- */
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // biarkan buka tab baru dll.

  const a = e.target.closest('a');
  if (!a) return;
  if (a.target && a.target !== '' && a.target !== '_self') return;

  const href = a.getAttribute('href');
  if (!href || !ROUTES[href]) return; // bukan route internal (mis. logout, link luar)

  e.preventDefault();
  if (href === getCurrentPath() && href === _currentPath) return;
  navigateTo(href);
});

/* ---------------- Tombol back/forward browser ---------------- */
window.addEventListener('popstate', (e) => {
  const path = (e.state && e.state.path) || getCurrentPath();
  navigateTo(path, { push: false });
});

/* ---------------- Boot awal ---------------- */
async function bootRouter() {
  const path = getCurrentPath();
  const route = ROUTES[path];
  if (!route) return; // halaman di luar daftar route (harusnya tidak terjadi)

  // Cek sesi (& role kalau adminOnly) SEBELUM sidebar/konten dirender.
  // .app-shell disembunyikan lewat inline style di HTML; kalau guard
  // gagal, browser sudah keburu redirect ke login.html/index.html
  // duluan tanpa sempat menampilkan apa pun.
  const allowed = await guardRoute(route);
  if (!allowed) return;

  renderSidebarOnce();
  revealApp();

  _currentPath = path;
  updateTopbar(route.title, route.breadcrumb);
  applyActiveNav(route.active);

  await ensureScriptLoaded(route.script);
  const controller = window.PageControllers[route.init];
  if (typeof controller === 'function') await controller();
}

document.addEventListener('DOMContentLoaded', bootRouter);
