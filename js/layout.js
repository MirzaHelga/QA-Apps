/* =========================================================
   LAYOUT: Sidebar (permanen) + Topbar
   Dipakai di semua halaman lewat renderShell()
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
];

function renderShell({ active, title, breadcrumb }) {
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
          <a class="nav-item ${item.key === active ? 'active' : ''}" href="${item.href}">
            ${item.icon}
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-foot">
        &copy; ${new Date().getFullYear()} Quality Assurance System
      </div>
    </aside>
  `;

  const topbarHtml = `
    <header class="topbar">
      <div>
        <div class="topbar-title">${title}</div>
        <div class="breadcrumb">${breadcrumb || ''}</div>
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

async function loadCurrentUserChip() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');
    if (user) {
      const email = user.email || 'User';
      nameEl.textContent = email.split('@')[0];
      roleEl.textContent = 'Quality Assurance';
      avatarEl.textContent = email.substring(0, 2).toUpperCase();
    } else {
      nameEl.textContent = 'Tamu';
      roleEl.textContent = '-';
    }
  } catch (e) {
    document.getElementById('userName').textContent = 'User';
  }
}
