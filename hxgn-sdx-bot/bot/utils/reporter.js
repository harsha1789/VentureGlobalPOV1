/**
 * HTML Report Generator for bot execution results.
 * Errors are surfaced prominently — failed sections auto-expand,
 * fail rows are highlighted, and an error summary banner appears at the top.
 */

const fs = require('fs');
const path = require('path');

function generateReport(results, meta) {
  const { botUser, documentNumber, startTime, endTime, screenshots, allDocResults } = meta;
  const duration = ((new Date(endTime) - new Date(startTime)) / 1000).toFixed(1);

  const totalDocs   = allDocResults ? allDocResults.length : 0;
  const passedDocs  = allDocResults ? allDocResults.filter(d => d.outcome === 'PASS').length : 0;
  const failedDocs  = totalDocs - passedDocs;
  const allPassed   = failedDocs === 0 && totalDocs > 0;
  const finalStatus = allPassed
    ? 'All Documents — Bot Reviewed'
    : `${passedDocs} Passed / ${failedDocs} Failed`;

  // ── Collect ALL failures across all docs for the summary panel ──
  const allErrors = [];
  if (allDocResults) {
    allDocResults.forEach(doc => {
      const checks = doc.documentChecks || [];
      checks.filter(c => !c.pass).forEach(c => {
        allErrors.push({ doc: doc.documentNumber, label: c.label, detail: c.detail || '', section: c.section || 'Quality' });
      });
      // Include step-level failures (e.g. OCR fatal)
      (doc.steps || []).filter(s => s && s.status === 'FAIL').forEach(s => {
        if (s.notes && !allErrors.some(e => e.doc === doc.documentNumber && e.label === s.notes)) {
          allErrors.push({ doc: doc.documentNumber, label: 'Pipeline Step Failed', detail: s.notes, section: 'Pipeline' });
        }
      });
    });
  }

  // ── Error summary banner ──
  let errorBanner = '';
  if (allErrors.length > 0) {
    const byDoc = {};
    allErrors.forEach(e => {
      if (!byDoc[e.doc]) byDoc[e.doc] = [];
      byDoc[e.doc].push(e);
    });
    const bannerRows = Object.entries(byDoc).map(([docNum, errs]) => `
      <div class="err-doc">
        <div class="err-doc-title">${docNum} — ${errs.length} error${errs.length !== 1 ? 's' : ''}</div>
        <ul class="err-list">
          ${errs.map(e => `<li><span class="err-section">[${e.section}]</span> <strong>${e.label}</strong>${e.detail ? ` — ${e.detail}` : ''}</li>`).join('')}
        </ul>
      </div>`).join('');
    errorBanner = `
      <div class="error-banner">
        <div class="error-banner-title">&#9888; ${allErrors.length} Validation Error${allErrors.length !== 1 ? 's' : ''} Found Across ${Object.keys(byDoc).length} Document${Object.keys(byDoc).length !== 1 ? 's' : ''}</div>
        ${bannerRows}
      </div>`;
  } else {
    errorBanner = `<div class="success-banner">&#10003; All checks passed across all ${totalDocs} document${totalDocs !== 1 ? 's' : ''}.</div>`;
  }

  // ── Per-document summary table ──
  let docSummaryRows = '';
  if (allDocResults) {
    allDocResults.forEach((doc, idx) => {
      const outcomeClass = doc.outcome === 'PASS' ? 'pass' : 'fail';
      const checks    = doc.documentChecks || [];
      const passCount = checks.filter(c => c.pass).length;
      const failCount = checks.filter(c => !c.pass).length;
      docSummaryRows += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${doc.documentNumber}</strong></td>
          <td style="color:#555">${doc.documentFileName || '—'}</td>
          <td><span class="badge badge-${outcomeClass}">${doc.outcome}</span></td>
          <td>
            ${passCount > 0 ? `<span class="pill pill-pass">${passCount} pass</span>` : ''}
            ${failCount > 0 ? `<span class="pill pill-fail">${failCount} fail</span>` : ''}
            ${passCount + failCount === 0 ? '—' : ''}
          </td>
        </tr>`;
    });
  }

  // ── Per-document detail sections ──
  let docDetailSections = '';
  if (allDocResults) {
    allDocResults.forEach((doc, idx) => {
      const outcomeClass = doc.outcome === 'PASS' ? 'pass' : 'fail';
      const checks    = doc.documentChecks || [];
      const failCount = checks.filter(c => !c.pass).length;

      const sectionMap = { quality: [], loadsheet: [], transmittal: [], nativeMeta: [] };
      checks.forEach(c => {
        const row = `
            <tr class="${c.pass ? '' : 'fail-row'}">
              <td>${c.label}</td>
              <td><span class="badge badge-${c.pass ? 'pass' : 'fail'}">${c.pass ? 'PASS' : 'FAIL'}</span></td>
              <td>${c.detail || ''}</td>
            </tr>`;
        if (c.section === 'Native PDF Metadata') sectionMap.nativeMeta.push(row);
        else if (c.section === 'Loadsheet')       sectionMap.loadsheet.push(row);
        else if (c.section === 'Transmittal')     sectionMap.transmittal.push(row);
        else                                       sectionMap.quality.push(row);
      });

      const hasFail = s => s.some(r => r.includes('fail-row'));

      const highlightedName = doc.highlightedPdfPath ? path.basename(doc.highlightedPdfPath) : '';
      const highlightedLink = highlightedName
        ? `<div class="artifact-link">&#128196; Highlighted error PDF: <a href="../downloads/${highlightedName}" target="_blank">${highlightedName}</a></div>`
        : '';

      const makeSectionBlock = (title, rows) => {
        if (!rows.length) return '';
        const hasErr = hasFail(rows);
        return `
          <details class="check-section${hasErr ? ' has-errors' : ''}" ${hasErr ? 'open' : ''}>
            <summary>${title}${hasErr ? ` <span class="section-fail-badge">&#9888; has errors</span>` : ''}</summary>
            <table>
              <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
              <tbody>${rows.join('')}</tbody>
            </table>
          </details>`;
      };

      docDetailSections += `
        <div class="doc-card ${outcomeClass}-card">
          <div class="doc-card-header">
            <div>
              <span class="doc-card-num">${doc.documentNumber}</span>
              <span class="doc-card-file">${doc.documentFileName || ''}</span>
            </div>
            <span class="badge badge-${outcomeClass} badge-lg">${doc.outcome}</span>
          </div>
          ${failCount > 0 ? `<div class="doc-error-count">&#9888; ${failCount} check${failCount !== 1 ? 's' : ''} failed</div>` : ''}
          ${highlightedLink}
          ${checks.length === 0 ? '<p class="no-checks">No checks recorded for this document.</p>' : ''}
          ${makeSectionBlock('Native PDF Metadata', sectionMap.nativeMeta)}
          ${makeSectionBlock('Document Quality Checks (12)', sectionMap.quality)}
          ${makeSectionBlock('Loadsheet vs Document', sectionMap.loadsheet)}
          ${makeSectionBlock('Transmittal Readiness', sectionMap.transmittal)}
        </div>`;
    });
  }

  // ── Flat step log ──
  const stepDescriptions = [
    'Login', 'Identify Document', 'Claim Submittal', 'Validate Detail Screen',
    'Open Load Datasheet', 'Validate Datasheet', 'Document Integrity Check',
    'Create Transmittal', 'AI OCR Validation', 'Approve Submittal', 'Set Bot Reviewed'
  ];
  let stepRows = '';
  if (results && results.length > 0) {
    results.forEach((r, i) => {
      const statusClass = r.status === 'PASS' ? 'pass' : 'fail';
      const ssLink = screenshots && screenshots[i]
        ? `<a href="../screenshots/${path.basename(screenshots[i])}" target="_blank">View</a>`
        : '—';
      stepRows += `
        <tr class="${r.status === 'FAIL' ? 'fail-row' : ''}">
          <td>${i + 1}</td>
          <td>${stepDescriptions[i] || ''}</td>
          <td><span class="badge badge-${statusClass}">${r.status}</span></td>
          <td>${r.notes || ''}</td>
          <td>${ssLink}</td>
        </tr>`;
    });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bot Execution Report — ${new Date(startTime).toLocaleDateString()}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #eef2f5; padding: 28px; color: #222; }
    .report { max-width: 1080px; margin: 0 auto; }

    /* Header */
    .header { background: #003b5c; color: #fff; padding: 22px 32px; border-radius: 8px 8px 0 0; }
    .header h1 { font-size: 22px; }
    .header .sub { font-size: 13px; opacity: 0.75; margin-top: 4px; }

    /* Meta bar */
    .meta { background: #f0f4f8; padding: 16px 32px; display: flex; gap: 32px; flex-wrap: wrap; font-size: 13px; border-bottom: 1px solid #d0d8e0; }
    .meta-item .lbl { font-weight: 700; color: #555; margin-right: 4px; }

    /* Error / success banner */
    .error-banner { background: #fdf0f0; border: 2px solid #c62828; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .error-banner-title { font-size: 16px; font-weight: 700; color: #c62828; margin-bottom: 12px; }
    .err-doc { margin-bottom: 12px; }
    .err-doc:last-child { margin-bottom: 0; }
    .err-doc-title { font-weight: 700; color: #333; font-size: 13px; margin-bottom: 4px; }
    .err-list { list-style: none; padding-left: 12px; }
    .err-list li { font-size: 12px; color: #555; line-height: 1.7; border-left: 3px solid #e57373; padding-left: 8px; margin-bottom: 2px; }
    .err-section { color: #888; font-size: 11px; margin-right: 4px; }
    .success-banner { background: #f0fdf4; border: 2px solid #2e7d32; border-radius: 6px; padding: 14px 20px; margin: 20px 0; color: #2e7d32; font-weight: 700; font-size: 15px; }

    /* Content area */
    .content { background: #fff; padding: 28px 32px; border-radius: 0 0 8px 8px; }

    /* Section titles */
    .section-title { font-size: 17px; color: #003b5c; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #003b5c; }
    .section-title:first-child { margin-top: 0; }

    /* Summary table */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #003b5c; color: #fff; padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px 12px; border-bottom: 1px solid #e8ecf0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr.fail-row td { background: #fff8f8; }
    tr:hover td { background: #f5f8fb; }
    tr.fail-row:hover td { background: #fef0f0; }

    /* Badges */
    .badge { display: inline-block; padding: 2px 9px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-pass { background: #e8f5e9; color: #2e7d32; }
    .badge-fail { background: #ffebee; color: #c62828; }
    .badge-lg { font-size: 13px; padding: 4px 14px; }
    .pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; margin-right: 4px; }
    .pill-pass { background: #e8f5e9; color: #2e7d32; }
    .pill-fail { background: #ffebee; color: #c62828; }

    /* Document cards */
    .doc-card { border: 1px solid #d8e0e8; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
    .pass-card { border-left: 5px solid #2e7d32; }
    .fail-card { border-left: 5px solid #c62828; }
    .doc-card-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: #f7f9fb; border-bottom: 1px solid #e0e8f0; }
    .doc-card-num { font-size: 15px; font-weight: 700; color: #003b5c; }
    .doc-card-file { font-size: 12px; color: #888; margin-left: 10px; }
    .doc-error-count { background: #ffebee; color: #c62828; font-size: 12px; font-weight: 700; padding: 6px 16px; border-bottom: 1px solid #ffcdd2; }
    .artifact-link { font-size: 12px; padding: 6px 16px; background: #fff8e1; border-bottom: 1px solid #ffe082; color: #795548; }
    .artifact-link a { color: #e65100; }
    .no-checks { color: #999; font-size: 13px; padding: 12px 16px; }

    /* Check sections (collapsible) */
    .check-section { border-top: 1px solid #e8ecf0; }
    .check-section summary { cursor: pointer; padding: 10px 16px; font-size: 13px; font-weight: 600; color: #003b5c; user-select: none; display: flex; align-items: center; gap: 8px; }
    .check-section summary:hover { background: #f0f4f8; }
    .check-section[open] > summary { background: #f0f4f8; border-bottom: 1px solid #e0e8f0; }
    .check-section.has-errors > summary { color: #c62828; }
    .section-fail-badge { font-size: 11px; color: #c62828; font-weight: 600; background: #ffebee; padding: 1px 7px; border-radius: 10px; }
    .check-section table { margin: 0; }
    .check-section td:first-child { color: #333; }
    .check-section td:nth-child(3) { color: #666; font-size: 12px; }

    /* Footer */
    .footer { margin-top: 20px; background: #f0f4f8; border: 1px solid #d0d8e0; border-radius: 8px; padding: 18px 28px; font-size: 14px; }
    .final-status { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .final-status.ok { color: #2e7d32; }
    .final-status.err { color: #c62828; }
    a { color: #0277bd; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>Document Control Bot — Execution Report</h1>
      <div class="sub">VG-CP2 | Automated Submittal Review Pipeline</div>
    </div>
    <div class="meta">
      <div class="meta-item"><span class="lbl">Run Date:</span>${new Date(startTime).toLocaleString()}</div>
      <div class="meta-item"><span class="lbl">Duration:</span>${duration}s</div>
      <div class="meta-item"><span class="lbl">Bot User:</span>${botUser}</div>
      <div class="meta-item"><span class="lbl">Docs Processed:</span>${totalDocs}</div>
      <div class="meta-item"><span class="lbl">Passed:</span><span style="color:#2e7d32;font-weight:700">${passedDocs}</span></div>
      <div class="meta-item"><span class="lbl">Failed:</span><span style="color:${failedDocs > 0 ? '#c62828' : '#2e7d32'};font-weight:700">${failedDocs}</span></div>
    </div>

    <div class="content">
      ${errorBanner}

      <h2 class="section-title">Document Summary</h2>
      <table>
        <thead><tr><th>#</th><th>Document Number</th><th>File Name</th><th>Outcome</th><th>Checks</th></tr></thead>
        <tbody>${docSummaryRows}</tbody>
      </table>

      <h2 class="section-title" style="margin-top:32px">Detailed Check Results</h2>
      ${docDetailSections || '<p style="color:#999">No document checks recorded.</p>'}

      ${stepRows ? `
      <h2 class="section-title">Workflow Step Log</h2>
      <table>
        <thead><tr><th>#</th><th>Step</th><th>Status</th><th>Notes</th><th>Screenshot</th></tr></thead>
        <tbody>${stepRows}</tbody>
      </table>` : ''}
    </div>

    <div class="footer">
      <div class="final-status ${allPassed ? 'ok' : 'err'}">
        Final Status: ${finalStatus} ${allPassed ? '&#10003;' : '&#10007;'}
      </div>
      <div style="color:#666">Next Action: ${allPassed
        ? 'Manual DC review required to mark Complete'
        : 'Investigate failed documents, correct errors, and re-submit'}</div>
    </div>
  </div>
</body>
</html>`;
}

function saveReport(html, reportsDir) {
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(reportsDir, `report-${timestamp}.html`);
  fs.writeFileSync(filePath, html);
  return filePath;
}

function writeValidationSummary(reportsDir, allDocResults, systemMode) {
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, 'Validation_Summary.txt');
  const lines = [];

  (allDocResults || []).forEach(doc => {
    const vr       = doc.validationResults || {};
    const checks   = vr.checks || [];
    const analysis = vr.ocrAnalysis || {};
    const isValid  = doc.outcome === 'PASS';

    const blankPages    = Array.isArray(analysis.blank_pages)   ? analysis.blank_pages   : [];
    const nonOcrPages   = Array.isArray(analysis.non_ocr_pages) ? analysis.non_ocr_pages : [];
    const filteredIssues= Array.isArray(analysis.issues)        ? analysis.issues        : [];
    const otherFailures = checks.filter(c =>
      c.status === 'FAIL' &&
      !c.name.includes('Blank Page') &&
      !c.name.includes('Non-OCR') &&
      !c.name.startsWith('Consistency:')
    );

    const fileName = doc.documentFileName ||
      (doc.documentPath ? path.basename(doc.documentPath) : `${doc.documentNumber}.pdf`);

    lines.push('==================================================');
    lines.push('          COMPLIANCE VALIDATION REPORT            ');
    lines.push('==================================================');
    lines.push('');
    lines.push(`Document Name : ${fileName}`);
    lines.push(`System Mode   : ${systemMode}`);
    lines.push(`Final Status  : ${isValid ? 'PASSED' : 'FAILED'}`);
    lines.push('');
    lines.push('--------------------------------------------------');
    lines.push('VALIDATION STEPS EXECUTED:');
    lines.push('1. UI detail field extraction (Step 4)');
    lines.push('2. Datasheet cross-validation (Step 6)');
    lines.push('3. Document integrity checks (Step 7)');
    lines.push('4. AI OCR metadata extraction (Step 8b Phase 1)');
    lines.push('5. Cross-page consistency analysis (Step 8b Phase 2)');
    lines.push('6. Loadsheet cross-validation (Step 8b Phase 3)');
    lines.push('7. Contract/project reference check (Step 8b Phase 4)');
    lines.push('--------------------------------------------------');
    lines.push('');

    if (isValid) {
      lines.push('SUMMARY:');
      lines.push('The document passed all compliance barriers smoothly.');
      lines.push('Action Taken: Task Approved & Transmittal Generated.');
    } else {
      lines.push('SUMMARY OF ISSUES / DISCREPANCIES:');
      lines.push('');

      if (blankPages.length > 0) {
        lines.push('  [!] Blank pages:');
        blankPages.forEach(p => lines.push(`      - Page ${p}`));
      }
      if (nonOcrPages.length > 0) {
        lines.push('  [!] Non-OCR pages:');
        nonOcrPages.forEach(p => lines.push(`      - Page ${p}`));
      }

      const preOcrFailures = (doc.documentChecks || []).filter(c => c && c.pass === false);
      if (filteredIssues.length > 0 || otherFailures.length > 0 || preOcrFailures.length > 0) {
        lines.push('  [!] Other errors:');
        filteredIssues.forEach(iss => {
          lines.push(`      - Page ${iss.page}: Mismatch in '${iss.field}' (Expected: '${iss.expected}', Found: '${iss.found}')`);
        });
        otherFailures.forEach(c => lines.push(`      - ${c.name}: ${c.note}`));
        preOcrFailures.forEach(c => {
          lines.push(`      - ${c.label || c.name || 'check'}: ${c.detail || c.note || ''}`);
        });
      }

      lines.push('');
      lines.push('  Action Taken: Task Declined.');
      if (vr.highlightedPdfPath) {
        lines.push(`  Artifact Saved: ${path.basename(vr.highlightedPdfPath)}`);
      }
    }

    lines.push('');
    lines.push('==================================================');
    lines.push('                 END OF REPORT                    ');
    lines.push('==================================================');
    lines.push('');
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

module.exports = { generateReport, saveReport, writeValidationSummary };
