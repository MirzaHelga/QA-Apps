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

// ---------- Profile & role ----------
let _profileCache = null;

// Ambil profile (nama + role) akun yang sedang login. Di-cache per pageload.
async function getCurrentProfile() {
  if (_profileCache) return _profileCache;
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) { console.error(error); return null; }
  _profileCache = data || { id: user.id, email: user.email, nama: user.email?.split('@')[0], role: 'User' };
  return _profileCache;
}

// Guard: hanya boleh diakses Admin. Redirect ke index.html kalau bukan admin.
async function requireAdmin() {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'Admin') {
    window.location.href = 'index.html';
    return null;
  }
  return profile;
}

// Guard: role Operator cuma boleh akses halaman Verifikasi Quality & Report QC (buat input).
// Panggil di halaman selain itu (index/complaint/akun) setelah requireAuth().
async function blockOperator() {
  const profile = await getCurrentProfile();
  if (profile && profile.role === 'Operator') {
    window.location.href = 'verifikasi.html';
    return true;
  }
  return false;
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

// ---------- Kompres foto (target ~100-300KB) sebelum upload ----------
function _fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function _canvasToBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Resize (maks 1600px sisi terpanjang) + turunkan quality JPEG bertahap
// sampai ukurannya masuk target 100-300KB (atau mentok quality minimum).
async function compressImage(file, { targetMinKB = 100, targetMaxKB = 300, maxDim = 1600 } = {}) {
  if (!file.type.startsWith('image/')) return file;
  // GIF dilewatin (animasi bisa rusak kalau di-canvas-in)
  if (file.type === 'image/gif') return file;

  try {
    const img = await _fileToImage(file);
    let { width, height } = img;
    if (Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

    let quality = 0.85;
    let blob = await _canvasToBlob(canvas, quality);
    // Turunin quality kalau masih di atas target maks
    while (blob && blob.size > targetMaxKB * 1024 && quality > 0.35) {
      quality -= 0.1;
      blob = await _canvasToBlob(canvas, quality);
    }
    // Kalau masih kegedean di quality minimum, perkecil dimensinya juga
    let dim = maxDim;
    while (blob && blob.size > targetMaxKB * 1024 && dim > 480) {
      dim = Math.round(dim * 0.85);
      const scale = dim / Math.max(width, height);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      blob = await _canvasToBlob(canvas, quality);
    }

    if (!blob || blob.size >= file.size) return file; // gagal / gak lebih kecil, pakai file asli
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (e) {
    console.error('Gagal kompres foto, pakai file asli:', e);
    return file;
  }
}

// ---------- Upload foto ke Supabase Storage ----------
async function uploadPhoto(file, folder) {
  const compressed = await compressImage(file);
  const ext = compressed.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabaseClient.storage.from(PHOTO_BUCKET).upload(fileName, compressed, {
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
