/**
 * Rebuilds the HTML execution report from the existing last-run-log.json.
 * Run: node rebuild-report.js
 * Output: reports/report-<timestamp>.html
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const { generateReport, saveReport, writeValidationSummary } = require('./utils/reporter');

const LOG_PATH     = path.resolve(__dirname, 'reports/last-run-log.json');
const REPORTS_DIR  = path.resolve(__dirname, 'reports');
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

const log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));

// ── Helper: parse a step-7 check message into { label, pass, detail } ──
function parseCheckLine(msg) {
  const passMatch = msg.match(/^\s+✓ (.+?):\s+PASS\s+(?:—\s+(.*))?$/);
  if (passMatch) return { pass: true, label: passMatch[1].trim(), detail: (passMatch[2] || '').trim() };
  const failMatch = msg.match(/^\s+✗ (.+?):\s+FAIL\s+(?:—\s+(.*))?$/);
  if (failMatch) return { pass: false, label: failMatch[1].trim(), detail: (failMatch[2] || '').trim() };
  return null;
}

// ── Parse log into per-document result objects ──
const allDocResults = [];
let currentDoc = null;
let currentSection = 'quality'; // quality | loadsheet | transmittal

for (const entry of log) {
  const msg = entry.message || '';

  // New document starts when step 3 "Claimed <docNum>" appears
  if (entry.step === 3 && msg.startsWith('Claimed ')) {
    if (currentDoc) allDocResults.push(currentDoc);
    const docNum = msg.replace('Claimed ', '').trim();
    currentDoc = {
      documentNumber:   docNum,
      documentFileName: '',
      outcome:          'PASS',
      steps:            [],
      documentChecks:   [],
      validationResults: {}
    };
    currentSection = 'quality';
  }

  if (!currentDoc) continue;

  // Document file name (step 7)
  if (entry.step === 7 && msg.startsWith('Document file: ')) {
    currentDoc.documentFileName = msg.replace('Document file: ', '').trim();
  }

  // Section separators (step 7)
  if (entry.step === 7 && msg.includes('Document Quality Checks'))  currentSection = 'quality';
  if (entry.step === 7 && msg.includes('Loadsheet vs Document'))    currentSection = 'loadsheet';
  if (entry.step === 7 && msg.includes('Transmittal Readiness'))    currentSection = 'transmittal';

  // Check lines (step 7)
  if (entry.step === 7) {
    const check = parseCheckLine(msg);
    if (check) {
      const sectionLabel =
        currentSection === 'loadsheet'    ? 'Loadsheet' :
        currentSection === 'transmittal'  ? 'Transmittal' : 'Quality';
      currentDoc.documentChecks.push({ ...check, section: sectionLabel });
    }
  }

  // OCR result (step 8.5)
  if (entry.step === 8.5) {
    const ocrFail = entry.level === 'FAIL';
    const ocrMsg  = msg; // e.g. "VGL OCR: 15/16 checks passed for ... (6.1s)"
    currentDoc.steps.push({ status: ocrFail ? 'FAIL' : 'PASS', notes: ocrMsg });
    if (ocrFail) currentDoc.outcome = 'FAIL';
  }

  // Step-7 overall failure message
  if (entry.step === 7 && entry.level === 'fail') {
    // Non-fatal: doc continues but outcome is FAIL
    currentDoc.outcome = 'FAIL';
  }
}
if (currentDoc) allDocResults.push(currentDoc);

// Resolve start/end times from first and last log entries
const startTime = log[0]  ? log[0].timestamp  : new Date().toISOString();
const endTime   = log[log.length - 1] ? log[log.length - 1].timestamp : new Date().toISOString();

// ── Build flat results array for the workflow step table ──
const flatResults = [];
const flatScreenshots = [];

allDocResults.forEach((doc, idx) => {
  const prefix = `doc${String(idx + 1).padStart(2, '0')}`;
  const ssFiles = fs.existsSync(SCREENSHOTS_DIR)
    ? fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.startsWith(prefix))
    : [];

  doc.steps.forEach((s, si) => {
    flatResults.push({ ...s, notes: `[${doc.documentNumber}] ${s.notes || ''}` });
    const stepNames = ['claim','detail','datasheet','integrity','transmittal','validation','approve','final'];
    let ss = null;
    if (si < stepNames.length) {
      const f = ssFiles.find(f => f.includes(`-${stepNames[si]}.png`));
      if (f) ss = path.join(SCREENSHOTS_DIR, f);
    }
    if (!ss && doc.outcome === 'FAIL') {
      const f = ssFiles.find(f => f.includes('-FAIL.png'));
      if (f) ss = path.join(SCREENSHOTS_DIR, f);
    }
    flatScreenshots.push(ss);
  });
});

const provider    = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const systemMode  = provider === 'azure'
  ? `azure-${process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o'}`
  : 'gemini-2.5-flash';

const html = generateReport(flatResults, {
  botUser:        process.env.BOT_USERNAME || 'dc_bot',
  documentNumber: allDocResults.map(d => d.documentNumber).join(', '),
  startTime,
  endTime,
  screenshots:    flatScreenshots,
  allDocResults
});

const reportPath = saveReport(html, REPORTS_DIR);
writeValidationSummary(REPORTS_DIR, allDocResults, systemMode);

console.log('\n  Report generated successfully!');
console.log(`  Open: ${reportPath}`);
console.log('');

// Summary to console
const passed = allDocResults.filter(d => d.outcome === 'PASS');
const failed = allDocResults.filter(d => d.outcome === 'FAIL');
console.log(`  Documents: ${allDocResults.length} total — ${passed.length} passed, ${failed.length} failed`);
allDocResults.forEach(d => {
  const checks   = d.documentChecks || [];
  const failCount= checks.filter(c => !c.pass).length;
  const outcome  = d.outcome === 'PASS' ? '✓ PASS' : `✗ FAIL (${failCount} check${failCount !== 1 ? 's' : ''} failed)`;
  console.log(`    ${d.documentNumber}: ${outcome}`);
  checks.filter(c => !c.pass).forEach(c => {
    console.log(`      → [${c.section}] ${c.label}: ${c.detail}`);
  });
});
console.log('');
