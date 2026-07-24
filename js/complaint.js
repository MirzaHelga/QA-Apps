/* =========================================================
   COMPLAINT PAGE LOGIC
   Dibungkus IIFE supaya variabel/fungsinya tidak bentrok dengan
   controller halaman lain di sesi SPA yang sama.
========================================================= */
(function () {

let allComplaints = [];
let newPhotoFiles = [];       // File baru yang dipilih, belum diupload
let existingPhotoUrls = [];   // URL foto yang sudah tersimpan (saat edit)
let currentDetailId = null;

window.PageControllers = window.PageControllers || {};
window.PageControllers.complaint = async function initComplaintPage() {
  const session = await requireAuth();
  if (!session) return;
  if (await blockOperator()) return;

  newPhotoFiles = [];
  existingPhotoUrls = [];
  currentDetailId = null;

  wireForm();
  wireFilters();
  wireStaticButtons();
  await refreshComplaints();

  document.getElementById('newComplaintBtn').addEventListener('click', () => openForm(null));
  document.getElementById('exportExcelBtn').addEventListener('click', exportComplaints);
};

function wireStaticButtons() {
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
}

function wireFilters() {
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('filterStatus').addEventListener('change', renderTable);
  document.getElementById('filterSeverity').addEventListener('change', renderTable);
  document.getElementById('filterSumber').addEventListener('change', renderTable);
}

async function refreshComplaints() {
  const { data, error } = await supabaseClient
    .from('complaints')
    .select('*')
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
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
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
      <td>${escapeHtml(c.produk_nama || '-')}${c.kode_batch ? '<br><span style="color:#8a9793; font-size:11.5px;">Batch: ' + escapeHtml(c.kode_batch) + '</span>' : ''}</td>
      <td>${escapeHtml(c.pelapor_nama || '-')}${c.pelapor_asal ? '<br><span style="color:#8a9793; font-size:11.5px;">' + escapeHtml(c.pelapor_asal) + '</span>' : ''}</td>
      <td>${escapeHtml(c.sumber_complaint || '-')}</td>
      <td>${escapeHtml(c.kategori || '-')}</td>
      <td>${severityBadge(c.severity)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${(c.photo_urls && c.photo_urls.length) ? `
        <div class="thumb-wrap">
          <img src="${c.photo_urls[0]}" class="thumb-btn" onclick="event.stopPropagation(); window.open('${c.photo_urls[0]}','_blank')">
          ${c.photo_urls.length > 1 ? `<span class="thumb-count">+${c.photo_urls.length - 1}</span>` : ''}
        </div>
      ` : `<div class="thumb-empty">–</div>`}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="ComplaintPage.viewDetail('${c.id}')">Detail</button></td>
    </tr>
  `).join('');
}

function getFilteredComplaints() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fStatus = document.getElementById('filterStatus').value;
  const fSeverity = document.getElementById('filterSeverity').value;
  const fSumber = document.getElementById('filterSumber').value;

  return allComplaints.filter(c => {
    if (fStatus && c.status !== fStatus) return false;
    if (fSeverity && c.severity !== fSeverity) return false;
    if (fSumber && c.sumber_complaint !== fSumber) return false;
    if (q) {
      const hay = `${c.complaint_no} ${c.produk_nama} ${c.pelapor_nama} ${c.deskripsi}`.toLowerCase();
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
    'Sumber Complaint': c.sumber_complaint || '-',
    'Nama Produk': c.produk_nama || '-',
    'Kode Batch': c.kode_batch || '-',
    'Tgl Produksi': c.tanggal_produksi ? formatDate(c.tanggal_produksi) : '-',
    'Tgl Kadaluarsa': c.tanggal_kadaluarsa ? formatDate(c.tanggal_kadaluarsa) : '-',
    'Nama Pelapor': c.pelapor_nama || '-',
    'Kontak Pelapor': c.pelapor_kontak || '-',
    'Asal Pelapor': c.pelapor_asal || '-',
    'Kategori': c.kategori || '-',
    'Severity': c.severity,
    'Status': c.status,
    'Deskripsi Keluhan': c.deskripsi,
    'Tindakan Perbaikan': c.tindakan_perbaikan || '-',
    'Foto': (c.photo_urls && c.photo_urls.length) ? `${c.photo_urls.length} foto` : '-',
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
    const files = Array.from(photoInput.files || []);
    photoInput.value = ''; // biar bisa pilih file yang sama lagi kalau perlu
    if (!files.length) return;

    const tooBig = files.filter(f => f.size > 5 * 1024 * 1024);
    if (tooBig.length) toast(`${tooBig.length} foto dilewati karena lebih dari 5MB`, 'error');

    const ok = files.filter(f => f.size <= 5 * 1024 * 1024);
    newPhotoFiles.push(...ok);
    renderPhotoPreview();
  });

  document.getElementById('saveComplaintBtn').addEventListener('click', saveComplaint);
}

function renderPhotoPreview() {
  const wrap = document.getElementById('photoPreviewWrap');
  const existingTiles = existingPhotoUrls.map((url, i) => `
    <div class="photo-preview">
      <img src="${url}">
      <button type="button" class="rm" onclick="ComplaintPage.removePhoto('existing', ${i})">&times;</button>
    </div>
  `).join('');
  const newTiles = newPhotoFiles.map((file, i) => `
    <div class="photo-preview">
      <img src="${URL.createObjectURL(file)}">
      <button type="button" class="rm" onclick="ComplaintPage.removePhoto('new', ${i})">&times;</button>
    </div>
  `).join('');
  wrap.innerHTML = existingTiles + newTiles;
}

function removePhoto(type, idx) {
  if (type === 'existing') existingPhotoUrls.splice(idx, 1);
  else newPhotoFiles.splice(idx, 1);
  renderPhotoPreview();
}

function openForm(complaint) {
  document.getElementById('complaintForm').reset();
  newPhotoFiles = [];
  existingPhotoUrls = [];
  document.getElementById('photoPreviewWrap').innerHTML = '';

  document.querySelectorAll('#severityChips .radio-chip').forEach(c => c.classList.remove('sel-low', 'sel-med', 'sel-high', 'sel-critical'));
  document.querySelector('#severityChips .radio-chip[data-val="Medium"]').classList.add('sel-med');

  if (complaint) {
    document.getElementById('formModalTitle').textContent = 'Edit Complaint';
    document.getElementById('complaintId').value = complaint.id;
    document.getElementById('fTanggal').value = complaint.tanggal;
    document.getElementById('fSumber').value = complaint.sumber_complaint || '';
    document.getElementById('fProdukNama').value = complaint.produk_nama || '';
    document.getElementById('fKodeBatch').value = complaint.kode_batch || '';
    document.getElementById('fTglProduksi').value = complaint.tanggal_produksi || '';
    document.getElementById('fTglKadaluarsa').value = complaint.tanggal_kadaluarsa || '';
    document.getElementById('fPelaporNama').value = complaint.pelapor_nama || '';
    document.getElementById('fPelaporKontak').value = complaint.pelapor_kontak || '';
    document.getElementById('fPelaporAsal').value = complaint.pelapor_asal || '';
    document.getElementById('fKategori').value = complaint.kategori || '';
    document.getElementById('fStatus').value = complaint.status || 'Open';
    document.getElementById('fDeskripsi').value = complaint.deskripsi || '';
    document.getElementById('fTindakan').value = complaint.tindakan_perbaikan || '';
    document.querySelectorAll('#severityChips .radio-chip').forEach(c => c.classList.remove('sel-low', 'sel-med', 'sel-high', 'sel-critical'));
    const chip = document.querySelector(`#severityChips .radio-chip[data-val="${complaint.severity}"]`);
    if (chip) { chip.querySelector('input').checked = true; chip.classList.add(complaint.severity === 'Low' ? 'sel-low' : complaint.severity === 'Medium' ? 'sel-med' : complaint.severity === 'High' ? 'sel-high' : 'sel-critical'); }
    if (complaint.photo_urls && complaint.photo_urls.length) {
      existingPhotoUrls = [...complaint.photo_urls];
      renderPhotoPreview();
    }
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
  const sumber = document.getElementById('fSumber').value;
  const produkNama = document.getElementById('fProdukNama').value.trim();
  const pelaporNama = document.getElementById('fPelaporNama').value.trim();
  const deskripsi = document.getElementById('fDeskripsi').value.trim();
  const severityInput = document.querySelector('#severityChips input:checked');

  if (!tanggal || !sumber || !produkNama || !pelaporNama || !deskripsi || !severityInput) {
    toast('Lengkapi field wajib (bertanda *)', 'error');
    return;
  }

  const btn = document.getElementById('saveComplaintBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const uploadedUrls = [];
    for (const file of newPhotoFiles) {
      uploadedUrls.push(await uploadPhoto(file, 'complaints'));
    }
    const photoUrls = [...existingPhotoUrls, ...uploadedUrls];

    const payload = {
      tanggal,
      sumber_complaint: sumber,
      produk_nama: produkNama,
      kode_batch: document.getElementById('fKodeBatch').value.trim() || null,
      tanggal_produksi: document.getElementById('fTglProduksi').value || null,
      tanggal_kadaluarsa: document.getElementById('fTglKadaluarsa').value || null,
      pelapor_nama: pelaporNama,
      pelapor_kontak: document.getElementById('fPelaporKontak').value.trim() || null,
      pelapor_asal: document.getElementById('fPelaporAsal').value.trim() || null,
      kategori: document.getElementById('fKategori').value || null,
      severity: severityInput.value,
      deskripsi,
      tindakan_perbaikan: document.getElementById('fTindakan').value || null,
      status: document.getElementById('fStatus').value,
      photo_urls: photoUrls,
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
      <div class="detail-item"><div class="k">Sumber Complaint</div><div class="v">${escapeHtml(c.sumber_complaint || '-')}</div></div>
      <div class="detail-item"><div class="k">Nama Produk</div><div class="v">${escapeHtml(c.produk_nama || '-')}</div></div>
      <div class="detail-item"><div class="k">Kode Batch</div><div class="v">${escapeHtml(c.kode_batch || '-')}</div></div>
      <div class="detail-item"><div class="k">Tgl Produksi</div><div class="v">${c.tanggal_produksi ? formatDate(c.tanggal_produksi) : '-'}</div></div>
      <div class="detail-item"><div class="k">Tgl Kadaluarsa</div><div class="v">${c.tanggal_kadaluarsa ? formatDate(c.tanggal_kadaluarsa) : '-'}</div></div>
      <div class="detail-item"><div class="k">Nama Pelapor</div><div class="v">${escapeHtml(c.pelapor_nama || '-')}</div></div>
      <div class="detail-item"><div class="k">Kontak Pelapor</div><div class="v">${escapeHtml(c.pelapor_kontak || '-')}</div></div>
      <div class="detail-item"><div class="k">Asal Pelapor</div><div class="v">${escapeHtml(c.pelapor_asal || '-')}</div></div>
      <div class="detail-item"><div class="k">Kategori</div><div class="v">${escapeHtml(c.kategori || '-')}</div></div>
      <div class="detail-item"><div class="k">Severity</div><div class="v">${severityBadge(c.severity)}</div></div>
      <div class="detail-item"><div class="k">Status</div><div class="v">${statusBadge(c.status)}</div></div>
      <div class="detail-item"><div class="k">Dibuat</div><div class="v">${formatDateTime(c.created_at)}</div></div>
    </div>
    <div class="detail-item" style="margin-bottom:12px;">
      <div class="k">Deskripsi</div><div class="v" style="font-weight:400;">${escapeHtml(c.deskripsi)}</div>
    </div>
    ${c.tindakan_perbaikan ? `<div class="detail-item" style="margin-bottom:12px;"><div class="k">Tindakan Perbaikan</div><div class="v" style="font-weight:400;">${escapeHtml(c.tindakan_perbaikan)}</div></div>` : ''}
    ${(c.photo_urls && c.photo_urls.length) ? `
      <div class="detail-item">
        <div class="k">Foto (${c.photo_urls.length})</div>
        <div class="detail-photo-grid">
          ${c.photo_urls.map(url => `<img src="${url}" onclick="window.open('${url}','_blank')">`).join('')}
        </div>
      </div>
    ` : ''}
  `;
  openModal('detailModal');
}

window.ComplaintPage = { viewDetail, removePhoto };

})();
