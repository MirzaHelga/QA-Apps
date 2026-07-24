/* =========================================================
   LAYOUT: Sidebar (permanen) + Topbar
   Sidebar & topbar dirender SEKALI oleh renderSidebarOnce()
   (dipanggil dari router.js). Pindah halaman lewat SPA hanya
   memanggil updateTopbar()/applyActiveNav() — sidebar tidak
   pernah dibangun ulang, jadi tidak pernah "kedip"/hilang.
========================================================= */

const NAV_ITEMS = [
  {
    key: 'dashboard', href: 'index.html', label: 'Dashboard',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>'
  },
  {
    key: 'complaint', href: 'complaint.html', label: 'Complaint',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>'
  },
  {
    key: 'report', href: 'report.html', label: 'Report QC',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
  },
  {
    key: 'verifikasi', href: 'verifikasi.html', label: 'Verifikasi Quality',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>'
  },
];

// Menu tambahan yang hanya tampil untuk role Admin
const NAV_ITEMS_ADMIN = [
  {
    key: 'akun', href: 'akun.html', label: 'Kelola Akun',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  },
];

let _activeNavKey = null;

// Dipanggil SEKALI (oleh router.js saat boot). Membangun sidebar + topbar
// ke dalam DOM dan tidak pernah disentuh lagi selama sesi SPA berjalan.
function renderSidebarOnce() {
  const sidebarHtml = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="logo-box"><img src="assets/logo.png" alt="Logo" id="brandLogo"></div>
        <div class="brand-text">
          <div class="name">Quality Assurance System</div>
          <div class="sub">Quality Assurance</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Menu Utama</div>
        ${NAV_ITEMS.map(item => `
          <a class="nav-item" data-key="${item.key}" href="${item.href}">
            ${item.icon}
            <span>${item.label}</span>
          </a>
        `).join('')}
        <div class="nav-section-label" id="navAdminLabel" style="display:none;">Administrasi</div>
        <div id="navAdminItems"></div>
      </nav>
      <div class="sidebar-foot">
        &copy; ${new Date().getFullYear()} Quality Assurance System
      </div>
    </aside>
  `;

  const topbarHtml = `
    <header class="topbar">
      <div>
        <div class="topbar-title" id="topbarTitle"></div>
        <div class="breadcrumb" id="topbarBreadcrumb"></div>
      </div>
      <div class="topbar-right">
        <span class="today-pill" id="todayPill"></span>
        <div class="user-chip">
          <div class="avatar" id="userAvatar">QA</div>
          <div>
            <div class="u-name" id="userName">Memuat...</div>
            <div class="u-role" id="userRole">&nbsp;</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" id="logoutBtn" title="Keluar">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </header>
  `;

  document.getElementById('sidebar-root').innerHTML = sidebarHtml;
  document.getElementById('topbar-root').innerHTML = topbarHtml;

  // Today pill
  const today = new Date();
  document.getElementById('todayPill').textContent = today.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  loadCurrentUserChip();
}

// Dipanggil setiap pindah halaman (oleh router.js). Cuma update teks judul
// & breadcrumb di topbar yang sudah ada — tidak membangun ulang apa pun.
function updateTopbar(title, breadcrumb) {
  const t = document.getElementById('topbarTitle');
  const b = document.getElementById('topbarBreadcrumb');
  if (t) t.textContent = title || '';
  if (b) b.textContent = breadcrumb || '';
}

// Dipanggil setiap pindah halaman. Menandai item sidebar yang aktif
// tanpa membangun ulang sidebar.
function applyActiveNav(key) {
  _activeNavKey = key;
  document.querySelectorAll('.sidebar-nav .nav-item[data-key]').forEach(a => {
    a.classList.toggle('active', a.dataset.key === key);
  });
}

async function loadCurrentUserChip() {
  try {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');

    const profile = typeof getCurrentProfile === 'function' ? await getCurrentProfile() : null;

    if (profile) {
      const displayName = profile.nama || profile.email?.split('@')[0] || 'User';
      nameEl.textContent = displayName;
      roleEl.textContent = profile.role === 'Admin' ? 'Administrator' : 'Quality Assurance';
      avatarEl.textContent = displayName.substring(0, 2).toUpperCase();

      if (profile.role === 'Admin') {
        document.getElementById('navAdminLabel').style.display = '';
        document.getElementById('navAdminItems').innerHTML = NAV_ITEMS_ADMIN.map(item => `
          <a class="nav-item" data-key="${item.key}" href="${item.href}">
            ${item.icon}
            <span>${item.label}</span>
          </a>
        `).join('');
      }
    } else {
      nameEl.textContent = 'Tamu';
      roleEl.textContent = '-';
    }
  } catch (e) {
    console.error(e);
    document.getElementById('userName').textContent = 'User';
  } finally {
    // Item admin baru saja disisipkan (async) — pastikan status "active"-nya
    // tetap sinkron dengan halaman yang sedang dibuka.
    applyActiveNav(_activeNavKey);
  }
}
