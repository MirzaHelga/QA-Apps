/* =========================================================
   REPORT QC PAGE LOGIC
========================================================= */

let master = null;
let allReports = [];
let selectedPhotoFile = null;
let currentDetailId = null;

(async function init() {
  const session = await requireAuth();
  if (!session) return;

  renderShell({ active: 'report', title: 'Report QC', breadcrumb: 'Quality Assurance System / Report QC' });

  master = await loadMasterData();
  populateFilters();
  wireForm();
  wireFilters();
  await refreshReports();

  document.getElementById('newReportBtn').addEventListener('click', () => openForm(null));
  document.getElementById('exportExcelBtn').addEventListener('click', exportReports);
})();

function populateFilters() {
  const areaSel = document.getElementById('filterArea');
  areaSel.innerHTML = '<option value="">Semua Area</option>' +
    master.areas.map(a => `<option value="${a.id}">${escapeHtml(a.nama)}</option>`).join('');

  const karyawanSel = document.getElementById('fKaryawan');
  karyawanSel.innerHTML = '<option value="">-- Pilih Karyawan --</option>' +
    master.karyawan.map(k => `<option value="${k.id}">${escapeHtml(k.nama)} (${escapeHtml(k.nik)})</option>`).join('');

  wireCascadingSelects({
    areaSel: document.getElementById('fArea'),
    mesinSel: document.getElementById('fMesin'),
    equipSel: document.getElementById('fEquipment'),
    master,
  });
}

function wireFilters() {
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('filterHasil').addEventListener('change', renderTable);
  document.getElementById('filterArea').addEventListener('change', renderTable);
}

async function refreshReports() {
  const { data, error } = await supabaseClient
    .from('qc_reports')
    .select('*, master_area(nama), master_mesin(nama), master_equipment(nama), master_karyawan(nama)')
    .order('created_at', { ascending: false });
  if (error) { toast('Gagal memuat data: ' + error.message, 'error'); return; }
  allReports = data || [];
  renderTable();
}

function resultBadge(r) {
  return `<span class="badge ${r === 'Pass' ? 'badge-pass' : 'badge-fail'}">${r}</span>`;
}

function renderTable() {
  const filtered = getFilteredReports();

  const tbody = document.querySelector('#reportTable tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <div class="t">Belum ada report QC</div>
      <div class="s">Klik "Report Baru" untuk menambahkan data</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.report_no)}</strong></td>
      <td>${formatDate(r.tanggal)}</td>
      <td>${escapeHtml(r.master_area?.nama || '-')}${r.master_mesin ? ' / ' + escapeHtml(r.master_mesin.nama) : ''}</td>
      <td>${escapeHtml(r.parameter)}</td>
      <td>${resultBadge(r.hasil)}</td>
      <td>${escapeHtml(r.master_karyawan?.nama || '-')}</td>
      <td>${r.photo_url ? `<img src="${r.photo_url}" class="thumb-btn" onclick="event.stopPropagation(); window.open('${r.photo_url}','_blank')">` : `<div class="thumb-empty">–</div>`}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewDetail('${r.id}')">Detail</button></td>
    </tr>
  `).join('');
}

function getFilteredReports() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fHasil = document.getElementById('filterHasil').value;
  const fArea = document.getElementById('filterArea').value;

  return allReports.filter(r => {
    if (fHasil && r.hasil !== fHasil) return false;
    if (fArea && r.area_id !== fArea) return false;
    if (q) {
      const hay = `${r.report_no} ${r.parameter}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function exportReports() {
  const filtered = getFilteredReports();

  const rows = filtered.map(r => ({
    'No. Report': r.report_no,
    'Tanggal': formatDate(r.tanggal),
    'Shift': r.shift || '-',
    'Area': r.master_area?.nama || '-',
    'Mesin': r.master_mesin?.nama || '-',
    'Equipment': r.master_equipment?.nama || '-',
    'Parameter': r.parameter,
    'Standar': r.standar || '-',
    'Hasil Aktual': r.hasil_aktual || '-',
    'Hasil': r.hasil,
    'Inspector': r.master_karyawan?.nama || '-',
    'Catatan': r.catatan || '-',
    'Foto': r.photo_url || '-',
  }));

  exportToExcel(rows, `Report_QC_${todayISO()}.xlsx`, 'Report QC');
}

/* ---------------- FORM (Create / Edit) ---------------- */

function wireForm() {
  document.querySelectorAll('#hasilChips .radio-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#hasilChips .radio-chip').forEach(c => c.classList.remove('sel-pass', 'sel-fail'));
      chip.classList.add(chip.dataset.val === 'Pass' ? 'sel-pass' : 'sel-fail');
    });
  });

  const photoDrop = document.getElementById('photoDrop');
  const photoInput = document.getElementById('photoInput');
  photoDrop.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Ukuran foto maksimal 5MB', 'error'); return; }
    selectedPhotoFile = file;
    renderPhotoPreview(URL.createObjectURL(file));
  });

  document.getElementById('saveReportBtn').addEventListener('click', saveReport);
}

function renderPhotoPreview(url) {
  const wrap = document.getElementById('photoPreviewWrap');
  wrap.innerHTML = `
    <div class="photo-preview">
      <img src="${url}">
      <button type="button" class="rm" onclick="removePhoto()">&times;</button>
    </div>
  `;
}

function removePhoto() {
  selectedPhotoFile = null;
  document.getElementById('photoInput').value = '';
  document.getElementById('photoPreviewWrap').innerHTML = '';
}

function openForm(report) {
  document.getElementById('reportForm').reset();
  document.getElementById('photoPreviewWrap').innerHTML = '';
  selectedPhotoFile = null;
  document.getElementById('fMesin').innerHTML = '<option value="">-- Pilih Mesin --</option>';
  document.getElementById('fEquipment').innerHTML = '<option value="">-- Pilih Equipment (opsional) --</option>';

  document.querySelectorAll('#hasilChips .radio-chip').forEach(c => c.classList.remove('sel-pass', 'sel-fail'));
  document.querySelector('#hasilChips .radio-chip[data-val="Pass"]').classList.add('sel-pass');

  if (report) {
    document.getElementById('formModalTitle').textContent = 'Edit Report QC';
    document.getElementById('reportId').value = report.id;
    document.getElementById('fTanggal').value = report.tanggal;
    document.getElementById('fShift').value = report.shift || '';
    document.getElementById('fArea').value = report.area_id || '';
    document.getElementById('fArea').dispatchEvent(new Event('change'));
    setTimeout(() => {
      document.getElementById('fMesin').value = report.mesin_id || '';
      document.getElementById('fMesin').dispatchEvent(new Event('change'));
      setTimeout(() => { document.getElementById('fEquipment').value = report.equipment_id || ''; }, 30);
    }, 30);
    document.getElementById('fKaryawan').value = report.inspector_id || '';
    document.getElementById('fParameter').value = report.parameter || '';
    document.getElementById('fStandar').value = report.standar || '';
    document.getElementById('fHasilAktual').value = report.hasil_aktual || '';
    document.getElementById('fCatatan').value = report.catatan || '';
    document.querySelectorAll('#hasilChips .radio-chip').forEach(c => c.classList.remove('sel-pass', 'sel-fail'));
    const chip = document.querySelector(`#hasilChips .radio-chip[data-val="${report.hasil}"]`);
    if (chip) { chip.querySelector('input').checked = true; chip.classList.add(report.hasil === 'Pass' ? 'sel-pass' : 'sel-fail'); }
    if (report.photo_url) renderPhotoPreview(report.photo_url);
  } else {
    document.getElementById('formModalTitle').textContent = 'Report QC Baru';
    document.getElementById('reportId').value = '';
    document.getElementById('fTanggal').value = todayISO();
  }

  openModal('formModal');
}

async function saveReport() {
  const id = document.getElementById('reportId').value;
  const tanggal = document.getElementById('fTanggal').value;
  const areaId = document.getElementById('fArea').value;
  const parameter = document.getElementById('fParameter').value.trim();
  const hasilInput = document.querySelector('#hasilChips input:checked');

  if (!tanggal || !areaId || !parameter || !hasilInput) {
    toast('Lengkapi field wajib (bertanda *)', 'error');
    return;
  }

  const btn = document.getElementById('saveReportBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    let photoUrl = null;
    const existingPreviewImg = document.querySelector('#photoPreviewWrap img');
    if (selectedPhotoFile) {
      photoUrl = await uploadPhoto(selectedPhotoFile, 'qc-reports');
    } else if (existingPreviewImg) {
      photoUrl = existingPreviewImg.src;
    }

    const payload = {
      tanggal,
      shift: document.getElementById('fShift').value || null,
      area_id: areaId,
      mesin_id: document.getElementById('fMesin').value || null,
      equipment_id: document.getElementById('fEquipment').value || null,
      inspector_id: document.getElementById('fKaryawan').value || null,
      parameter,
      standar: document.getElementById('fStandar').value || null,
      hasil_aktual: document.getElementById('fHasilAktual').value || null,
      hasil: hasilInput.value,
      catatan: document.getElementById('fCatatan').value || null,
      photo_url: photoUrl,
    };

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('qc_reports').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('qc_reports').insert(payload));
    }
    if (error) throw error;

    toast(id ? 'Report berhasil diperbarui' : 'Report berhasil disimpan', 'success');
    closeModal('formModal');
    await refreshReports();
  } catch (e) {
    toast('Gagal menyimpan: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Simpan Report';
  }
}

/* ---------------- DETAIL ---------------- */

function viewDetail(id) {
  const r = allReports.find(x => x.id === id);
  if (!r) return;
  currentDetailId = id;

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="k">No. Report</div><div class="v">${escapeHtml(r.report_no)}</div></div>
      <div class="detail-item"><div class="k">Tanggal</div><div class="v">${formatDate(r.tanggal)}</div></div>
      <div class="detail-item"><div class="k">Area</div><div class="v">${escapeHtml(r.master_area?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">Mesin / Equipment</div><div class="v">${escapeHtml(r.master_mesin?.nama || '-')} ${r.master_equipment ? '/ ' + escapeHtml(r.master_equipment.nama) : ''}</div></div>
      <div class="detail-item"><div class="k">Shift</div><div class="v">${escapeHtml(r.shift || '-')}</div></div>
      <div class="detail-item"><div class="k">Inspector</div><div class="v">${escapeHtml(r.master_karyawan?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">Standar</div><div class="v">${escapeHtml(r.standar || '-')}</div></div>
      <div class="detail-item"><div class="k">Hasil Aktual</div><div class="v">${escapeHtml(r.hasil_aktual || '-')}</div></div>
      <div class="detail-item"><div class="k">Hasil</div><div class="v">${resultBadge(r.hasil)}</div></div>
      <div class="detail-item"><div class="k">Dibuat</div><div class="v">${formatDateTime(r.created_at)}</div></div>
    </div>
    <div class="detail-item" style="margin-bottom:12px;">
      <div class="k">Parameter</div><div class="v" style="font-weight:400;">${escapeHtml(r.parameter)}</div>
    </div>
    ${r.catatan ? `<div class="detail-item" style="margin-bottom:12px;"><div class="k">Catatan</div><div class="v" style="font-weight:400;">${escapeHtml(r.catatan)}</div></div>` : ''}
    ${r.photo_url ? `<div class="detail-item"><div class="k">Foto</div><img src="${r.photo_url}" class="detail-photo"></div>` : ''}
  `;
  openModal('detailModal');
}

document.getElementById('editReportBtn').addEventListener('click', () => {
  const r = allReports.find(x => x.id === currentDetailId);
  closeModal('detailModal');
  openForm(r);
});

document.getElementById('deleteReportBtn').addEventListener('click', async () => {
  if (!currentDetailId) return;
  if (!confirm('Hapus report QC ini? Tindakan tidak dapat dibatalkan.')) return;
  const { error } = await supabaseClient.from('qc_reports').delete().eq('id', currentDetailId);
  if (error) { toast('Gagal menghapus: ' + error.message, 'error'); return; }
  toast('Report berhasil dihapus', 'success');
  closeModal('detailModal');
  await refreshReports();
});
