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

window.PageControllers = window.PageControllers || {};
window.PageControllers.verifikasi = async function initVerifikasiPage() {
  const session = await requireAuth();
  if (!session) return;

  activeTab = 'After CIP';
  currentDetailId = null;

  master = await loadMasterData();
  populateKaryawanSelects();
  wireTabs();
  wireFilters();
  wireForm();
  wireStaticButtons();
  await refreshVq();

  document.getElementById('newVqBtn').addEventListener('click', () => openForm(null));
  document.getElementById('exportExcelBtn').addEventListener('click', exportVq);
};

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
}

function populateKaryawanSelects() {
  const opts = '<option value="">-- Pilih Karyawan --</option>' +
    master.karyawan.map(k => `<option value="${k.id}">${escapeHtml(k.nama)} (${escapeHtml(k.nik)})</option>`).join('');
  document.getElementById('fFlm').innerHTML = opts;
  document.getElementById('fQa').innerHTML = opts;
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
    .select('*, flm:flm_id(nama), qa:qa_id(nama)')
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

function getFilteredVq() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fShift = document.getElementById('filterShift').value;
  const fStatus = document.getElementById('filterStatus').value;

  return allVq.filter(r => {
    if (r.tipe !== activeTab) return false;
    if (fShift && r.shift !== fShift) return false;
    if (fStatus && vqStatus(r) !== fStatus) return false;
    if (q) {
      const hay = `${r.no} ${r.line || ''} ${r.flm?.nama || ''} ${r.qa?.nama || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTable() {
  const filtered = getFilteredVq();
  const tbody = document.querySelector('#vqTable tbody');

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
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

  body.innerHTML = items.map((it, idx) => {
    const existing = existingItems && existingItems[idx];
    const hasil = existing ? (existing.hasil || '') : '';
    const status = existing ? (existing.status || 'Sesuai') : 'Sesuai';
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
}

function openForm(record) {
  document.getElementById('vqForm').reset();
  document.getElementById('vqId').value = '';

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
    document.getElementById('fFlm').value = record.flm_id || '';
    document.getElementById('fQa').value = record.qa_id || '';
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
    const payload = {
      tipe,
      tanggal,
      shift: document.getElementById('fShift').value || null,
      line: document.getElementById('fLine').value.trim() || null,
      per_line: document.getElementById('fPerLine').checked,
      items: collectChecklistItems(tipe),
      flm_id: document.getElementById('fFlm').value || null,
      qa_id: document.getElementById('fQa').value || null,
      catatan: document.getElementById('fCatatan').value.trim() || null,
    };

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
    return `
    <tr>
      <td class="no-col">${idx + 1}</td>
      <td>${escapeHtml(it.pengecekan)}</td>
      <td class="std-col">${escapeHtml(it.standard)}</td>
      <td>${escapeHtml(it.hasil || '-')}</td>
      <td><span class="badge ${isNok ? 'badge-no' : 'badge-ok'}">${isNok ? 'NOK' : 'OK'}</span></td>
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
      <div class="detail-item"><div class="k">FLM</div><div class="v">${escapeHtml(r.flm?.nama || '-')}</div></div>
      <div class="detail-item"><div class="k">QA</div><div class="v">${escapeHtml(r.qa?.nama || '-')}</div></div>
    </div>
    ${r.catatan ? `<div class="detail-item" style="margin-bottom:12px;"><div class="k">Catatan</div><div class="v" style="font-weight:400;">${escapeHtml(r.catatan)}</div></div>` : ''}
    <div class="section-title" style="margin-top:6px;">Checklist Pengecekan</div>
    <div class="check-table-wrap">
      <table class="check-table">
        <thead>
          <tr><th class="no-col">No</th><th>Pengecekan</th><th class="std-col">Standard</th><th>Hasil Pengecekan</th><th class="status-col">Status</th></tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>
  `;
  openModal('detailModal');
}

window.VerifikasiPage = { viewDetail };

})();
