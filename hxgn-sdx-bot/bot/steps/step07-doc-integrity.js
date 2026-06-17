/**
 * Step 7 — Open attached document, check basic integrity on UI,
 *           then fetch quality + cross-validation checks via API for the report.
 */
module.exports = async function step07DocIntegrity(page, env, logger, ctx) {
  const step = 7;
  logger.info(step, 'Navigating back to detail screen...');

  await page.click('[data-testid="datasheet-back-btn"]');
  await page.waitForSelector('[data-testid="detail-screen"]', { state: 'visible', timeout: 10000 });

  logger.info(step, 'Clicking "View / Attach Document"...');
  await page.click('[data-testid="view-document-btn"]');
  await page.waitForSelector('[data-testid="docviewer-screen"]', { state: 'visible', timeout: 10000 });

  // Check file name is displayed
  const fileName = (await page.textContent('[data-testid="docviewer-filename"]')).trim();
  logger.info(step, `Document file: ${fileName}`);

  // Read 3 basic integrity checks from UI
  const basicChecks = [];
  for (let i = 0; i < 3; i++) {
    const statusEl = await page.$(`[data-testid="integrity-status-${i}"]`);
    const checkEl = await page.$(`[data-testid="integrity-check-${i}"]`);
    const statusText = statusEl ? (await statusEl.textContent()).trim() : 'UNKNOWN';
    let label = `Check ${i + 1}`;
    if (checkEl) {
      const labelEl = await checkEl.$('.validation-label');
      if (labelEl) label = await labelEl.evaluate(el => el.textContent.trim());
    }
    basicChecks.push({ label, status: statusText });
  }

  basicChecks.forEach(c => {
    const icon = c.status === 'PASS' ? '✓' : '✗';
    logger.info(step, `  ${icon} ${c.label}: ${c.status}`);
  });

  const basicFails = basicChecks.filter(c => c.status !== 'PASS');
  if (basicFails.length > 0) {
    const details = basicFails.map(f => f.label).join(', ');
    logger.fail(step, `Basic integrity FAILED: ${details}`);
    throw new Error(`Basic integrity failed: ${details}`);
  }

  // ── Fetch document quality checks via API ──
  const apiBase = env.APP_URL;
  const submittalId = ctx.submittalId;

  const docData = await page.evaluate(async ({ apiBase, submittalId }) => {
    const res = await fetch(apiBase + '/api/document/' + submittalId);
    return res.json();
  }, { apiBase, submittalId });

  const qualityChecks = docData.qualityChecks || [];

  // ── Fetch cross-validation checks via API ──
  const xvalData = await page.evaluate(async ({ apiBase, submittalId }) => {
    const res = await fetch(apiBase + '/api/cross-validate/' + submittalId);
    return res.json();
  }, { apiBase, submittalId });

  const loadsheetChecks = xvalData.loadsheetChecks || [];
  const transmittalChecks = xvalData.transmittalChecks || [];

  // Collect all checks for the report
  const allChecks = [];
  const failures = [];

  // Quality checks
  if (qualityChecks.length > 0) {
    logger.info(step, `── Document Quality Checks (${qualityChecks.length}) ──`);
    qualityChecks.forEach(qc => {
      const icon = qc.pass ? '✓' : '✗';
      logger.info(step, `  ${icon} ${qc.label}: ${qc.pass ? 'PASS' : 'FAIL'} — ${qc.detail}`);
      allChecks.push({ label: qc.label, pass: qc.pass, detail: qc.detail, section: 'Quality' });
      if (!qc.pass) failures.push({ label: qc.label, detail: qc.detail });
    });
  }

  // Loadsheet cross-validation
  if (loadsheetChecks.length > 0) {
    logger.info(step, `── Loadsheet vs Document (${loadsheetChecks.length}) ──`);
    loadsheetChecks.forEach(lc => {
      const icon = lc.pass ? '✓' : '✗';
      logger.info(step, `  ${icon} ${lc.label}: ${lc.pass ? 'PASS' : 'FAIL'} — ${lc.detail}`);
      allChecks.push({ label: lc.label, pass: lc.pass, detail: lc.detail, section: 'Loadsheet' });
      if (!lc.pass) failures.push({ label: lc.label, detail: lc.detail });
    });
  }

  // Transmittal readiness
  if (transmittalChecks.length > 0) {
    logger.info(step, `── Transmittal Readiness (${transmittalChecks.length}) ──`);
    transmittalChecks.forEach(tc => {
      const icon = tc.pass ? '✓' : '✗';
      logger.info(step, `  ${icon} ${tc.label}: ${tc.pass ? 'PASS' : 'FAIL'} — ${tc.detail}`);
      allChecks.push({ label: tc.label, pass: tc.pass, detail: tc.detail, section: 'Transmittal' });
      if (!tc.pass) failures.push({ label: tc.label, detail: tc.detail });
    });
  }

  // Store all checks in ctx so the reporter can use them
  ctx.documentChecks = allChecks;
  ctx.documentFileName = fileName;

  const totalChecks = 3 + allChecks.length;
  if (failures.length > 0) {
    const failSummary = failures.map(f => `${f.label}: FAIL (${f.detail})`).join('; ');
    logger.fail(step, `Document checks FAILED — ${failures.length} issue(s): ${failSummary}`);
    // Non-fatal: let subsequent steps (transmittal, OCR) still run so their artifacts
    // (native metadata, OCR checks, highlighted PDF) reach the final report.
    return { status: 'FAIL', notes: `Document checks failed: ${failSummary}` };
  }

  logger.pass(step, `Document integrity — all ${totalChecks} checks PASS`);
  return { status: 'PASS', notes: `File: ${fileName}, ${totalChecks} checks passed` };
};
