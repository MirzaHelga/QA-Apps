/* =========================================================
   KELOLA AKUN (ADMIN) — PAGE LOGIC
   Semua operasi create/update/delete/ban akun dikirim ke
   Edge Function "admin-users" (butuh service role key di server,
   makanya tidak dilakukan langsung dari sisi browser).
   Dibungkus IIFE supaya variabel/fungsinya tidak bentrok dengan
   controller halaman lain di sesi SPA yang sama.
========================================================= */
(function () {

let allAkun = [];
let currentDetailId = null;
let currentProfile = null;

window.PageControllers = window.PageControllers || {};
window.PageControllers.akun = async function initAkunPage() {
  currentProfile = await requireAdmin();
  if (!currentProfile) return;

  currentDetailId = null;

  wireForm();
  wireFilters();
  wireStaticButtons();
  await refreshAkun();

  document.getElementById('newAkunBtn').addEventListener('click', () => openForm(null));
};

function wireStaticButtons() {
  document.getElementById('editAkunBtn').addEventListener('click', () => {
    const a = allAkun.find(x => x.id === currentDetailId);
    closeModal('detailModal');
    openForm(a);
  });

  document.getElementById('toggleBanBtn').addEventListener('click', async () => {
    const a = allAkun.find(x => x.id === currentDetailId);
    if (!a) return;
    const nextBanned = !a.banned;
    try {
      await callAdminUsers('setBanned', { id: a.id, banned: nextBanned });
      toast(nextBanned ? 'Akun dinonaktifkan' : 'Akun diaktifkan kembali', 'success');
      closeModal('detailModal');
      await refreshAkun();
    } catch (e) {
      toast('Gagal mengubah status: ' + e.message, 'error');
    }
  });

  document.getElementById('deleteAkunBtn').addEventListener('click', async () => {
    if (!currentDetailId) return;
    if (!confirm('Hapus akun ini? Tindakan tidak dapat dibatalkan.')) return;
    try {
      await callAdminUsers('delete', { id: currentDetailId });
      toast('Akun berhasil dihapus', 'success');
      closeModal('detailModal');
      await refreshAkun();
    } catch (e) {
      toast('Gagal menghapus: ' + e.message, 'error');
    }
  });
}

// ---------- Panggil Edge Function ----------
async function callAdminUsers(action, payload) {
  const { data, error } = await supabaseClient.functions.invoke('admin-users', {
    body: { action, payload },
  });
  if (error) {
    // Supabase JS melempar FunctionsHttpError utk status non-2xx; coba ambil pesan dari body
    let msg = error.message || 'Gagal menghubungi server.';
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch (_) { /* abaikan */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

async function refreshAkun() {
  const tbody = document.querySelector('#akunTable tbody');
  try {
    const rows = await callAdminUsers('list');
    allAkun = rows || [];
    renderTable();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="t">Gagal memuat data akun</div>
      <div class="s">${escapeHtml(e.message)}</div>
    </div></td></tr>`;
  }
}

function roleBadge(role) {
  return `<span class="badge ${role === 'Admin' ? 'badge-progress' : 'badge-closed'}">${role}</span>`;
}

function statusBadge(banned) {
  return banned
    ? `<span class="badge badge-rejected">Nonaktif</span>`
    : `<span class="badge badge-pass">Aktif</span>`;
}

function renderTable() {
  const filtered = getFilteredAkun();
  const tbody = document.querySelector('#akunTable tbody');

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <div class="t">Belum ada akun</div>
      <div class="s">Klik "Akun Baru" untuk menambahkan pengguna</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.nama)}</strong></td>
      <td>${escapeHtml(a.email)}</td>
      <td>${roleBadge(a.role)}</td>
      <td>${statusBadge(a.banned)}</td>
      <td>${a.last_sign_in_at ? formatDateTime(a.last_sign_in_at) : '-'}</td>
      <td>${formatDate(a.created_at)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="AkunPage.viewDetail('${a.id}')">Detail</button></td>
    </tr>
  `).join('');
}

function getFilteredAkun() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fRole = document.getElementById('filterRole').value;
  const fStatus = document.getElementById('filterStatus').value;

  return allAkun.filter(a => {
    if (fRole && a.role !== fRole) return false;
    if (fStatus === 'active' && a.banned) return false;
    if (fStatus === 'banned' && !a.banned) return false;
    if (q) {
      const hay = `${a.nama} ${a.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function wireFilters() {
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('filterRole').addEventListener('change', renderTable);
  document.getElementById('filterStatus').addEventListener('change', renderTable);
}

/* ---------------- FORM (Create / Edit) ---------------- */

function wireForm() {
  document.querySelectorAll('#roleChips .radio-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#roleChips .radio-chip').forEach(c => c.classList.remove('sel-pass', 'sel-fail'));
      chip.classList.add(chip.dataset.val === 'Admin' ? 'sel-fail' : 'sel-pass');
    });
  });
  document.getElementById('saveAkunBtn').addEventListener('click', saveAkun);
}

function setRoleChip(role) {
  document.querySelectorAll('#roleChips .radio-chip').forEach(c => c.classList.remove('sel-pass', 'sel-fail'));
  const chip = document.querySelector(`#roleChips .radio-chip[data-val="${role}"]`);
  if (chip) {
    chip.querySelector('input').checked = true;
    chip.classList.add(role === 'Admin' ? 'sel-fail' : 'sel-pass');
  }
}

function openForm(akun) {
  document.getElementById('akunForm').reset();

  if (akun) {
    document.getElementById('formModalTitle').textContent = 'Edit Akun';
    document.getElementById('akunId').value = akun.id;
    document.getElementById('fNama').value = akun.nama || '';
    document.getElementById('fEmail').value = akun.email || '';
    document.getElementById('fPassword').value = '';
    document.getElementById('passwordHint').textContent = 'Kosongkan saat edit jika tidak ingin mengubah password.';
    setRoleChip(akun.role);
  } else {
    document.getElementById('formModalTitle').textContent = 'Akun Baru';
    document.getElementById('akunId').value = '';
    document.getElementById('passwordHint').textContent = 'Minimal 6 karakter.';
    setRoleChip('User');
  }

  openModal('formModal');
}

async function saveAkun() {
  const id = document.getElementById('akunId').value;
  const nama = document.getElementById('fNama').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const password = document.getElementById('fPassword').value;
  const role = document.querySelector('#roleChips input:checked')?.value || 'User';

  if (!nama || !email) {
    toast('Lengkapi field wajib (bertanda *)', 'error');
    return;
  }
  if (!id && (!password || password.length < 6)) {
    toast('Password wajib diisi (minimal 6 karakter) untuk akun baru', 'error');
    return;
  }
  if (password && password.length < 6) {
    toast('Password minimal 6 karakter', 'error');
    return;
  }

  const btn = document.getElementById('saveAkunBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    if (id) {
      await callAdminUsers('update', { id, nama, email, role, ...(password ? { password } : {}) });
      toast('Akun berhasil diperbarui', 'success');
    } else {
      await callAdminUsers('create', { nama, email, password, role });
      toast('Akun berhasil dibuat', 'success');
    }
    closeModal('formModal');
    await refreshAkun();
  } catch (e) {
    toast('Gagal menyimpan: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Simpan Akun';
  }
}

/* ---------------- DETAIL ---------------- */

function viewDetail(id) {
  const a = allAkun.find(x => x.id === id);
  if (!a) return;
  currentDetailId = id;

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="k">Nama</div><div class="v">${escapeHtml(a.nama)}</div></div>
      <div class="detail-item"><div class="k">Email</div><div class="v">${escapeHtml(a.email)}</div></div>
      <div class="detail-item"><div class="k">Role</div><div class="v">${roleBadge(a.role)}</div></div>
      <div class="detail-item"><div class="k">Status</div><div class="v">${statusBadge(a.banned)}</div></div>
      <div class="detail-item"><div class="k">Login Terakhir</div><div class="v">${a.last_sign_in_at ? formatDateTime(a.last_sign_in_at) : '-'}</div></div>
      <div class="detail-item"><div class="k">Dibuat</div><div class="v">${formatDateTime(a.created_at)}</div></div>
    </div>
  `;

  const toggleBtn = document.getElementById('toggleBanBtn');
  toggleBtn.textContent = a.banned ? 'Aktifkan' : 'Nonaktifkan';
  toggleBtn.disabled = a.id === currentProfile.id;
  document.getElementById('deleteAkunBtn').disabled = a.id === currentProfile.id;

  openModal('detailModal');
}

window.AkunPage = { viewDetail };

})();
