/* =========================================================
   VERIFIKASI QUALITY PAGE LOGIC
   (Checklist "Proses After CIP" & "Proses Start Up")
   Dibungkus IIFE supaya variabel/fungsinya tidak bentrok dengan
   controller halaman lain di sesi SPA yang sama.
========================================================= */
(function () {

// Checklist master — diambil dari template LAPORAN VERIFIKASI QUALITY
const VQ_CHECKLIST = {
  'After CIP': [
    { pengecekan: 'Liquid sugar prefilter (preforated SS)', standard: 'bersih, tidak ada kotoran, tidak berbau menyengat' },
    { pengecekan: 'Magentic trap sugar disolving tank', standard: 'berfungsi dengan baik' },
    { pengecekan: 'Liquid sugar first filter', standard: 'shifter dan filter paper dalam kondisi utuh' },
    { pengecekan: 'Liquid sugar second filter', standard: 'shifter dan filter paper dalam kondisi utuh' },
    { pengecekan: 'Syrup filter Line 1,2,3,4', standard: 'filter paper dalam kondisi utuh' },
    { pengecekan: 'Magnetic trap sugar tippping Line 5', standard: 'berfungsi dengan baik' },
    { pengecekan: 'Syrup filter Line 5', standard: 'filter paper dalam kondisi utuh' },
    { pengecekan: 'Lampu side glass', standard: 'pastikan berfungsi dengan baik' },
    { pengecekan: 'Pengecekan metal dengan 3 sampel (metal detector)', standard: 'pastikan berfungsi dengan baik' },
    { pengecekan: 'Temperature', standard: '20 - 25 Celcius' },
    { pengecekan: 'RH', standard: '40 - 45%' },
    { pengecekan: 'Rinsing awal PHE dan cooker', standard: 'pastikan tidak ada blackspot' },
    { pengecekan: 'Hopper, nozzle', standard: 'dipastikan bersih (tidak berkerak, tidak lengket)' },
    { pengecekan: 'Filter FCAV utuh dan bersih', standard: 'bersih, tidak ada deposit kotoran' },
    { pengecekan: 'water flushing', standard: 'pH 6.5 - 7.5' },
    { pengecekan: 'Strainer air panas pektin', standard: 'bersih, tidak ada deposit kotoran' },
    { pengecekan: 'Strainer air panas gelatin', standard: 'bersih, tidak ada deposit kotoran' },
    { pengecekan: 'Jalur CIP tidak ada bau / sisa kotoran visual', standard: 'bersih, tidak ada kotoran, tidak berbau menyengat' },
    { pengecekan: 'Verifikasi hasil cleaning dengan basa esteem', standard: 'cek apakah di kotoran nya ada bahan tidak wajar, misal besi, kemudian sudah bersih' },
    { pengecekan: 'Cek air hasil CIP akhir', standard: 'cek konsentrasi CIP, sampel dikirim ke QA min 100 mL' },
  ],
  'Start Up': [
    { pengecekan: 'Total solid sirup gula', standard: 'min 67%' },
    { pengecekan: 'TS after PHE', standard: 'min 77%' },
    { pengecekan: 'Dosing pump', standard: 'pastikan flavor, color sesuai receipe, selang tidak tertutup, tidak bocor, tidak ada gelembung' },
    { pengecekan: 'Temperature produk sebelum depositing', standard: '145 Celcius' },
    { pengecekan: 'Rework', standard: 'kualitas: warna, bau, rasa' },
    { pengecekan: 'Cek produk awal (1 cycle) hold dulu untuk dilakukan pengecekan', standard: 'Sensory: warna, rasa, bau, bentuk, black spot, berat, tailing' },
    { pengecekan: 'Menyalakan blower', standard: 'sudah dilakukan' },
  ],
};

let master = null;
let allVq = [];
let activeTab = 'After CIP';
let currentDetailId = null;
let currentProfile = null;

window.PageControllers = window.PageControllers || {};
window.PageControllers.verifikasi = async function initVerifikasiPage() {
  const session = await requireAuth();
  if (!session) return;

  activeTab = 'After CIP';
  currentDetailId = null;

  currentProfile = await getCurrentProfile();
  master = await loadMasterData();
  populateKaryawanSelects();
  wireTabs();
  wireFilters();
  wireForm();
  wirePhotoUpload();
  wireStaticButtons();
  applyRoleRestrictions();
  await refreshVq();

  document.getElementById('newVqBtn').addEventListener('click', () => openForm(null));
  document.getElementById('exportExcelBtn').addEventListener('click', exportVq);
};

// Operator: hanya boleh input verifikasi baru, tidak boleh export / edit / hapus / approve.
function isOperator() { return currentProfile?.role === 'Operator'; }
function canApprove() { return currentProfile?.role === 'Admin' || currentProfile?.role === 'Spv'; }

function applyRoleRestrictions() {
  if (isOperator()) {
    document.getElementById('exportExcelBtn').style.display = 'none';
  }
}

function wireStaticButtons() {
  document.getElementById('editVqBtn').addEventListener('click', () => {
    const r = allVq.find(x => x.id === currentDetailId);
    closeModal('detailModal');
    openForm(r);
  });

  document.getElementById('deleteVqBtn').addEventListener('click', async () => {
    if (!currentDetailId) return;
    if (!confirm('Hapus data verifikasi ini? Tindakan tidak dapat dibatalkan.')) return;
    const { error } = await supabaseClient.from('verifikasi_quality').delete().eq('id', currentDetailId);
    if (error) { toast('Gagal menghapus: ' + error.message, 'error'); return; }
    toast('Data berhasil dihapus', 'success');
    closeModal('detailModal');
    await refreshVq();
  });

  document.getElementById('approveVqBtn').addEventListener('click', async () => {
    if (!currentDetailId || !canApprove()) return;
    const qaSelect = document.getElementById('fApprovalQa');
    const qaId = qaSelect ? qaSelect.value : '';
    if (!qaId) {
      toast('Pilih QA (Nama/NIK) sebelum approve', 'error');
      return;
    }
    const { error } = await supabaseClient.from('verifikasi_quality').update({
      approval_status: 'Approved',
      approved_by: currentProfile.id,
      approved_at: new Date().toISOString(),
      catatan_approval: null,
      qa_id: qaId,
    }).eq('id', currentDetailId);
    if (error) { toast('Gagal approve: ' + error.message, 'error'); return; }
    toast('Verifikasi disetujui', 'success');
    closeModal('detailModal');
    await refreshVq();
    if (canApprove() && typeof loadPendingApprovalBadge === 'function') loadPendingApprovalBadge();
  });

  document.getElementById('rejectVqBtn').addEventListener('click', async () => {
    if (!currentDetailId || !canApprove()) return;
    const alasan = prompt('Alasan penolakan (opsional):') || null;
    const { error } = await supabaseClient.from('verifikasi_quality').update({
      approval_status: 'Ditolak',
      approved_by: currentProfile.id,
      approved_at: new Date().toISOString(),
      catatan_approval: alasan,
    }).eq('id', currentDetailId);
    if (error) { toast('Gagal menolak: ' + error.message, 'error'); return; }
    toast('Verifikasi ditolak', 'success');
    closeModal('detailModal');
    await refreshVq();
    if (canApprove() && typeof loadPendingApprovalBadge === 'function') loadPendingApprovalBadge();
  });
}

/* ---------------- Foto per-baris checklist ---------------- */
// rowPhotos[idx] = { existing: [url,...], new: [File,...] }
let rowPhotos = {};
let activePhotoRowIdx = null;

function ensureRowPhotos(idx) {
  if (!rowPhotos[idx]) rowPhotos[idx] = { existing: [], new: [] };
  return rowPhotos[idx];
}

function wirePhotoUpload() {
  const rowPhotoInput = document.getElementById('rowPhotoInput');
  rowPhotoInput.addEventListener('change', async () => {
    const files = Array.from(rowPhotoInput.files || []);
    rowPhotoInput.value = '';
    if (!files.length || activePhotoRowIdx === null) return;

    const tooBig = files.filter(f => f.size > 8 * 1024 * 1024);
    if (tooBig.length) toast(`${tooBig.length} foto dilewati karena lebih dari 8MB`, 'error');

    const ok = files.filter(f => f.size <= 8 * 1024 * 1024);
    ensureRowPhotos(activePhotoRowIdx).new.push(...ok);
    renderRowPhotoPreview(activePhotoRowIdx);
  });

  // Delegasi klik tombol kamera & tombol hapus foto per-baris (baris dibangun ulang tiap render)
  document.getElementById('checklistBody').addEventListener('click', (e) => {
    const btn = e.target.closest('.row-photo-btn');
    if (btn) {
      activePhotoRowIdx = Number(btn.dataset.idx);
      document.getElementById('rowPhotoInput').click();
      return;
    }
    const rm = e.target.closest('.rp-tile .rm');
    if (rm) {
      const idx = Number(rm.dataset.idx);
      const type = rm.dataset.type;
      const i = Number(rm.dataset.i);
      const rp = ensureRowPhotos(idx);
      if (type === 'existing') rp.existing.splice(i, 1);
      else rp.new.splice(i, 1);
      renderRowPhotoPreview(idx);
    }
  });
}

function renderRowPhotoPreview(idx) {
  const cell = document.querySelector(`.foto-col-cell[data-idx="${idx}"]`);
  if (!cell) return;
  const rp = ensureRowPhotos(idx);
  const count = rp.existing.length + rp.new.length;

  const countEl = cell.querySelector('.row-photo-count');
  if (countEl) countEl.textContent = count;

  const wrap = cell.querySelector('.row-photo-preview');
  const existingTiles = rp.existing.map((url, i) => `
    <div class="rp-tile">
      <img src="${url}" onclick="window.open('${url}','_blank')">
      <button type="button" class="rm" data-idx="${idx}" data-type="existing" data-i="${i}">&times;</button>
    </div>
  `).join('');
  const newTiles = rp.new.map((file, i) => `
    <div class="rp-tile">
      <img src="${URL.createObjectURL(file)}">
      <button type="button" class="rm" data-idx="${idx}" data-type="new" data-i="${i}">&times;</button>
    </div>
  `).join('');
  wrap.innerHTML = existingTiles + newTiles;
}

function karyawanOptions(selectedId) {
  return '<option value="">-- Pilih Karyawan --</option>' +
    master.karyawan.map(k => `<option value="${k.id}" ${String(k.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(k.nama)} (${escapeHtml(k.nik)})</option>`).join('');
}

function populateKaryawanSelects() {
  document.getElementById('fOperator').innerHTML = karyawanOptions();
  document.getElementById('fFlm').innerHTML = karyawanOptions();
}

/* ---------------- Tabs ---------------- */

function wireTabs() {
  document.querySelectorAll('#vqTabs .pill-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#vqTabs .pill-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tipe;
      renderTable();
    });
  });
}

/* ---------------- Filters ---------------- */

function wireFilters() {
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('filterShift').addEventListener('change', renderTable);
  document.getElementById('filterStatus').addEventListener('change', renderTable);
}

/* ---------------- Data ---------------- */

async function refreshVq() {
  const { data, error } = await supabaseClient
    .from('verifikasi_quality')
    .select('*, operator:operator_id(nama), flm:flm_id(nama), qa:qa_id(nama)')
    .order('created_at', { ascending: false });
  if (error) { toast('Gagal memuat data: ' + error.message, 'error'); return; }
  allVq = data || [];
  renderTable();
}

function vqStatus(record) {
  const items = record.items || [];
  const hasIssue = items.some(it => it.status === 'Tidak Sesuai');
  return hasIssue ? 'Perlu Tindakan' : 'Sesuai';
}

function statusBadge(status) {
  return `<span class="badge ${status === 'Sesuai' ? 'badge-ok' : 'badge-no'}">${status}</span>`;
}

function approvalBadge(status) {
  const cls = status === 'Approved' ? 'badge-closed' : status === 'Ditolak' ? 'badge-rejected' : 'badge-open';
  return `<span class="badge ${cls}">${status || 'Menunggu Approval'}</span>`;
}

function getFilteredVq() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fShift = document.getElementById('filterShift').value;
  const fStatus = document.getElementById('filterStatus').value;

  return allVq.filter(r => {
    if (r.tipe !== activeTab) return false;
    if (isOperator() && r.created_by !== currentProfile.id) return false;
    if (fShift && r.shift !== fShift) return false;
    if (fStatus && vqStatus(r) !== fStatus) return false;
    if (q) {
      const hay = `${r.no} ${r.line || ''} ${r.operator?.nama || ''} ${r.flm?.nama || ''} ${r.qa?.nama || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTable() {
  const filtered = getFilteredVq();
  const tbody = document.querySelector('#vqTable tbody');

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>
      <div class="t">Belum ada data verifikasi</div>
      <div class="s">Klik "Verifikasi Baru" untuk menambahkan data</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.no)}</strong></td>
      <td>${formatDate(r.tanggal)}</td>
      <td>${r.shift ? 'Shift ' + escapeHtml(r.shift) : '-'}</td>
      <td>${escapeHtml(r.line || '-')}</td>
      <td>${escapeHtml(r.flm?.nama || '-')}</td>
      <td>${escapeHtml(r.qa?.nama || '-')}</td>
      <td>${statusBadge(vqStatus(r))}</td>
      <td>${approvalBadge(r.approval_status)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="VerifikasiPage.viewDetail('${r.id}')">Detail</button></td>
    </tr>
  `).join('');
}

/* ---------------- Export ---------------- */

function exportVq() {
  const filtered = getFilteredVq();
  if (!filtered.length) { toast('Tidak ada data untuk di-export', 'error'); return; }

  const rows = [];
  filtered.forEach(r => {
    (r.items || []).forEach((it, idx) => {
      rows.push({
        'No. Verifikasi': r.no,
        'Jenis': r.tipe,
        'Tanggal': formatDate(r.tanggal),
        'Shift': r.shift || '-',
        'Line': r.line || '-',
        'No Item': idx + 1,
        'Pengecekan': it.pengecekan,
        'Standard': it.standard,
        'Hasil Pengecekan': it.hasil || '-',
        'Status': it.status,
        'FLM': r.flm?.nama || '-',
        'QA': r.qa?.nama || '-',
      });
    });
  });

  exportToExcel(rows, `Verifikasi_Quality_${activeTab.replace(/\s+/g, '_')}_${todayISO()}.xlsx`, activeTab);
}

/* ---------------- Form (Create / Edit) ---------------- */

function wireForm() {
  document.querySelectorAll('#tipeChips .radio-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#tipeChips .radio-chip').forEach(c => c.classList.remove('sel-pass'));
      chip.classList.add('sel-pass');
      renderChecklistRows(chip.dataset.val, null);
    });
  });

  document.getElementById('saveVqBtn').addEventListener('click', saveVq);
}

function renderChecklistRows(tipe, existingItems) {
  const items = VQ_CHECKLIST[tipe] || [];
  const body = document.getElementById('checklistBody');
  rowPhotos = {};

  body.innerHTML = items.map((it, idx) => {
    const existing = existingItems && existingItems[idx];
    const hasil = existing ? (existing.hasil || '') : '';
    const status = existing ? (existing.status || 'Sesuai') : 'Sesuai';
    const existingPhotos = (existing && existing.photos) ? existing.photos : [];
    rowPhotos[idx] = { existing: [...existingPhotos], new: [] };
    return `
      <tr>
        <td class="no-col">${idx + 1}</td>
        <td>${escapeHtml(it.pengecekan)}</td>
        <td class="std-col">${escapeHtml(it.standard)}</td>
        <td class="hasil-col"><input type="text" class="vq-hasil" data-idx="${idx}" placeholder="Hasil pengecekan..." value="${escapeHtml(hasil)}"></td>
        <td class="status-col">
          <div class="status-toggle" data-idx="${idx}">
            <label class="status-chip ${status === 'Sesuai' ? 'sel-ok' : ''}" data-val="Sesuai">
              <input type="radio" name="vqstatus_${idx}" value="Sesuai" ${status === 'Sesuai' ? 'checked' : ''}>OK
            </label>
            <label class="status-chip ${status === 'Tidak Sesuai' ? 'sel-no' : ''}" data-val="Tidak Sesuai">
              <input type="radio" name="vqstatus_${idx}" value="Tidak Sesuai" ${status === 'Tidak Sesuai' ? 'checked' : ''}>NOK
            </label>
          </div>
        </td>
        <td class="foto-col foto-col-cell" data-idx="${idx}">
          <button type="button" class="row-photo-btn" data-idx="${idx}" title="Ambil foto / unggah dari galeri">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="row-photo-count">${existingPhotos.length}</span>
          </button>
          <div class="row-photo-preview"></div>
        </td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('.status-toggle').forEach(toggle => {
    toggle.querySelectorAll('.status-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        toggle.querySelectorAll('.status-chip').forEach(c => c.classList.remove('sel-ok', 'sel-no'));
        chip.classList.add(chip.dataset.val === 'Sesuai' ? 'sel-ok' : 'sel-no');
      });
    });
  });

  items.forEach((it, idx) => renderRowPhotoPreview(idx));
}

function openForm(record) {
  document.getElementById('vqForm').reset();
  document.getElementById('vqId').value = '';
  activePhotoRowIdx = null;

  const tipe = record ? record.tipe : activeTab;
  document.querySelectorAll('#tipeChips .radio-chip').forEach(c => c.classList.remove('sel-pass'));
  const chip = document.querySelector(`#tipeChips .radio-chip[data-val="${tipe}"]`);
  if (chip) { chip.querySelector('input').checked = true; chip.classList.add('sel-pass'); }

  renderChecklistRows(tipe, record ? record.items : null);

  if (record) {
    document.getElementById('formModalTitle').textContent = 'Edit Verifikasi Quality';
    document.getElementById('vqId').value = record.id;
    document.getElementById('fTanggal').value = record.tanggal;
    document.getElementById('fShift').value = record.shift || '';
    document.getElementById('fLine').value = record.line || '';
    document.getElementById('fPerLine').checked = !!record.per_line;
    document.getElementById('fOperator').value = record.operator_id || '';
    document.getElementById('fFlm').value = record.flm_id || '';
    document.getElementById('fCatatan').value = record.catatan || '';
  } else {
    document.getElementById('formModalTitle').textContent = 'Verifikasi Quality Baru';
    document.getElementById('fTanggal').value = todayISO();
  }

  openModal('formModal');
}

function collectChecklistItems(tipe) {
  const items = VQ_CHECKLIST[tipe] || [];
  return items.map((it, idx) => {
    const hasilInput = document.querySelector(`.vq-hasil[data-idx="${idx}"]`);
    const statusInput = document.querySelector(`input[name="vqstatus_${idx}"]:checked`);
    return {
      pengecekan: it.pengecekan,
      standard: it.standard,
      hasil: hasilInput ? hasilInput.value.trim() : '',
      status: statusInput ? statusInput.value : 'Sesuai',
      _rowIdx: idx, // dipakai internal buat mapping foto pas saveVq, dibuang sebelum insert
    };
  });
}

async function saveVq() {
  const id = document.getElementById('vqId').value;
  const tipeInput = document.querySelector('#tipeChips input:checked');
  const tanggal = document.getElementById('fTanggal').value;

  if (!tipeInput || !tanggal) {
    toast('Lengkapi field wajib (bertanda *)', 'error');
    return;
  }

  const tipe = tipeInput.value;
  const btn = document.getElementById('saveVqBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const items = collectChecklistItems(tipe);

    // Upload foto baru per-baris, lalu gabung sama foto lama & tempel ke masing-masing item
    for (const item of items) {
      const idx = item._rowIdx;
      const rp = rowPhotos[idx] || { existing: [], new: [] };
      const uploadedUrls = [];
      for (const file of rp.new) {
        uploadedUrls.push(await uploadPhoto(file, 'verifikasi'));
      }
      item.photos = [...rp.existing, ...uploadedUrls];
      delete item._rowIdx;
    }

    const payload = {
      tipe,
      tanggal,
      shift: document.getElementById('fShift').value || null,
      line: document.getElementById('fLine').value.trim() || null,
      per_line: document.getElementById('fPerLine').checked,
      items,
      operator_id: document.getElementById('fOperator').value || null,
      flm_id: document.getElementById('fFlm').value || null,
      catatan: document.getElementById('fCatatan').value.trim() || null,
      // isi ulang / perubahan checklist selalu perlu di-approve ulang oleh Spv
      approval_status: 'Menunggu Approval',
      approved_by: null,
      approved_at: null,
      catatan_approval: null,
    };
    if (!id) payload.created_by = currentProfile?.id || null;

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('verifikasi_quality').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('verifikasi_quality').insert(payload));
    }
    if (error) throw error;

    toast(id ? 'Verifikasi berhasil diperbarui' : 'Verifikasi berhasil disimpan', 'success');
    closeModal('formModal');
    await refreshVq();
    if (canApprove() && typeof loadPendingApprovalBadge === 'function') loadPendingApprovalBadge();
  } catch (e) {
    toast('Gagal menyimpan: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Simpan Verifikasi';
  }
}

/* ---------------- Detail ---------------- */

function viewDetail(id) {
  const r = allVq.find(x => x.id === id);
  if (!r) return;
  currentDetailId = id;

  const itemsHtml = (r.items || []).map((it, idx) => {
    const isNok = it.status === 'Tidak Sesuai';
    const photos = it.photos || [];
    return `
    <tr>
      <td class="no-col">${idx + 1}</td>
      <td>${escapeHtml(it.pengecekan)}</td>
      <td class="std-col">${escapeHtml(it.standard)}</td>
      <td>${escapeHtml(it.hasil || '-')}</td>
      <td><span class="badge ${isNok ? 'badge-no' : 'badge-ok'}">${isNok ? 'NOK' : 'OK'}</span></td>
      <td class="foto-col">${photos.length ? `<div class="vq-photo-grid">${photos.map(url => `<img src="${url}" style="width:34px;height:34px;" onclick="window.open('${url}','_blank')">`).join('')}</div>` : '-'}</td>
    </tr>
  `;
  }).join('');

  document.getElementById('detailModalTitle').textContent = `Detail Verifikasi — ${r.tipe === 'After CIP' ? 'Proses After CIP' : 'Proses Start Up'}`;

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="k">No. Verifikasi</div><div class="v">${escapeHtml(r.no)}</div></div>
      <div class="detail-item"><div class="k">Jenis</div><div class="v">${escapeHtml(r.tipe)}</div></div>
      <div class="detail-item"><div class="k">Tanggal</div><div class="v">${formatDate(r.tanggal)}</div></div>
      <div class="detail-item"><div class="k">Shift</div><div class="v">${r.shift ? 'Shift ' + escapeHtml(r.shift) : '-'}</div></div>
      <div class="detail-item"><div class="k">Line</div><div class="v">${escapeHtml(r.line || '-')}${r.per_line ? ' (per-line)' : ''}</div></div>
      <div class="detail-item"><div class="k">Status</div><div class="v">${statusBadge(vqStatus(r))}</div></div>
      <div class="detail-item"><div class="k">Approval</div><div class="v">${approvalBadge(r.approval_status)}</div></div>
      <div class="detail-item"><div class="k">Operator</div><div class="v">${escapeHtml(r.operator?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">FLM</div><div class="v">${escapeHtml(r.flm?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">QA</div><div class="v">${escapeHtml(r.qa?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">Dibuat</div><div class="v" style="font-weight:400;">${formatDateTime(r.created_at)}</div></div>
    </div>
    ${r.catatan ? `<div class="detail-item" style="margin-bottom:12px;"><div class="k">Catatan</div><div class="v" style="font-weight:400;">${escapeHtml(r.catatan)}</div></div>` : ''}
    ${r.catatan_approval ? `<div class="detail-item" style="margin-bottom:12px;"><div class="k">Catatan Approval</div><div class="v" style="font-weight:400;">${escapeHtml(r.catatan_approval)}</div></div>` : ''}
    ${canApprove() && r.approval_status === 'Menunggu Approval' ? `
      <div class="field" style="max-width:360px; margin-bottom:12px;">
        <label>QA (Nama/NIK) <span class="req">*</span></label>
        <select id="fApprovalQa">${karyawanOptions(r.qa_id)}</select>
      </div>
    ` : ''}
    <div class="section-title" style="margin-top:6px;">Checklist Pengecekan</div>
    <div class="check-table-wrap">
      <table class="check-table">
        <thead>
          <tr><th class="no-col">No</th><th>Pengecekan</th><th class="std-col">Standard</th><th>Hasil Pengecekan</th><th class="status-col">Status</th><th class="foto-col">Foto</th></tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>
  `;

  // Tombol aksi disesuaikan dengan role & status approval:
  // - Operator: tidak bisa edit/hapus/approve, cuma lihat.
  // - Spv/Admin: bisa edit/hapus, dan bisa Approve/Tolak selama masih "Menunggu Approval".
  const editBtn = document.getElementById('editVqBtn');
  const deleteBtn = document.getElementById('deleteVqBtn');
  const approveBtn = document.getElementById('approveVqBtn');
  const rejectBtn = document.getElementById('rejectVqBtn');

  editBtn.style.display = isOperator() ? 'none' : '';
  deleteBtn.style.display = isOperator() ? 'none' : '';
  const showApproval = canApprove() && r.approval_status === 'Menunggu Approval';
  approveBtn.style.display = showApproval ? '' : 'none';
  rejectBtn.style.display = showApproval ? '' : 'none';

  openModal('detailModal');
}

window.VerifikasiPage = { viewDetail };

})();
