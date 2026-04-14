/**
 * HxGN SDx Document Control Automation Bot — Main Entry Point
 *
 * Processes ALL documents with status "Submitted" in the To Do list.
 * For each document: claim → validate → check integrity → transmittal → approve → bot-reviewed.
 * Documents that fail quality checks are logged and skipped (bot continues to next document).
 * Generates an HTML report upon completion.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Logger } = require('./utils/logger');
const { generateReport, saveReport } = require('./utils/reporter');

// Step modules
const step01 = require('./steps/step01-login');
const step04 = require('./steps/step04-validate-detail');
const step05 = require('./steps/step05-open-datasheet');
const step06 = require('./steps/step06-validate-datasheet');
const step07 = require('./steps/step07-doc-integrity');
const step08 = require('./steps/step08-create-transmittal');
const step08b = require('./steps/step08b-document-validation');
const step09 = require('./steps/step09-approve');
const step10 = require('./steps/step10-bot-reviewed');

async function resetMimicApp(appUrl) {
  try {
    const res = await fetch(appUrl + '/api/reset', { method: 'POST' });
    const data = await res.json();
    console.log('[RESET]', data.message);
  } catch (e) {
    console.warn('[RESET] Could not reset mimic app — is the server running?', e.message);
  }
}

function generateFreshPdfs() {
  console.log('\n[PDF] Generating fresh test PDFs at runtime...');
  const { spawnSync } = require('child_process');
  const generatorPath = path.resolve(__dirname, '../mimic-app/backend/generate-test-pdfs.js');
  const r = spawnSync(process.execPath, [generatorPath], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.warn('[PDF] Generator exited with non-zero status — continuing anyway');
  }
}

/** Login and navigate to the To Do list. Reusable after page reloads. */
async function loginAndGoToTodo(page, env) {
  await page.goto(env.APP_URL, { waitUntil: 'networkidle' });
  // Check if already on todo screen (session preserved)
  const todoVisible = await page.isVisible('[data-testid="todo-screen"]').catch(() => false);
  if (todoVisible) return;
  // Need to login
  await page.fill('[data-testid="login-username"]', env.BOT_USERNAME);
  await page.fill('[data-testid="login-password"]', env.BOT_PASSWORD);
  await page.click('[data-testid="login-button"]');
  await page.waitForSelector('[data-testid="todo-screen"]', { state: 'visible', timeout: 10000 });
}

async function main() {
  const env = {
    APP_URL: process.env.APP_URL || 'http://localhost:3000',
    BOT_USERNAME: process.env.BOT_USERNAME || 'dc_bot',
    BOT_PASSWORD: process.env.BOT_PASSWORD || 'BotPass2026!'
  };

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Document Control Automation Bot');
  console.log('  Multi-Document Processing');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`App URL:  ${env.APP_URL}`);
  console.log(`Bot User: ${env.BOT_USERNAME}`);
  console.log('');

  // Generate fresh PDFs (with today's runtime stamp) before resetting app state
  generateFreshPdfs();

  // Reset mimic app state
  await resetMimicApp(env.APP_URL);

  const logger = new Logger();
  const allDocResults = [];
  const screenshotsDir = path.resolve(__dirname, 'screenshots');
  const reportsDir = path.resolve(__dirname, 'reports');

  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const startTime = new Date().toISOString();
  const stepDelay = parseInt(process.env.STEP_DELAY, 10) || 0;

  // Launch browser
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO, 10) || 0
  });
  const videosDir = path.resolve(__dirname, 'videos');
  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videosDir, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  // ── Step 1: Login ──
  console.log('\n══ Step 1: Login ══════════════════════════════════════════');
  const loginResult = await step01(page, env, logger, {});
  const loginScreenshot = path.join(screenshotsDir, 'step01-login.png');
  await page.screenshot({ path: loginScreenshot, fullPage: true });

  // ── Find all "Submitted" documents ──
  console.log('\n══ Scanning To Do list for all Submitted documents ═══════');
  await page.waitForSelector('[data-testid="todo-tbody"] tr', { timeout: 10000 });

  const submittedRows = await page.$$eval('[data-testid="todo-tbody"] tr', rows => {
    return rows
      .filter(row => {
        const statusEl = row.querySelector('[data-testid="todo-status"]');
        return statusEl && statusEl.textContent.trim() === 'Review Submittal';
      })
      .map(row => {
        const docEl = row.querySelector('[data-testid="todo-docnum"]');
        const rowTestId = row.getAttribute('data-testid');
        return {
          id: rowTestId ? rowTestId.replace('todo-row-', '') : null,
          documentNumber: docEl ? docEl.textContent.trim() : ''
        };
      });
  });

  console.log(`Found ${submittedRows.length} document(s) with status "Submitted":`);
  submittedRows.forEach((d, i) => console.log(`  ${i + 1}. ${d.documentNumber}`));

  if (submittedRows.length === 0) {
    console.log('No documents to process. Exiting.');
    await context.close();
    await browser.close();
    process.exit(0);
  }

  // ── Process each document ──
  for (let docIdx = 0; docIdx < submittedRows.length; docIdx++) {
    const doc = submittedRows[docIdx];
    const docNum = doc.documentNumber;
    const docLabel = `[${docIdx + 1}/${submittedRows.length}]`;
    const docResults = { documentNumber: docNum, steps: [], outcome: 'PASS' };
    const ctx = { documentNumber: docNum, submittalId: doc.id };

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${docLabel} Processing: ${docNum}`);
    console.log(`${'═'.repeat(60)}`);

    const screenshotPrefix = `doc${String(docIdx + 1).padStart(2, '0')}`;

    try {
      // Navigate to To Do list (re-login if needed after page reload)
      await loginAndGoToTodo(page, env);
      await page.waitForSelector('[data-testid="todo-tbody"] tr', { timeout: 10000 });

      // ── Find and click Claim button for this specific document ──
      console.log(`\n── ${docLabel} Step 2: Identify & Claim ──────────────────`);
      const claimBtn = await page.$(`[data-testid="todo-row-${doc.id}"] [data-testid="claim-btn"]`);
      if (!claimBtn) {
        throw new Error(`Claim button not found for ${docNum}`);
      }
      await claimBtn.click();
      await page.waitForSelector('[data-testid="detail-screen"]', { state: 'visible', timeout: 10000 });
      logger.pass(3, `Claimed ${docNum}`);
      docResults.steps.push({ status: 'PASS', notes: `Claimed ${docNum}` });
      await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-claim.png`), fullPage: true });
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 4: Validate detail ──
      console.log(`\n── ${docLabel} Step 3: Validate Detail ────────────────────`);
      const detailResult = await step04(page, env, logger, ctx);
      docResults.steps.push(detailResult);
      await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-detail.png`), fullPage: true });
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 5: Open datasheet ──
      console.log(`\n── ${docLabel} Step 4: Open Datasheet ─────────────────────`);
      const dsOpenResult = await step05(page, env, logger);
      docResults.steps.push(dsOpenResult);
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 6: Validate datasheet ──
      console.log(`\n── ${docLabel} Step 5: Validate Datasheet ─────────────────`);
      const dsValResult = await step06(page, env, logger);
      docResults.steps.push(dsValResult);
      await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-datasheet.png`), fullPage: true });
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 7: Document integrity + quality checks ──
      console.log(`\n── ${docLabel} Step 6: Document Integrity & Quality ──────`);
      const integrityResult = await step07(page, env, logger, ctx);
      docResults.steps.push(integrityResult);
      docResults.documentChecks = ctx.documentChecks || [];
      docResults.documentFileName = ctx.documentFileName || '';
      await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-integrity.png`), fullPage: true });
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 8: Create transmittal ──
      console.log(`\n── ${docLabel} Step 7: Create Transmittal ─────────────────`);
      const transResult = await step08(page, env, logger);
      docResults.steps.push(transResult);
      await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-transmittal.png`), fullPage: true });
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 8b: AI OCR Validation ──
      console.log(`\n── ${docLabel} Step 8: AI OCR Validation ───────────`);
      const validationResult = await step08b(page, env, logger, ctx);
      docResults.steps.push(validationResult);
      docResults.validationResults = ctx.validationResults || {};
      docResults.documentPath = ctx.documentPath || '';
      // Merge OCR checks into documentChecks for the HTML report
      if (ctx.validationResults && ctx.validationResults.checks) {
        const ocrChecks = ctx.validationResults.checks.map(c => ({
          label: c.name,
          pass: c.status === 'PASS',
          detail: c.note,
          section: c.name.includes('Loadsheet') ? 'Loadsheet' : 'Quality'
        }));
        docResults.documentChecks = (docResults.documentChecks || []).concat(ocrChecks);
      }
      await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-validation.png`), fullPage: true });
      if (validationResult.status === 'FAIL') {
        throw new Error(`VGL OCR validation failed: ${validationResult.notes}`);
      }
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 9: Approve ──
      console.log(`\n── ${docLabel} Step 9: Approve Submittal ──────────────────`);
      const approveResult = await step09(page, env, logger, ctx);
      docResults.steps.push(approveResult);
      if (stepDelay > 0) await new Promise(r => setTimeout(r, stepDelay));

      // ── Step 10: Bot Reviewed ──
      console.log(`\n── ${docLabel} Step 10: Set Bot Reviewed ───────────────────`);
      const botRevResult = await step10(page, env, logger);
      docResults.steps.push(botRevResult);
      await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-final.png`), fullPage: true });

      console.log(`\n  ✓ ${docLabel} ${docNum} — PASSED all checks`);

    } catch (err) {
      console.error(`\n  ✗ ${docLabel} ${docNum} — FAILED: ${err.message}`);
      docResults.steps.push({ status: 'FAIL', notes: err.message });
      docResults.outcome = 'FAIL';
      // Capture document checks even on failure
      if (ctx.documentChecks) {
        docResults.documentChecks = ctx.documentChecks;
        docResults.documentFileName = ctx.documentFileName || '';
      }

      // Persist the failing PDF to downloads/ so there is always an on-disk copy
      try {
        const downloadsDir = path.resolve(__dirname, 'downloads');
        if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
        const testPdfsDir = path.resolve(__dirname, '../mimic-app/backend/test-pdfs');
        const candidates = fs.existsSync(testPdfsDir)
          ? fs.readdirSync(testPdfsDir).filter(f => f.startsWith(docNum) && f.endsWith('.pdf'))
          : [];
        if (candidates.length > 0) {
          const srcPath = path.join(testPdfsDir, candidates[0]);
          const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
          const destPath = path.join(downloadsDir, `${docNum}_REJECTED_${runStamp}.pdf`);
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ↳ Rejected PDF archived: ${destPath}`);
          docResults.rejectedPdfPath = destPath;
        }
      } catch (copyErr) {
        console.warn('  Could not archive rejected PDF:', copyErr.message);
      }

      // Create detailed error screenshot
      try {
        const errorDetails = {
          documentNumber: docNum,
          failureStep: docResults.steps.length,
          errorMessage: err.message,
          timestamp: new Date().toISOString(),
          documentChecks: ctx.documentChecks || [],
          validationResults: ctx.validationResults || {}
        };

        // Create a temporary HTML page with error details
        const errorHtmlPath = path.join(screenshotsDir, `${screenshotPrefix}-error-details.html`);
        const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Document Validation Error Details</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f5; }
    .error-container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .error-header { background: #c62828; color: white; padding: 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
    .error-title { font-size: 18px; margin: 0; }
    .error-meta { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    .section { margin: 20px 0; }
    .section h3 { color: #003b5c; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px; }
    .check-item { padding: 8px; margin: 5px 0; border-left: 4px solid #666; background: #f9f9f9; }
    .check-pass { border-left-color: #2e7d32; }
    .check-fail { border-left-color: #c62828; }
    .check-warn { border-left-color: #f57c00; }
    .check-name { font-weight: bold; }
    .check-note { font-size: 13px; color: #666; margin-top: 3px; }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-header">
      <h1 class="error-title">Document Validation Failed</h1>
      <div class="error-meta">Document: ${errorDetails.documentNumber} | Failed at Step ${errorDetails.failureStep} | ${new Date(errorDetails.timestamp).toLocaleString()}</div>
    </div>

    <div class="section">
      <h3>Failure Reason</h3>
      <div class="check-item check-fail">
        <div class="check-name">Error: ${errorDetails.errorMessage}</div>
      </div>
    </div>

    ${errorDetails.documentChecks.length > 0 ? `
    <div class="section">
      <h3>Document Quality Checks Performed</h3>
      ${errorDetails.documentChecks.map(check => `
        <div class="check-item check-${check.status.toLowerCase()}">
          <div class="check-name">${check.name}: ${check.status}</div>
          <div class="check-note">${check.note}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${errorDetails.validationResults.errors && errorDetails.validationResults.errors.length > 0 ? `
    <div class="section">
      <h3>Validation Errors Detected</h3>
      ${errorDetails.validationResults.errors.map(error => `
        <div class="check-item check-fail">
          <div class="check-name">${error.name}</div>
          <div class="check-note">${error.note}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section">
      <h3>Next Steps</h3>
      <ul>
        <li>Review the error details above</li>
        <li>Correct the identified issues in the document</li>
        <li>Re-submit the document for validation</li>
        <li>Contact document control team if issues persist</li>
      </ul>
    </div>
  </div>
</body>
</html>`;

        fs.writeFileSync(errorHtmlPath, errorHtml);

        // Take screenshot of the error details page
        await page.goto(`file://${errorHtmlPath}`);
        await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-FAIL.png`), fullPage: true });

        // Clean up the temporary HTML file
        try { fs.unlinkSync(errorHtmlPath); } catch (_) {}

      } catch (screenshotErr) {
        console.warn('  Could not create detailed error screenshot:', screenshotErr.message);
        // Fallback to basic screenshot
        try {
          await page.screenshot({ path: path.join(screenshotsDir, `${screenshotPrefix}-FAIL.png`), fullPage: true });
        } catch (_) {}
      }

      // Mark this submittal as Bot Rejected so the To Do list shows a red badge
      try {
        const res = await fetch(env.APP_URL + '/api/submittal/bot-rejected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submittalId: doc.id, reason: err.message })
        });
        const data = await res.json();
        if (data.success) {
          console.log(`  ↳ Marked as Bot Rejected in mimic app`);
        }
      } catch (e) {
        console.warn('  Could not mark submittal as Bot Rejected:', e.message);
      }

      // Navigate back to To Do list so we can process the next document
      try {
        await loginAndGoToTodo(page, env);
      } catch (_) {
        console.warn('  Could not navigate back to To Do list');
      }
    }

    allDocResults.push(docResults);
  }

  const endTime = new Date().toISOString();
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  console.log(`\nVideo saved: ${videoPath}`);

  // ── Generate multi-document report ──
  console.log('\n── Generating Report ──────────────────────────────────────');

  const passed = allDocResults.filter(d => d.outcome === 'PASS');
  const failed = allDocResults.filter(d => d.outcome === 'FAIL');

  // Build flat results array for report compatibility
  const flatResults = [];
  const flatScreenshots = [];

  // Add login as first step
  flatResults.push(loginResult);
  flatScreenshots.push(loginScreenshot);

  allDocResults.forEach((doc, idx) => {
    const prefix = `doc${String(idx + 1).padStart(2, '0')}`;
    const docSsFiles = fs.readdirSync(screenshotsDir).filter(f => f.startsWith(prefix));

    doc.steps.forEach((s, si) => {
      flatResults.push({
        ...s,
        notes: `[${doc.documentNumber}] ${s.notes || ''}`
      });

      // Try to find the appropriate screenshot for this step
      let screenshotPath = null;

      // First, try to find step-specific screenshots
      const stepNames = ['claim', 'detail', 'datasheet', 'integrity', 'transmittal', 'validation', 'approve', 'final'];
      if (si < stepNames.length && stepNames[si]) {
        const stepFile = docSsFiles.find(f => f.includes(`-${stepNames[si]}.png`));
        if (stepFile) {
          screenshotPath = path.join(screenshotsDir, stepFile);
        }
      }

      // If no step-specific screenshot, check for failure screenshot
      if (!screenshotPath && doc.outcome === 'FAIL') {
        const failFile = docSsFiles.find(f => f.includes('-FAIL.png'));
        if (failFile) {
          screenshotPath = path.join(screenshotsDir, failFile);
        }
      }

      // Fallback: use any available screenshot for this document
      if (!screenshotPath && docSsFiles.length > 0) {
        screenshotPath = path.join(screenshotsDir, docSsFiles[0]);
      }

      flatScreenshots.push(screenshotPath);
    });
  });

  const html = generateReport(flatResults, {
    botUser: env.BOT_USERNAME,
    documentNumber: allDocResults.map(d => d.documentNumber).join(', '),
    startTime,
    endTime,
    screenshots: flatScreenshots,
    allDocResults
  });
  const reportPath = saveReport(html, reportsDir);
  console.log(`Report saved: ${reportPath}`);

  // Save log
  logger.save(path.join(reportsDir, 'last-run-log.json'));

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Documents processed: ${allDocResults.length}`);
  console.log(`  Passed: ${passed.length}`);
  console.log(`  Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log('  Failed documents:');
    failed.forEach(d => {
      const failStep = d.steps.find(s => s.status === 'FAIL');
      console.log(`    ✗ ${d.documentNumber}: ${failStep ? failStep.notes : 'Unknown'}`);
    });
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(failed.length > 0 && passed.length === 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
