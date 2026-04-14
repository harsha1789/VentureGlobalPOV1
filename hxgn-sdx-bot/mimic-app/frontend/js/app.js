/**
 * HxGN SDx Mimic Application — Frontend Logic
 */

const API = window.location.origin + '/api';
let currentUser = null;
let currentSubmittalId = null;
let currentSubmittal = null;
let selectedTodoRow = null;

// ── Helpers ──────────────────────────────────────────────────────────────

async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type || '') + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

function statusBadgeClass(status) {
  switch (status) {
    case 'Review Submittal': return 'submitted';
    case 'In Review': return 'in-review';
    case 'Bot Reviewed': return 'bot-reviewed';
    case 'Bot Rejected': return 'bot-rejected';
    case 'Complete': return 'complete';
    default: return '';
  }
}

function statusIcon(status) {
  switch (status) {
    case 'Review Submittal': return '<span class="icon-flag blue">&#9679;</span>';
    case 'In Review': return '<span class="icon-flag orange">&#9679;</span>';
    case 'Bot Reviewed': return '<span class="icon-flag green">&#10003;</span>';
    case 'Bot Rejected': return '<span class="icon-flag red">&#10006;</span>';
    case 'Complete': return '<span class="icon-flag green">&#10003;</span>';
    default: return '<span class="icon-flag gray">&#9679;</span>';
  }
}

function flagIcon(priority) {
  if (priority === '1') return '<span class="icon-flag red">&#9873;</span>';
  if (priority === '2') return '<span class="icon-flag orange">&#9873;</span>';
  return '<span class="icon-flag gray">&#9873;</span>';
}

// ── Sidebar toggle ──────────────────────────────────────────────────────

function toggleSidebarSection(header) {
  const items = header.nextElementSibling;
  if (items) {
    items.style.display = items.style.display === 'none' ? '' : 'none';
    const arrow = header.querySelector('.sidebar-arrow');
    if (arrow) {
      arrow.innerHTML = items.style.display === 'none' ? '&#9654;' : '&#9660;';
    }
  }
}

// ── Navigation ───────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('#main-content .screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id + '-screen');
  if (el) el.classList.add('active');
}

function navigateTo(screen) {
  switch (screen) {
    case 'todo':
      showScreen('todo');
      loadTodoList();
      break;
    case 'detail':
      showScreen('detail');
      break;
    case 'datasheet':
      showScreen('datasheet');
      break;
    case 'docviewer':
      showScreen('docviewer');
      break;
    case 'transmittal':
      showScreen('transmittal');
      break;
    case 'approve':
      showScreen('approve');
      break;
    case 'final':
      showScreen('final');
      break;
  }
}

// ── Bottom Panel Update ──────────────────────────────────────────────────

function updateBottomPanel(item) {
  document.getElementById('bp-name').textContent = item.documentNumber || '—';
  document.getElementById('bp-title').textContent = item.title || '—';
  document.getElementById('bp-created').textContent = item.submissionDate || item.date || '—';
  document.getElementById('bp-type').textContent = item.fileType || '—';
  document.getElementById('bp-from-org').textContent = item.fromOrganisation || '—';
  document.getElementById('bp-contract').textContent = item.contract || '—';
  document.getElementById('bp-sub-type').textContent = item.submittalType || '—';
  document.getElementById('bp-to-org').textContent = item.toOrganisation || '—';
  document.getElementById('bp-discipline').textContent = item.discipline || '—';
  document.getElementById('bp-reason').textContent = item.reasonForIssue || '—';
}

// ── LOGIN ────────────────────────────────────────────────────────────────

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  const result = await apiCall('POST', '/login', { username, password });
  if (result.error) {
    errEl.style.display = 'block';
    return;
  }

  currentUser = result;
  document.getElementById('header-username').textContent = result.displayName;
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-shell').style.display = 'block';
  navigateTo('todo');
  showToast('Logged in as ' + result.displayName, 'success');
});

function doLogout() {
  currentUser = null;
  currentSubmittalId = null;
  currentSubmittal = null;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

// ── TO DO LIST ───────────────────────────────────────────────────────────

async function loadTodoList() {
  const tbody = document.getElementById('todo-tbody');
  tbody.innerHTML = '<tr><td colspan="13" class="loading"><div class="spinner"></div> Loading...</td></tr>';

  const list = await apiCall('GET', '/todo-list');
  tbody.innerHTML = '';

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-testid', 'todo-row-' + item.id);
    tr.setAttribute('data-status', item.status);
    tr.onclick = function(e) {
      // Don't select row if clicking the claim button
      if (e.target.tagName === 'BUTTON') return;
      // Highlight selected row
      document.querySelectorAll('#todo-tbody tr').forEach(r => r.classList.remove('selected-row'));
      tr.classList.add('selected-row');
      selectedTodoRow = item;
      updateBottomPanel(item);
    };
    tr.innerHTML = `
      <td class="col-chk"><input type="checkbox" disabled></td>
      <td class="col-icon">${flagIcon(item.priority || '3')}</td>
      <td class="col-icon">${statusIcon(item.status)}</td>
      <td data-testid="todo-docnum">${item.documentNumber}</td>
      <td><span class="status-badge ${statusBadgeClass(item.status)}" data-testid="todo-status">${item.stepName || item.status}</span></td>
      <td>${item.submittalDescription || item.title || ''}</td>
      <td>${item.reasonForIssue || ''}</td>
      <td>${item.submittalType || 'Submittal'}</td>
      <td>${item.targetDate || ''}</td>
      <td>${item.date || item.submissionDate || ''}</td>
      <td>${item.submittedBy || ''}</td>
      <td>${item.priority || ''}</td>
      <td>
        ${item.status === 'Review Submittal'
          ? `<button class="btn btn-primary btn-claim" data-testid="claim-btn" onclick="claimSubmittal('${item.id}')">Claim</button>`
          : '<span style="color:#999;font-size:10px;">—</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── CLAIM ────────────────────────────────────────────────────────────────

async function claimSubmittal(id) {
  // Show claim modal
  const modal = document.getElementById('claim-modal');
  modal.style.display = 'flex';

  const result = await apiCall('POST', '/claim/' + id, { username: currentUser.username });

  // Hide modal
  modal.style.display = 'none';

  if (result.error) {
    showToast(result.error, 'error');
    return;
  }
  currentSubmittalId = id;
  showToast('Submittal claimed', 'success');
  await loadSubmittalDetail(id);
}

// ── SUBMITTAL DETAIL ─────────────────────────────────────────────────────

async function loadSubmittalDetail(id) {
  const data = await apiCall('GET', '/submittal/' + id);
  if (data.error) {
    showToast(data.error, 'error');
    return;
  }
  currentSubmittal = data;
  currentSubmittalId = id;

  document.getElementById('detail-docnum').textContent = data.documentNumber;
  document.getElementById('detail-revision').textContent = data.revision;
  document.getElementById('detail-filetype').textContent = data.fileType;
  document.getElementById('detail-originator').textContent = data.originator || data.fromOrganisation || '';
  document.getElementById('detail-date').textContent = data.submissionDate;
  document.getElementById('detail-title').textContent = data.title;
  document.getElementById('detail-discipline').textContent = data.discipline || '';
  document.getElementById('detail-contract').textContent = data.contract || 'C2 EPC - BOP';
  document.getElementById('detail-sub-type').textContent = data.submittalType || 'Submittal';
  document.getElementById('detail-to-org').textContent = data.toOrganisation || 'VGL';
  document.getElementById('detail-reason').textContent = data.reasonForIssue || 'For Review';

  const badge = document.getElementById('detail-status');
  badge.textContent = data.status;
  badge.className = 'status-badge ' + statusBadgeClass(data.status);

  navigateTo('detail');
}

// ── LOAD DATASHEET ───────────────────────────────────────────────────────

async function openDatasheet() {
  const data = await apiCall('GET', '/datasheet/' + currentSubmittalId);
  if (data.error) { showToast(data.error, 'error'); return; }

  const fieldsEl = document.getElementById('datasheet-fields');
  const validEl = document.getElementById('datasheet-validation');
  fieldsEl.innerHTML = '';
  validEl.innerHTML = '';

  // Populate spreadsheet row
  const ssBody = document.getElementById('datasheet-spreadsheet-body');
  ssBody.innerHTML = `
    <tr>
      <td>Review</td>
      <td>${data.documentNumber || ''}</td>
      <td>${data.revision || ''}</td>
      <td>${currentSubmittal ? currentSubmittal.submissionDate : ''}</td>
      <td>${data.title || ''}</td>
      <td>${data.discipline || ''}</td>
      <td>—</td>
      <td>—</td>
      <td>${currentSubmittal ? (currentSubmittal.reasonForIssue || 'For Review') : ''}</td>
      <td>${currentSubmittal && currentSubmittal.document ? currentSubmittal.document.fileName : ''}</td>
      <td>Unclassified</td>
      <td>${currentSubmittal ? (currentSubmittal.originator || '') : ''}</td>
      <td>—</td>
    </tr>
  `;

  const fields = ['documentNumber', 'title', 'revision', 'fileType', 'discipline'];
  const labels = {
    documentNumber: 'Document Number',
    title: 'Title',
    revision: 'Revision',
    fileType: 'File Type',
    discipline: 'Discipline'
  };

  fields.forEach(f => {
    const val = data[f] || '';
    fieldsEl.innerHTML += `
      <div class="detail-field">
        <span class="field-label">${labels[f]}</span>
        <span class="field-value" data-testid="ds-field-${f}">${val}</span>
      </div>
    `;

    const empty = !val.trim();
    const leadingSpace = val !== val.trimStart();
    const trailingSpace = val !== val.trimEnd();
    const pass = !empty && !leadingSpace && !trailingSpace;

    validEl.innerHTML += `
      <div class="validation-row" data-testid="ds-validation-${f}">
        <span class="validation-label">${labels[f]}</span>
        <span class="validation-status ${pass ? 'pass' : 'fail'}" data-testid="ds-validation-status-${f}">
          ${pass ? 'PASS' : 'FAIL'}
        </span>
      </div>
    `;
  });

  navigateTo('datasheet');
}

// ── DOCUMENT VIEWER ──────────────────────────────────────────────────────

async function openDocViewer() {
  const data = await apiCall('GET', '/document/' + currentSubmittalId);
  if (data.error) { showToast(data.error, 'error'); return; }

  document.getElementById('docviewer-filename').textContent = data.fileName;
  document.getElementById('docviewer-rev').textContent = currentSubmittal ? currentSubmittal.revision : '—';

  const checksEl = document.getElementById('integrity-checks');
  checksEl.innerHTML = '';

  const basicChecks = [
    { label: 'File format valid (PDF)', pass: data.fileFormat === 'PDF' },
    { label: 'File not corrupted', pass: !data.corrupted },
    { label: 'File size within limit (< 50 MB)', pass: data.fileSizeKB < 51200 }
  ];

  basicChecks.forEach((c, i) => {
    checksEl.innerHTML += `
      <div class="validation-row" data-testid="integrity-check-${i}">
        <span class="validation-label">${c.label}</span>
        <span class="validation-status ${c.pass ? 'pass' : 'fail'}" data-testid="integrity-status-${i}">
          ${c.pass ? 'PASS' : 'FAIL'}
        </span>
      </div>
    `;
  });

  navigateTo('docviewer');
}

// ── CREATE TRANSMITTAL ───────────────────────────────────────────────────

function openTransmittal() {
  document.getElementById('trans-number').textContent = '(Auto-generated)';
  document.getElementById('trans-date').textContent = new Date().toISOString().split('T')[0];
  document.getElementById('trans-docref').value = currentSubmittal.documentNumber;
  document.getElementById('transmittal-success').style.display = 'none';
  document.getElementById('generate-transmittal-btn').disabled = false;
  navigateTo('transmittal');
}

async function generateTransmittal() {
  const result = await apiCall('POST', '/transmittal/create', { submittalId: currentSubmittalId });
  if (result.error) { showToast(result.error, 'error'); return; }

  document.getElementById('trans-number').textContent = result.transmittalNumber;
  document.getElementById('trans-date').textContent = result.date;
  document.getElementById('transmittal-success').style.display = 'block';
  document.getElementById('generate-transmittal-btn').disabled = true;
  showToast('Transmittal generated: ' + result.transmittalNumber, 'success');
}

// ── APPROVE ──────────────────────────────────────────────────────────────

function openApproval() {
  document.getElementById('approve-revision').value = currentSubmittal.revision || '';
  document.getElementById('approve-docnum').textContent = currentSubmittal.documentNumber || '';
  document.getElementById('approve-success').style.display = 'none';
  navigateTo('approve');
}

async function doApprove() {
  const rev = document.getElementById('approve-revision').value.trim();
  if (!rev) { showToast('Revision number is required', 'error'); return; }

  const result = await apiCall('POST', '/submittal/approve', {
    submittalId: currentSubmittalId,
    revisionNumber: rev
  });
  if (result.error) { showToast(result.error, 'error'); return; }

  document.getElementById('approve-success').style.display = 'block';
  showToast('Submittal approved', 'success');

  // Enable navigation to final screen
  setTimeout(() => openFinalScreen(), 1000);
}

// ── FINAL STATUS ─────────────────────────────────────────────────────────

function openFinalScreen() {
  document.getElementById('final-docnum').textContent = currentSubmittal.documentNumber;
  document.getElementById('final-success').style.display = 'none';
  navigateTo('final');
}

async function setBotReviewed() {
  const result = await apiCall('POST', '/submittal/bot-reviewed', { submittalId: currentSubmittalId });
  if (result.error) { showToast(result.error, 'error'); return; }

  document.getElementById('final-success').style.display = 'block';
  showToast('Status set to Bot Reviewed', 'success');
}
