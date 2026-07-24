/* =========================================================
   DASHBOARD LOGIC
   Dibungkus IIFE supaya variabel/fungsinya tidak bentrok dengan
   controller halaman lain di sesi SPA yang sama.
========================================================= */
(function () {

const TEAL = '#0f766e';
const TEAL_LIGHT = '#1cb5a6';
const AMBER = '#c8801a';
const RED = '#d64545';
const GREEN = '#1a9c6b';
const GREY = '#a9bab7';

window.PageControllers = window.PageControllers || {};
window.PageControllers.dashboard = async function initDashboardPage() {
  const session = await requireAuth();
  if (!session) return;

  await loadDashboard();
};

async function loadDashboard() {
  const [complaintsRes, qcRes, areasRes] = await Promise.all([
    supabaseClient.from('complaints').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('qc_reports').select('*, master_area(nama)').order('created_at', { ascending: false }),
    supabaseClient.from('master_area').select('*'),
  ]);

  const complaints = complaintsRes.data || [];
  const qcReports = qcRes.data || [];
  const areas = areasRes.data || [];

  if (complaintsRes.error) console.error(complaintsRes.error);
  if (qcRes.error) console.error(qcRes.error);

  renderStats(complaints, qcReports);
  renderTrendChart(complaints, qcReports);
  renderStatusChart(complaints);
  renderSumberChart(complaints);
  renderQcResultChart(qcReports);
  renderRecentComplaints(complaints.slice(0, 6));
  renderRecentQc(qcReports.slice(0, 6));
}

function renderStats(complaints, qcReports) {
  document.getElementById('statTotalComplaint').textContent = complaints.length;
  const open = complaints.filter(c => c.status === 'Open' || c.status === 'In Progress').length;
  document.getElementById('statOpenComplaint').textContent = open;
  document.getElementById('statTotalQc').textContent = qcReports.length;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recentQc = qcReports.filter(q => new Date(q.created_at) >= cutoff);
  const pass = recentQc.filter(q => q.hasil === 'Pass').length;
  const rate = recentQc.length ? Math.round((pass / recentQc.length) * 100) : 0;
  document.getElementById('statPassRate').textContent = recentQc.length ? `${rate}%` : '-';

  document.getElementById('statComplaintDelta').textContent = complaints.length ? `${open} masih terbuka` : 'Belum ada data';
  document.getElementById('statOpenDelta').textContent = open > 0 ? 'Perlu tindak lanjut' : 'Semua tertangani';
  document.getElementById('statOpenDelta').className = 'stat-delta ' + (open > 0 ? 'down' : 'up');
  document.getElementById('statQcDelta').textContent = qcReports.length ? 'Total inspeksi tercatat' : 'Belum ada data';
  document.getElementById('statPassDelta').textContent = recentQc.length ? `${recentQc.length} inspeksi` : 'Belum ada inspeksi';
  document.getElementById('statPassDelta').className = 'stat-delta ' + (rate >= 80 ? 'up' : 'down');
}

function last14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function renderTrendChart(complaints, qcReports) {
  const days = last14Days();
  const complaintCounts = days.map(d => complaints.filter(c => c.tanggal === d).length);
  const qcCounts = days.map(d => qcReports.filter(q => q.tanggal === d).length);
  const labels = days.map(d => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));

  new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Complaint', data: complaintCounts, borderColor: RED, backgroundColor: 'rgba(214,69,69,.08)', tension: .35, fill: true, pointRadius: 2 },
        { label: 'Report QC', data: qcCounts, borderColor: TEAL, backgroundColor: 'rgba(15,118,110,.1)', tension: .35, fill: true, pointRadius: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
    },
  });
}

function renderStatusChart(complaints) {
  const statuses = ['Open', 'In Progress', 'Closed', 'Rejected'];
  const colors = [AMBER, TEAL_LIGHT, GREEN, RED];
  const counts = statuses.map(s => complaints.filter(c => c.status === s).length);

  new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: { labels: statuses, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: { legend: { display: false } },
    },
  });

  const legend = document.getElementById('statusLegend');
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  legend.innerHTML = statuses.map((s, i) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${s}</span>
      <span class="val">${counts[i]} (${Math.round(counts[i] / total * 100)}%)</span>
    </div>
  `).join('');
}

function renderSumberChart(complaints) {
  const sources = ['Email', 'Telepon', 'WhatsApp', 'Lainnya'];
  const counts = sources.map(s => complaints.filter(c => c.sumber_complaint === s).length);

  new Chart(document.getElementById('areaChart'), {
    type: 'bar',
    data: {
      labels: sources,
      datasets: [{ label: 'Complaint', data: counts, backgroundColor: TEAL_LIGHT, borderRadius: 6, maxBarThickness: 28 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { font: { size: 10.5 } } } },
    },
  });
}

function renderQcResultChart(qcReports) {
  const pass = qcReports.filter(q => q.hasil === 'Pass').length;
  const fail = qcReports.filter(q => q.hasil === 'Fail').length;

  new Chart(document.getElementById('qcResultChart'), {
    type: 'doughnut',
    data: { labels: ['Pass', 'Fail'], datasets: [{ data: [pass, fail], backgroundColor: [GREEN, RED], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
  });

  const total = pass + fail || 1;
  document.getElementById('qcLegend').innerHTML = `
    <div class="legend-row"><span class="legend-dot" style="background:${GREEN}"></span><span>Pass</span><span class="val">${pass} (${Math.round(pass / total * 100)}%)</span></div>
    <div class="legend-row"><span class="legend-dot" style="background:${RED}"></span><span>Fail</span><span class="val">${fail} (${Math.round(fail / total * 100)}%)</span></div>
  `;
}

function statusBadge(status) {
  const map = { 'Open': 'badge-open', 'In Progress': 'badge-progress', 'Closed': 'badge-closed', 'Rejected': 'badge-rejected' };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}
function severityBadge(sev) {
  const map = { 'Low': 'badge-low', 'Medium': 'badge-medium', 'High': 'badge-high', 'Critical': 'badge-critical' };
  return `<span class="badge ${map[sev] || ''}">${sev}</span>`;
}
function resultBadge(r) {
  return `<span class="badge ${r === 'Pass' ? 'badge-pass' : 'badge-fail'}">${r}</span>`;
}

function renderRecentComplaints(list) {
  const tbody = document.querySelector('#recentComplaintTable tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="t">Belum ada complaint</div><div class="s">Data akan muncul di sini</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${escapeHtml(c.complaint_no)}</td>
      <td>${formatDate(c.tanggal)}</td>
      <td>${escapeHtml(c.produk_nama || '-')}</td>
      <td>${severityBadge(c.severity)}</td>
      <td>${statusBadge(c.status)}</td>
    </tr>
  `).join('');
}

function renderRecentQc(list) {
  const tbody = document.querySelector('#recentQcTable tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="t">Belum ada report QC</div><div class="s">Data akan muncul di sini</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(q => `
    <tr>
      <td>${escapeHtml(q.report_no)}</td>
      <td>${formatDate(q.tanggal)}</td>
      <td>${escapeHtml(q.master_area?.nama || '-')}</td>
      <td>${escapeHtml(q.parameter)}</td>
      <td>${resultBadge(q.hasil)}</td>
    </tr>
  `).join('');
}

})();
