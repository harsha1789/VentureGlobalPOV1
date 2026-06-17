/**
 * Step 8b: Document Download & AI OCR Validation
 *
 * Downloads the real PDF from the mimic app's test-pdfs directory
 * and runs AI-powered OCR validation using VGL OCR Engine.
 *
 * Ported from: https://github.com/athrvzoz/VGL_OCR
 *
 * Phases:
 *   1. AI Metadata Extraction (Gemini vision OCR)
 *   2. Cross-Page Consistency Analysis
 *   3. Loadsheet Cross-Validation (OCR vs datasheet)
 *   4. Contract/Project Reference Validation
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

/**
 * Extract native PDF metadata and compare against datasheet keys where they overlap.
 * Port of VGL_OCR validation_helpers.py → check_metadata().
 */
async function nativeMetadataCheck(pdfPath, datasheet) {
  const checks = [];
  let nativeMeta = {};
  try {
    const buf = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: buf });
    const parsed = await parser.getInfo();
    const info = parsed.info || {};
    nativeMeta = {
      Title: info.Title || '',
      Author: info.Author || '',
      Subject: info.Subject || '',
      Keywords: info.Keywords || '',
      Creator: info.Creator || '',
      Producer: info.Producer || ''
    };
  } catch (err) {
    checks.push({
      name: 'Native Metadata: Extraction',
      status: 'WARN',
      note: `Could not read native PDF metadata: ${err.message}`
    });
    return { checks, nativeMeta };
  }

  const populated = Object.entries(nativeMeta).filter(([, v]) => v && String(v).trim());
  checks.push({
    name: 'Native Metadata: Extraction',
    status: populated.length > 0 ? 'PASS' : 'WARN',
    note: populated.length > 0
      ? `Read ${populated.length} native field(s): ${populated.map(([k]) => k).join(', ')}`
      : 'No native metadata fields populated in PDF'
  });

  if (!datasheet) return { checks, nativeMeta };

  // Map overlapping datasheet keys onto native PDF metadata keys
  const comparisons = [
    { nativeKey: 'Title', dsKey: 'title', label: 'Title' },
    { nativeKey: 'Subject', dsKey: 'title', label: 'Subject vs Title' },
    { nativeKey: 'Keywords', dsKey: 'documentNumber', label: 'Keywords vs Document Number' },
    { nativeKey: 'Author', dsKey: 'preparedBy', label: 'Author' }
  ];

  for (const { nativeKey, dsKey, label } of comparisons) {
    const nativeVal = String(nativeMeta[nativeKey] || '').trim();
    const dsVal = String(datasheet[dsKey] || '').trim();
    if (!nativeVal || !dsVal) continue;
    const a = nativeVal.toLowerCase();
    const b = dsVal.toLowerCase();
    const match = a === b || a.includes(b) || b.includes(a);
    checks.push({
      name: `Native Metadata: ${label}`,
      status: match ? 'PASS' : 'FAIL',
      note: match
        ? `${nativeKey} matches datasheet: "${nativeVal.slice(0, 60)}"`
        : `Mismatch — PDF ${nativeKey}: "${nativeVal.slice(0, 60)}" vs Datasheet ${dsKey}: "${dsVal.slice(0, 60)}"`
    });
  }

  return { checks, nativeMeta };
}

function getOCRRunner() {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'azure') {
    console.log('    [OCR] Provider: Azure OpenAI (GPT-4o)');
    return require('../utils/azure-openai-ocr').runOCRValidation;
  }
  console.log('    [OCR] Provider: Google Gemini');
  return require('../utils/gemini-ocr').runOCRValidation;
}
const runOCRValidation = getOCRRunner();

/**
 * Locate and copy the real test PDF to the bot's downloads folder.
 */
function downloadDocument(ctx, downloadsDir) {
  const testPdfsDir = path.resolve(__dirname, '../../mimic-app/backend/test-pdfs');
  const possibleNames = [
    `${ctx.documentNumber}_Rev${ctx.revision || 'A'}.pdf`,
    `${ctx.documentNumber}.pdf`
  ];

  for (const name of possibleNames) {
    const src = path.join(testPdfsDir, name);
    if (fs.existsSync(src)) {
      const dest = path.join(downloadsDir, name);
      fs.copyFileSync(src, dest);
      console.log(`    [DL] Copied real PDF: ${name} (${Math.round(fs.statSync(src).size / 1024)}KB)`);
      return dest;
    }
  }

  // Fallback: scan test-pdfs for any file starting with the document number
  if (fs.existsSync(testPdfsDir)) {
    const files = fs.readdirSync(testPdfsDir);
    const match = files.find(f => f.startsWith(ctx.documentNumber));
    if (match) {
      const src = path.join(testPdfsDir, match);
      const dest = path.join(downloadsDir, match);
      fs.copyFileSync(src, dest);
      console.log(`    [DL] Copied real PDF: ${match} (${Math.round(fs.statSync(src).size / 1024)}KB)`);
      return dest;
    }
  }

  return null;
}

module.exports = async function step08b(page, env, logger, ctx) {
  console.log('    ═══════════════════════════════════════════════════');
  console.log('    ║  AI OCR VALIDATION (VGL_OCR Engine)     ║');
  console.log('    ═══════════════════════════════════════════════════');

  const downloadsDir = path.resolve(__dirname, '../downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  try {
    // ── Show OCR overlay BEFORE the download so viewers see the full flow ──
    await page.evaluate((docNum) => {
      const overlay = document.createElement('div');
      overlay.id = 'ocr-overlay';
      overlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,20,40,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Segoe UI,sans-serif;">
          <div style="font-size:14px;opacity:0.6;margin-bottom:8px;letter-spacing:2px;">AI OCR VALIDATION</div>
          <div style="font-size:28px;font-weight:700;margin-bottom:16px;">${docNum}</div>
          <div id="ocr-status" style="font-size:16px;color:#4fc3f7;">Preparing to download PDF...</div>
          <div id="ocr-path" style="font-size:12px;color:#90caf9;margin-top:6px;font-family:monospace;opacity:0.85;"></div>
          <div style="margin-top:20px;width:420px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;overflow:hidden;">
            <div id="ocr-bar" style="width:5%;height:100%;background:#4fc3f7;border-radius:2px;transition:width 0.5s;"></div>
          </div>
          <div id="ocr-checks" style="margin-top:24px;font-size:12px;opacity:0.8;max-width:600px;text-align:left;"></div>
          <div id="ocr-artifact" style="margin-top:16px;font-size:12px;color:#ff8a80;font-family:monospace;"></div>
        </div>`;
      document.body.appendChild(overlay);
    }, ctx.documentNumber);
    await page.waitForTimeout(600);

    // ── Download the real PDF (visible step) ──
    await page.evaluate(() => {
      document.getElementById('ocr-status').textContent = 'Downloading PDF to local disk...';
      document.getElementById('ocr-bar').style.width = '15%';
    });
    await page.waitForTimeout(600);

    const documentPath = downloadDocument(ctx, downloadsDir);
    if (!documentPath) {
      throw new Error(`No PDF found for ${ctx.documentNumber} in test-pdfs/`);
    }
    ctx.documentPath = documentPath;

    const sizeKb = Math.round(fs.statSync(documentPath).size / 1024);
    await page.evaluate(({ p, size }) => {
      document.getElementById('ocr-status').textContent = `PDF downloaded (${size} KB) — reading from local disk`;
      document.getElementById('ocr-path').textContent = p;
      document.getElementById('ocr-bar').style.width = '25%';
    }, { p: documentPath, size: sizeKb });
    await page.waitForTimeout(900);

    // ── Fetch datasheet (loadsheet) via API for cross-validation ──
    const datasheet = await page.evaluate(async ({ apiBase, submittalId }) => {
      try {
        const res = await fetch(apiBase + '/api/datasheet/' + submittalId);
        return res.ok ? res.json() : null;
      } catch { return null; }
    }, { apiBase: env.APP_URL, submittalId: ctx.submittalId });

    // ── Fetch submittal metadata ──
    const submittal = await page.evaluate(async ({ apiBase, submittalId }) => {
      try {
        const res = await fetch(apiBase + '/api/submittal/' + submittalId);
        return res.ok ? res.json() : null;
      } catch { return null; }
    }, { apiBase: env.APP_URL, submittalId: ctx.submittalId });

    // Store revision in ctx for other steps
    if (submittal) ctx.revision = submittal.revision;

    // ── Native PDF metadata check (pre-OCR) ──
    await page.evaluate(() => {
      document.getElementById('ocr-status').textContent = 'Phase 0: Reading native PDF metadata...';
      document.getElementById('ocr-bar').style.width = '35%';
    });
    console.log('    [OCR] ═══ Phase 0: Native PDF Metadata ═══');
    const nativeCheck = await nativeMetadataCheck(documentPath, datasheet);
    ctx.nativeMetadata = nativeCheck.nativeMeta;
    ctx.nativeMetadataChecks = nativeCheck.checks;
    nativeCheck.checks.forEach(c => {
      const icon = c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '⚠' : '✗';
      console.log(`      ${icon} ${c.name}: ${c.status} — ${c.note}`);
    });
    await page.waitForTimeout(500);

    // Progress: Phase 1
    await page.evaluate(() => {
      document.getElementById('ocr-status').textContent = 'Phase 1: AI metadata extraction (Azure GPT-4o)...';
      document.getElementById('ocr-bar').style.width = '55%';
    });
    await page.waitForTimeout(500);

    // ── Run VGL OCR Validation Pipeline ──
    const startTime = Date.now();
    const ocrResult = await runOCRValidation(documentPath, datasheet, submittal);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Merge native metadata checks into the OCR result (run before AI phases)
    ocrResult.checks = (nativeCheck.checks || []).concat(ocrResult.checks || []);
    if (nativeCheck.checks.some(c => c.status === 'FAIL')) ocrResult.isValid = false;

    // Persist highlighted error PDF path
    if (ocrResult.highlightedPdfPath) {
      ctx.highlightedPdfPath = ocrResult.highlightedPdfPath;
    }

    // Progress: show results on overlay
    await page.evaluate(({ checks, elapsed, highlightedPdfPath }) => {
      document.getElementById('ocr-bar').style.width = '100%';
      const failed = checks.filter(c => c.status === 'FAIL').length;
      const allPass = failed === 0;

      document.getElementById('ocr-status').innerHTML = allPass
        ? `<span style="color:#66bb6a;">ALL CHECKS PASSED</span> (${elapsed}s)`
        : `<span style="color:#ef5350;">${failed} CHECK(s) FAILED</span> (${elapsed}s)`;
      document.getElementById('ocr-bar').style.background = allPass ? '#66bb6a' : '#ef5350';

      const checksDiv = document.getElementById('ocr-checks');
      checksDiv.innerHTML = checks.map(c => {
        const icon = c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '⚠' : '✗';
        const color = c.status === 'PASS' ? '#66bb6a' : c.status === 'WARN' ? '#ffa726' : '#ef5350';
        return `<div style="margin:2px 0;"><span style="color:${color};font-weight:700;">${icon}</span> ${c.name}: ${c.status}</div>`;
      }).join('');

      if (highlightedPdfPath) {
        document.getElementById('ocr-artifact').textContent = `Highlighted error PDF: ${highlightedPdfPath}`;
      }
    }, { checks: ocrResult.checks, elapsed, highlightedPdfPath: ocrResult.highlightedPdfPath || '' });

    // Hold the results on screen for the video
    await page.waitForTimeout(4000);

    // Remove overlay
    await page.evaluate(() => {
      const el = document.getElementById('ocr-overlay');
      if (el) el.remove();
    });

    // ── Log results ──
    const passed = ocrResult.checks.filter(c => c.status === 'PASS').length;
    const failed = ocrResult.checks.filter(c => c.status === 'FAIL').length;
    const warned = ocrResult.checks.filter(c => c.status === 'WARN').length;
    const total = ocrResult.checks.length;

    console.log(`\n    ── OCR Results (${elapsed}s) ──────────────────────────`);
    ocrResult.checks.forEach(c => {
      const icon = c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '⚠' : '✗';
      console.log(`      ${icon} ${c.name}: ${c.status} — ${c.note}`);
    });
    console.log(`    ────────────────────────────────────────────────────`);
    console.log(`    Total: ${total} | Pass: ${passed} | Fail: ${failed} | Warn: ${warned}`);
    console.log(`    OCR Extracted: ${JSON.stringify(ocrResult.extracted, null, 0).substring(0, 120)}...`);

    // Store in context for report
    ctx.validationResults = {
      ocrExtracted: ocrResult.extracted,
      ocrAnalysis: ocrResult.analysis,
      checks: ocrResult.checks,
      preflight: [{ name: 'PDF Downloaded', status: 'PASS', note: path.basename(documentPath) }],
      nativeMetadata: nativeCheck.checks,
      ocr: ocrResult.checks.filter(c =>
        c.name.includes('OCR') || c.name.includes('Blank') || c.name.includes('Non-OCR')
      ),
      metadata: ocrResult.checks.filter(c =>
        c.name.includes('Loadsheet') || c.name.includes('Contract') || c.name.includes('Rev &')
      ),
      quality: ocrResult.checks.filter(c =>
        c.name.includes('Draft') || c.name.includes('Markup') || c.name.includes('Signature') ||
        c.name.includes('Revision History') || c.name.includes('Security') || c.name.includes('Consistency')
      ),
      errors: ocrResult.checks.filter(c => c.status === 'FAIL'),
      highlightedPdfPath: ocrResult.highlightedPdfPath || null
    };

    logger.log(
      failed > 0 ? 'FAIL' : 'PASS',
      8.5,
      `VGL OCR: ${passed}/${total} checks passed for ${ctx.documentNumber} (${elapsed}s)`
    );

    if (failed > 0) {
      const failDetails = ocrResult.checks
        .filter(c => c.status === 'FAIL')
        .map(c => `${c.name}: ${c.note}`)
        .join('; ');
      return {
        status: 'FAIL',
        notes: `VGL OCR: ${failed} failure(s) — ${failDetails}`
      };
    }

    return {
      status: 'PASS',
      notes: `VGL OCR: All ${total} checks passed (${elapsed}s)`
    };

  } catch (error) {
    console.error(`    ✗ OCR Validation error: ${error.message}`);
    logger.fail(8.5, `OCR Error: ${error.message}`);

    ctx.validationResults = {
      checks: [],
      errors: [{ name: 'OCR System Error', status: 'FAIL', note: error.message }]
    };

    return {
      status: 'FAIL',
      notes: `OCR validation error: ${error.message}`
    };
  }
};

module.exports.nativeMetadataCheck = nativeMetadataCheck;
