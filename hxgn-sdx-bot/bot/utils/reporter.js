/**
 * HTML Report Generator for bot execution results.
 */

const fs = require('fs');
const path = require('path');

function generateReport(results, meta) {
  const { botUser, documentNumber, startTime, endTime, screenshots, allDocResults } = meta;

  const duration = ((new Date(endTime) - new Date(startTime)) / 1000).toFixed(1);

  // ── Per-document summary table ──
  let docSummaryRows = '';
  let docDetailSections = '';

  if (allDocResults && allDocResults.length > 0) {
    allDocResults.forEach((doc, idx) => {
      const outcomeClass = doc.outcome === 'PASS' ? 'pass' : 'fail';
      const checks = doc.documentChecks || [];
      const passCount = checks.filter(c => c.pass).length;
      const failCount = checks.filter(c => !c.pass).length;

      docSummaryRows += `
        <tr>
          <td>${idx + 1}</td>
          <td>${doc.documentNumber}</td>
          <td>${doc.documentFileName || '—'}</td>
          <td class="${outcomeClass}">${doc.outcome}</td>
          <td>${passCount + failCount > 0 ? `${passCount} pass / ${failCount} fail` : '—'}</td>
        </tr>`;

      // ── Document checks detail section ──
      if (checks.length > 0) {
        let qualityRows = '';
        let loadsheetRows = '';
        let transmittalRows = '';

        checks.forEach(c => {
          const statusClass = c.pass ? 'pass' : 'fail';
          const row = `
            <tr>
              <td>${c.label}</td>
              <td class="${statusClass}">${c.pass ? 'PASS' : 'FAIL'}</td>
              <td>${c.detail || ''}</td>
            </tr>`;

          if (c.section === 'Loadsheet') loadsheetRows += row;
          else if (c.section === 'Transmittal') transmittalRows += row;
          else qualityRows += row;
        });

        docDetailSections += `
          <div class="doc-detail" style="margin-top:24px;">
            <h3 style="font-size:16px;color:#003b5c;margin-bottom:4px;">
              ${idx + 1}. ${doc.documentNumber}
              <span style="font-size:13px;font-weight:400;color:#666;margin-left:8px;">${doc.documentFileName || ''}</span>
              <span class="${outcomeClass}" style="margin-left:12px;font-size:13px;">${doc.outcome}</span>
            </h3>`;

        if (qualityRows) {
          docDetailSections += `
            <details class="check-section">
              <summary>Document Quality Checks</summary>
              <table>
                <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>${qualityRows}</tbody>
              </table>
            </details>`;
        }

        if (loadsheetRows) {
          docDetailSections += `
            <details class="check-section">
              <summary>Loadsheet vs Document</summary>
              <table>
                <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>${loadsheetRows}</tbody>
              </table>
            </details>`;
        }

        if (transmittalRows) {
          docDetailSections += `
            <details class="check-section">
              <summary>Transmittal Readiness</summary>
              <table>
                <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>${transmittalRows}</tbody>
              </table>
            </details>`;
        }

        docDetailSections += '</div>';
      }
    });
  }

  // ── Legacy flat step results table (workflow steps) ──
  const stepDescriptions = [
    'Login',
    'Identify Document in To Do List',
    'Claim Submittal',
    'Validate Submittal Detail Screen',
    'Open Load Datasheet',
    'Validate Datasheet Fields',
    'Document Integrity Check',
    'Create Incoming Transmittal',
    'Document Download & Validation',
    'Approve Submittal',
    'Set Bot Reviewed Status'
  ];

  let stepRows = '';
  if (results && results.length > 0) {
    results.forEach((r, i) => {
      const statusClass = r.status === 'PASS' ? 'pass' : 'fail';
      const screenshotLink = screenshots && screenshots[i]
        ? `<a href="../screenshots/${path.basename(screenshots[i])}" target="_blank">View</a>`
        : '—';
      stepRows += `
        <tr>
          <td>${i + 1}</td>
          <td>${stepDescriptions[i] || r.step || ''}</td>
          <td class="${statusClass}">${r.status}</td>
          <td>${r.notes || ''}</td>
          <td>${screenshotLink}</td>
        </tr>`;
    });
  }

  const totalDocs = allDocResults ? allDocResults.length : 0;
  const passedDocs = allDocResults ? allDocResults.filter(d => d.outcome === 'PASS').length : 0;
  const failedDocs = totalDocs - passedDocs;
  const allPassed = failedDocs === 0 && totalDocs > 0;
  const finalStatus = allPassed ? 'All Documents — Bot Reviewed' : `${passedDocs} Passed / ${failedDocs} Failed`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bot Execution Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; padding: 32px; color: #333; }
    .report { max-width: 1060px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: #003b5c; color: #fff; padding: 24px 32px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header .sub { font-size: 14px; opacity: 0.8; }
    .meta { padding: 20px 32px; background: #f0f4f8; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; }
    .meta .label { font-weight: 600; color: #666; }
    .content { padding: 24px 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #003b5c; color: #fff; padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
    td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    tr:hover { background: #f9f9f9; }
    .pass { color: #2e7d32; font-weight: 700; }
    .fail { color: #c62828; font-weight: 700; }
    .section-title { font-size: 18px; color: #003b5c; margin: 28px 0 8px; padding-top: 16px; border-top: 2px solid #e0e0e0; }
    .section-title:first-child { border-top: none; margin-top: 0; }
    .footer { padding: 20px 32px; background: #f0f4f8; border-top: 2px solid #003b5c; font-size: 14px; }
    .footer .final-status { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .footer .final-status.ok { color: #2e7d32; }
    .footer .final-status.err { color: #c62828; }
    a { color: #00a3e0; }
    .doc-detail { page-break-inside: avoid; }
    .check-section { margin: 10px 0; border: 1px solid #e0e0e0; border-radius: 4px; }
    .check-section summary { cursor: pointer; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #003b5c; background: #f0f4f8; user-select: none; }
    .check-section summary:hover { background: #e4ecf2; }
    .check-section[open] summary { border-bottom: 1px solid #e0e0e0; }
    .check-section table { margin-top: 0; }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>Bot Execution Report</h1>
      <div class="sub">Document Control Automation</div>
    </div>
    <div class="meta">
      <div><span class="label">Run Date & Time:</span> ${new Date(startTime).toLocaleString()}</div>
      <div><span class="label">Duration:</span> ${duration}s</div>
      <div><span class="label">Bot User:</span> ${botUser}</div>
      <div><span class="label">Documents Processed:</span> ${totalDocs} (${passedDocs} passed, ${failedDocs} failed)</div>
    </div>
    <div class="content">
      <h2 class="section-title" style="border-top:none;margin-top:0;">Document Summary</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Document Number</th><th>File Name</th><th>Outcome</th><th>Checks</th></tr>
        </thead>
        <tbody>${docSummaryRows}</tbody>
      </table>

      <h2 class="section-title">Document Quality &amp; Cross-Validation Checks</h2>
      ${docDetailSections || '<p style="color:#999;margin-top:8px;">No document checks recorded.</p>'}

      ${stepRows ? `
      <h2 class="section-title">Workflow Step Log</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Step</th><th>Status</th><th>Notes</th><th>Screenshot</th></tr>
        </thead>
        <tbody>${stepRows}</tbody>
      </table>` : ''}
    </div>
    <div class="footer">
      <div class="final-status ${allPassed ? 'ok' : 'err'}">
        Final Status: ${finalStatus} ${allPassed ? '&#10003;' : '&#10007;'}
      </div>
      <div>Next Action: ${allPassed ? 'Manual DC review required to mark Complete' : 'Investigate failed documents and re-submit'}</div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

function saveReport(html, reportsDir) {
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(reportsDir, `report-${timestamp}.html`);
  fs.writeFileSync(filePath, html);
  return filePath;
}

module.exports = { generateReport, saveReport };
