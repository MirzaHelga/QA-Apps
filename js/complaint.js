/* =========================================================
   COMPLAINT PAGE LOGIC
========================================================= */

let master = null;
let allComplaints = [];
let selectedPhotoFile = null;
let currentDetailId = null;

(async function init() {
  const session = await requireAuth();
  if (!session) return;

  renderShell({ active: 'complaint', title: 'Complaint', breadcrumb: 'Quality Assurance System / Complaint' });

  master = await loadMasterData();
  populateFilters();
  wireForm();
  wireFilters();
  await refreshComplaints();

  document.getElementById('newComplaintBtn').addEventListener('click', () => openForm(null));
  document.getElementById('exportExcelBtn').addEventListener('click', exportComplaints);
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
  document.getElementById('filterStatus').addEventListener('change', renderTable);
  document.getElementById('filterSeverity').addEventListener('change', renderTable);
  document.getElementById('filterArea').addEventListener('change', renderTable);
}

async function refreshComplaints() {
  const { data, error } = await supabaseClient
    .from('complaints')
    .select('*, master_area(nama), master_mesin(nama), master_equipment(nama), master_karyawan(nama)')
    .order('created_at', { ascending: false });
  if (error) { toast('Gagal memuat data: ' + error.message, 'error'); return; }
  allComplaints = data || [];
  renderTable();
}

function statusBadge(status) {
  const map = { 'Open': 'badge-open', 'In Progress': 'badge-progress', 'Closed': 'badge-closed', 'Rejected': 'badge-rejected' };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}
function severityBadge(sev) {
  const map = { 'Low': 'badge-low', 'Medium': 'badge-medium', 'High': 'badge-high', 'Critical': 'badge-critical' };
  return `<span class="badge ${map[sev] || ''}">${sev}</span>`;
}

function renderTable() {
  const filtered = getFilteredComplaints();

  const tbody = document.querySelector('#complaintTable tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
      <div class="t">Belum ada complaint</div>
      <div class="s">Klik "Complaint Baru" untuk menambahkan data</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td><strong>${escapeHtml(c.complaint_no)}</strong></td>
      <td>${formatDate(c.tanggal)}</td>
      <td>${escapeHtml(c.master_area?.nama || '-')}${c.master_mesin ? ' / ' + escapeHtml(c.master_mesin.nama) : ''}</td>
      <td>${escapeHtml(c.kategori || '-')}</td>
      <td>${severityBadge(c.severity)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.photo_url ? `<img src="${c.photo_url}" class="thumb-btn" onclick="event.stopPropagation(); window.open('${c.photo_url}','_blank')">` : `<div class="thumb-empty">–</div>`}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewDetail('${c.id}')">Detail</button></td>
    </tr>
  `).join('');
}

function getFilteredComplaints() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fStatus = document.getElementById('filterStatus').value;
  const fSeverity = document.getElementById('filterSeverity').value;
  const fArea = document.getElementById('filterArea').value;

  return allComplaints.filter(c => {
    if (fStatus && c.status !== fStatus) return false;
    if (fSeverity && c.severity !== fSeverity) return false;
    if (fArea && c.area_id !== fArea) return false;
    if (q) {
      const hay = `${c.complaint_no} ${c.deskripsi}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function exportComplaints() {
  const filtered = getFilteredComplaints();

  const rows = filtered.map(c => ({
    'No. Complaint': c.complaint_no,
    'Tanggal': formatDate(c.tanggal),
    'Shift': c.shift || '-',
    'Area': c.master_area?.nama || '-',
    'Mesin': c.master_mesin?.nama || '-',
    'Equipment': c.master_equipment?.nama || '-',
    'Kategori': c.kategori || '-',
    'Severity': c.severity,
    'Status': c.status,
    'Pelapor': c.master_karyawan?.nama || '-',
    'Deskripsi Keluhan': c.deskripsi,
    'Tindakan Perbaikan': c.tindakan_perbaikan || '-',
    'Foto': c.photo_url || '-',
  }));

  exportToExcel(rows, `Complaint_${todayISO()}.xlsx`, 'Complaint');
}

/* ---------------- FORM (Create / Edit) ---------------- */

function wireForm() {
  document.querySelectorAll('#severityChips .radio-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#severityChips .radio-chip').forEach(c => c.classList.remove('sel-low', 'sel-med', 'sel-high', 'sel-critical'));
      const val = chip.dataset.val;
      chip.classList.add(val === 'Low' ? 'sel-low' : val === 'Medium' ? 'sel-med' : val === 'High' ? 'sel-high' : 'sel-critical');
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

  document.getElementById('saveComplaintBtn').addEventListener('click', saveComplaint);
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

function openForm(complaint) {
  document.getElementById('complaintForm').reset();
  document.getElementById('photoPreviewWrap').innerHTML = '';
  selectedPhotoFile = null;
  document.getElementById('fMesin').innerHTML = '<option value="">-- Pilih Mesin --</option>';
  document.getElementById('fEquipment').innerHTML = '<option value="">-- Pilih Equipment (opsional) --</option>';

  document.querySelectorAll('#severityChips .radio-chip').forEach(c => c.classList.remove('sel-low', 'sel-med', 'sel-high', 'sel-critical'));
  document.querySelector('#severityChips .radio-chip[data-val="Medium"]').classList.add('sel-med');

  if (complaint) {
    document.getElementById('formModalTitle').textContent = 'Edit Complaint';
    document.getElementById('complaintId').value = complaint.id;
    document.getElementById('fTanggal').value = complaint.tanggal;
    document.getElementById('fShift').value = complaint.shift || '';
    document.getElementById('fArea').value = complaint.area_id || '';
    document.getElementById('fArea').dispatchEvent(new Event('change'));
    setTimeout(() => {
      document.getElementById('fMesin').value = complaint.mesin_id || '';
      document.getElementById('fMesin').dispatchEvent(new Event('change'));
      setTimeout(() => { document.getElementById('fEquipment').value = complaint.equipment_id || ''; }, 30);
    }, 30);
    document.getElementById('fKaryawan').value = complaint.pelapor_id || '';
    document.getElementById('fKategori').value = complaint.kategori || '';
    document.getElementById('fStatus').value = complaint.status || 'Open';
    document.getElementById('fDeskripsi').value = complaint.deskripsi || '';
    document.getElementById('fTindakan').value = complaint.tindakan_perbaikan || '';
    document.querySelectorAll('#severityChips .radio-chip').forEach(c => c.classList.remove('sel-low', 'sel-med', 'sel-high', 'sel-critical'));
    const chip = document.querySelector(`#severityChips .radio-chip[data-val="${complaint.severity}"]`);
    if (chip) { chip.querySelector('input').checked = true; chip.classList.add(complaint.severity === 'Low' ? 'sel-low' : complaint.severity === 'Medium' ? 'sel-med' : complaint.severity === 'High' ? 'sel-high' : 'sel-critical'); }
    if (complaint.photo_url) renderPhotoPreview(complaint.photo_url);
  } else {
    document.getElementById('formModalTitle').textContent = 'Complaint Baru';
    document.getElementById('complaintId').value = '';
    document.getElementById('fTanggal').value = todayISO();
    document.getElementById('fStatus').value = 'Open';
  }

  openModal('formModal');
}

async function saveComplaint() {
  const id = document.getElementById('complaintId').value;
  const tanggal = document.getElementById('fTanggal').value;
  const areaId = document.getElementById('fArea').value;
  const deskripsi = document.getElementById('fDeskripsi').value.trim();
  const severityInput = document.querySelector('#severityChips input:checked');

  if (!tanggal || !areaId || !deskripsi || !severityInput) {
    toast('Lengkapi field wajib (bertanda *)', 'error');
    return;
  }

  const btn = document.getElementById('saveComplaintBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    let photoUrl = null;
    const existingPreviewImg = document.querySelector('#photoPreviewWrap img');
    if (selectedPhotoFile) {
      photoUrl = await uploadPhoto(selectedPhotoFile, 'complaints');
    } else if (existingPreviewImg) {
      photoUrl = existingPreviewImg.src;
    }

    const payload = {
      tanggal,
      shift: document.getElementById('fShift').value || null,
      area_id: areaId,
      mesin_id: document.getElementById('fMesin').value || null,
      equipment_id: document.getElementById('fEquipment').value || null,
      pelapor_id: document.getElementById('fKaryawan').value || null,
      kategori: document.getElementById('fKategori').value || null,
      severity: severityInput.value,
      deskripsi,
      tindakan_perbaikan: document.getElementById('fTindakan').value || null,
      status: document.getElementById('fStatus').value,
      photo_url: photoUrl,
    };

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('complaints').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('complaints').insert(payload));
    }
    if (error) throw error;

    toast(id ? 'Complaint berhasil diperbarui' : 'Complaint berhasil disimpan', 'success');
    closeModal('formModal');
    await refreshComplaints();
  } catch (e) {
    toast('Gagal menyimpan: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Simpan Complaint';
  }
}

/* ---------------- DETAIL ---------------- */

function viewDetail(id) {
  const c = allComplaints.find(x => x.id === id);
  if (!c) return;
  currentDetailId = id;

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="k">No. Complaint</div><div class="v">${escapeHtml(c.complaint_no)}</div></div>
      <div class="detail-item"><div class="k">Tanggal</div><div class="v">${formatDate(c.tanggal)}</div></div>
      <div class="detail-item"><div class="k">Area</div><div class="v">${escapeHtml(c.master_area?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">Mesin / Equipment</div><div class="v">${escapeHtml(c.master_mesin?.nama || '-')} ${c.master_equipment ? '/ ' + escapeHtml(c.master_equipment.nama) : ''}</div></div>
      <div class="detail-item"><div class="k">Shift</div><div class="v">${escapeHtml(c.shift || '-')}</div></div>
      <div class="detail-item"><div class="k">Pelapor</div><div class="v">${escapeHtml(c.master_karyawan?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">Kategori</div><div class="v">${escapeHtml(c.kategori || '-')}</div></div>
      <div class="detail-item"><div class="k">Severity</div><div class="v">${severityBadge(c.severity)}</div></div>
      <div class="detail-item"><div class="k">Status</div><div class="v">${statusBadge(c.status)}</div></div>
      <div class="detail-item"><div class="k">Dibuat</div><div class="v">${formatDateTime(c.created_at)}</div></div>
    </div>
    <div class="detail-item" style="margin-bottom:12px;">
      <div class="k">Deskripsi</div><div class="v" style="font-weight:400;">${escapeHtml(c.deskripsi)}</div>
    </div>
    ${c.tindakan_perbaikan ? `<div class="detail-item" style="margin-bottom:12px;"><div class="k">Tindakan Perbaikan</div><div class="v" style="font-weight:400;">${escapeHtml(c.tindakan_perbaikan)}</div></div>` : ''}
    ${c.photo_url ? `<div class="detail-item"><div class="k">Foto</div><img src="${c.photo_url}" class="detail-photo"></div>` : ''}
  `;
  openModal('detailModal');
}

document.getElementById('editComplaintBtn').addEventListener('click', () => {
  const c = allComplaints.find(x => x.id === currentDetailId);
  closeModal('detailModal');
  openForm(c);
});

document.getElementById('deleteComplaintBtn').addEventListener('click', async () => {
  if (!currentDetailId) return;
  if (!confirm('Hapus complaint ini? Tindakan tidak dapat dibatalkan.')) return;
  const { error } = await supabaseClient.from('complaints').delete().eq('id', currentDetailId);
  if (error) { toast('Gagal menghapus: ' + error.message, 'error'); return; }
  toast('Complaint berhasil dihapus', 'success');
  closeModal('detailModal');
  await refreshComplaints();
});
