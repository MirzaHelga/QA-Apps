/* =========================================================
   UTILITAS UMUM
========================================================= */

// ---------- Auth guard ----------
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// ---------- Toast ----------
function ensureToastWrap() {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

function toast(message, type = 'default') {
  const wrap = ensureToastWrap();
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'err' : type === 'success' ? 'ok' : ''}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------- Formatting ----------
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Export ke Excel (SheetJS) ----------
function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  if (typeof XLSX === 'undefined') {
    toast('Gagal export: library Excel belum termuat', 'error');
    return;
  }
  if (!rows || !rows.length) {
    toast('Tidak ada data untuk di-export', 'error');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  // auto-lebarin kolom biar gak kepotong
  const colWidths = Object.keys(rows[0]).map(key => {
    const maxLen = rows.reduce((m, r) => Math.max(m, String(r[key] ?? '').length), key.length);
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  toast('Data berhasil di-export ke Excel', 'success');
}

// ---------- Master data (Area / Mesin / Equipment) ----------
let _masterCache = null;

async function loadMasterData() {
  if (_masterCache) return _masterCache;
  const [areaRes, mesinRes, equipRes, karyawanRes] = await Promise.all([
    supabaseClient.from('master_area').select('*').order('nama'),
    supabaseClient.from('master_mesin').select('*').order('nama'),
    supabaseClient.from('master_equipment').select('*').order('nama'),
    supabaseClient.from('master_karyawan').select('*').eq('status', 'Active').order('nama'),
  ]);
  if (areaRes.error) console.error(areaRes.error);
  if (mesinRes.error) console.error(mesinRes.error);
  if (equipRes.error) console.error(equipRes.error);
  if (karyawanRes.error) console.error(karyawanRes.error);

  _masterCache = {
    areas: areaRes.data || [],
    mesin: mesinRes.data || [],
    equipment: equipRes.data || [],
    karyawan: karyawanRes.data || [],
  };
  return _masterCache;
}

// Isi <select> Area, lalu cascading ke Mesin & Equipment
function wireCascadingSelects({ areaSel, mesinSel, equipSel, master }) {
  function fillMesin(areaId) {
    const options = master.mesin.filter(m => m.area_id === areaId);
    mesinSel.innerHTML = '<option value="">-- Pilih Mesin --</option>' +
      options.map(m => `<option value="${m.id}">${escapeHtml(m.nama)}</option>`).join('');
    mesinSel.disabled = options.length === 0;
    fillEquip(null);
  }
  function fillEquip(mesinId) {
    const options = mesinId ? master.equipment.filter(e => e.mesin_id === mesinId) : [];
    equipSel.innerHTML = '<option value="">-- Pilih Equipment (opsional) --</option>' +
      options.map(e => `<option value="${e.id}">${escapeHtml(e.nama)}</option>`).join('');
    equipSel.disabled = options.length === 0;
  }

  areaSel.innerHTML = '<option value="">-- Pilih Area --</option>' +
    master.areas.map(a => `<option value="${a.id}">${escapeHtml(a.nama)}</option>`).join('');

  areaSel.addEventListener('change', () => fillMesin(areaSel.value || null));
  mesinSel.addEventListener('change', () => fillEquip(mesinSel.value || null));

  mesinSel.disabled = true;
  equipSel.disabled = true;
}

// ---------- Upload foto ke Supabase Storage ----------
async function uploadPhoto(file, folder) {
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabaseClient.storage.from(PHOTO_BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: pub } = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(data.path);
  return pub.publicUrl;
}

// ---------- Modal helpers ----------
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
