/**
 * Generates sample OCR error-highlighted PDFs to demonstrate what the
 * AI OCR step produces when it finds document issues.
 *
 * Creates 3 error reports in bot/downloads/:
 *   1. VG-CP2-PIP-DWG-0112_RevA_errors.pdf — Non-OCR / image-only pages
 *   2. VG-CP2-CIV-CAL-0037_RevA_errors.pdf — Markup annotations found
 *   3. VG-CP2-PRO-PID-0044_Rev0_errors.pdf — DRAFT, wrong project, rev mismatch
 *
 * Run: node utils/generate-sample-ocr-reports.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '../downloads');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function writePdf(filename, buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filePath = path.join(OUT_DIR, filename);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    buildFn(doc);
    doc.end();
    stream.on('finish', () => {
      console.log(`  Created: ${filename} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
      resolve(filePath);
    });
    stream.on('error', reject);
  });
}

// ── Shared header ──
function addReportHeader(doc, docNumber, status) {
  doc.rect(0, 0, doc.page.width, 80).fill(status === 'FAIL' ? '#b71c1c' : '#2e7d32');
  doc.fontSize(18).fillColor('#fff').text('AI OCR — DOCUMENT VALIDATION REPORT', 40, 18, { width: doc.page.width - 80 });
  doc.fontSize(11).text(`Document: ${docNumber}  |  Status: ${status}  |  Engine: VGL OCR`, 40, 48, { width: doc.page.width - 80 });
  doc.fillColor('#333');
  doc.y = 95;
}

// ── Page break guard — ensures enough room or adds a new page ──
function ensureSpace(doc, needed) {
  const bottomMargin = 50;
  if (doc.y + needed > doc.page.height - bottomMargin) {
    doc.addPage();
    doc.y = 40;
  }
}

// ── Error highlight box ──
function addErrorBox(doc, title, details, page) {
  const boxH = 35 + (details.filter(d => d).length * 13);
  ensureSpace(doc, boxH);
  const startY = doc.y;
  doc.rect(40, startY, doc.page.width - 80, boxH).fillAndStroke('#fff5f5', '#c62828');
  doc.fontSize(10).fillColor('#c62828').font('Helvetica-Bold');
  doc.text(`FAIL  ${title}`, 50, startY + 8, { width: doc.page.width - 140 });
  if (page) {
    doc.fontSize(8).fillColor('#888').text(`Page ${page}`, doc.page.width - 120, startY + 10);
  }
  doc.font('Helvetica').fontSize(8.5).fillColor('#333');
  let y = startY + 24;
  details.forEach(d => {
    if (d) { doc.text(d, 55, y, { width: doc.page.width - 120 }); y += 13; }
  });
  doc.y = startY + boxH + 8;
}

// ── Pass check ──
function addPassBox(doc, title, detail) {
  ensureSpace(doc, 30);
  const startY = doc.y;
  doc.rect(40, startY, doc.page.width - 80, 26).fillAndStroke('#f0fff0', '#2e7d32');
  doc.fontSize(9).fillColor('#2e7d32').font('Helvetica-Bold');
  doc.text(`PASS  ${title}`, 50, startY + 7);
  doc.font('Helvetica').fontSize(7.5).fillColor('#666').text(detail, 300, startY + 8, { width: 220 });
  doc.fillColor('#333');
  doc.y = startY + 32;
}

// ── Warning box ──
function addWarnBox(doc, title, detail) {
  ensureSpace(doc, 30);
  const startY = doc.y;
  doc.rect(40, startY, doc.page.width - 80, 26).fillAndStroke('#fffde7', '#f57c00');
  doc.fontSize(9).fillColor('#f57c00').font('Helvetica-Bold');
  doc.text(`WARN  ${title}`, 50, startY + 7);
  doc.font('Helvetica').fontSize(7.5).fillColor('#666').text(detail, 300, startY + 8, { width: 220 });
  doc.fillColor('#333');
  doc.y = startY + 32;
}

// ── Section heading ──
function addSection(doc, title) {
  ensureSpace(doc, 30);
  doc.moveDown(0.2);
  doc.fontSize(11).fillColor('#003b5c').font('Helvetica-Bold').text(title);
  doc.font('Helvetica').fillColor('#333');
  doc.moveDown(0.2);
}

// ── Extracted metadata table ──
function addMetadataTable(doc, data) {
  const entries = Object.entries(data);
  ensureSpace(doc, entries.length * 11 + 10);
  doc.fontSize(7).font('Courier');
  entries.forEach(([k, v]) => {
    const isNA = v === 'NA' || v === 'NOT FOUND' || v === 'NOT SPECIFIED';
    doc.fillColor(isNA ? '#c62828' : '#333');
    doc.text(`  ${k.padEnd(22)} : ${v}`);
  });
  doc.font('Helvetica').fillColor('#333');
  doc.moveDown(0.3);
}

// ══════════════════════════════════════════════════════════════════════════
// Report 1: PIP-DWG-0112 — Image-only scanned document
// ══════════════════════════════════════════════════════════════════════════
async function createReport1() {
  await writePdf('VG-CP2-PIP-DWG-0112_RevA_errors.pdf', (doc) => {
    addReportHeader(doc, 'VG-CP2-PIP-DWG-0112', 'FAIL');

    addSection(doc, 'Phase 1: AI Metadata Extraction');
    addPassBox(doc, 'AI OCR Extraction', 'Extracted 6 of 14 fields (partial)');

    addMetadataTable(doc, {
      document_number: 'VG-CP2-PIP-DWG-0112',
      document_title: 'Piping Isometric - Scanned Drawing Area 400',
      revision: 'A',
      issue_date: '05 April 2026',
      from_organisation: 'WOR - Worley',
      project: 'Venture Global CP2 LNG - C2 EPC-BOP',
      classification: 'NOT FOUND',
      security_code: 'NOT FOUND',
      issue_purpose: 'NOT FOUND',
      discipline_code: 'NOT FOUND',
      document_type: 'NOT FOUND',
      prepared_by: 'NOT FOUND',
    });

    addSection(doc, 'Phase 2: Cross-Page Consistency Analysis');
    addPassBox(doc, 'Blank Page Detection', 'No blank pages found');

    addErrorBox(doc, 'Non-OCR Page Detection', [
      'Page 2: IMAGE ONLY — scanned drawing with no searchable text layer.',
      'Page 3: IMAGE ONLY — scanned drawing with no searchable text layer.',
      'These pages contain embedded raster images but no OCR text.',
      'Action Required: Run OCR processing (e.g. Azure Document Intelligence) on scanned pages.'
    ], '2-3');

    addPassBox(doc, 'Draft Watermark Check', 'No draft watermarks found');
    addPassBox(doc, 'Markup Annotations Check', 'No markups detected');
    addWarnBox(doc, 'Signature Block Present', 'No approval signatures found');
    addWarnBox(doc, 'Revision History Present', 'No revision history section');

    addErrorBox(doc, 'Security Classification', [
      'No security classification found in document.',
      'Expected: "Company Use", "Confidential", "Restricted", or "Public".',
      'Security classification is a mandatory field per VGL document control procedures.'
    ]);

    addSection(doc, 'Phase 3: Loadsheet Cross-Validation');
    addPassBox(doc, 'Loadsheet: Document Number', 'Match: VG-CP2-PIP-DWG-0112');
    addPassBox(doc, 'Loadsheet: Document Title', 'Title matches loadsheet');
    addPassBox(doc, 'Loadsheet: Revision', 'Revision matches: A');

    addSection(doc, 'Summary');
    doc.fontSize(10);
    doc.text('Total Checks: 14  |  Passed: 7  |  Failed: 3  |  Warnings: 4');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#c62828').font('Helvetica-Bold');
    doc.text('VERDICT: REJECTED — Document contains non-OCR image pages and missing mandatory fields.');
    doc.font('Helvetica').fillColor('#333');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Report 2: CIV-CAL-0037 — Document with reviewer markups
// ══════════════════════════════════════════════════════════════════════════
async function createReport2() {
  await writePdf('VG-CP2-CIV-CAL-0037_RevA_errors.pdf', (doc) => {
    addReportHeader(doc, 'VG-CP2-CIV-CAL-0037', 'FAIL');

    addSection(doc, 'Phase 1: AI Metadata Extraction');
    addPassBox(doc, 'AI OCR Extraction', 'Extracted 12 of 14 fields via AI OCR');

    addMetadataTable(doc, {
      document_number: 'VG-CP2-CIV-CAL-0037',
      document_title: 'Foundation Loading Analysis - Area 300',
      revision: 'Rev A',
      issue_date: '02 April 2026',
      classification: 'Company Use',
      issue_purpose: 'IFR - Issued for Review',
      security_code: 'Company Use',
      discipline_code: 'CIV - Civil',
      document_type: 'CAL - Calculation',
      from_organisation: 'WOR - Worley Group Pty Ltd',
      project: 'Venture Global CP2 LNG - C2 EPC-BOP',
      prepared_by: 'H. Tanaka',
    });

    addSection(doc, 'Phase 2: Cross-Page Consistency Analysis');
    addPassBox(doc, 'Blank Page Detection', 'No blank pages');
    addPassBox(doc, 'Non-OCR Page Detection', 'All 4 pages have searchable text');
    addPassBox(doc, 'Draft Watermark Check', 'No DRAFT markers found');

    addErrorBox(doc, 'Markup Annotations Detected', [
      'Page 3: [COMMENT] Reviewer F. Al-Rashid: "Please double-check the soil',
      '         bearing capacity assumption of 150 kPa"',
      'Page 3: [MARKUP] Section 2.3 highlighted for further review by structural team.',
      'Page 3: /Annots annotation object detected — PDF contains embedded annotations.',
      '',
      'Review markups must be removed before document submission.',
      'The document appears to be in draft review state, not final.'
    ], '3');

    addPassBox(doc, 'Signature Block Present', 'Prepared/Reviewed signatures found');
    addPassBox(doc, 'Revision History Present', 'Rev A documented');
    addPassBox(doc, 'Security Classification', 'Company Use confirmed');
    addPassBox(doc, 'Cross-Page Consistency', 'All metadata consistent across 4 pages');

    addSection(doc, 'Phase 3: Loadsheet Cross-Validation');
    addPassBox(doc, 'Loadsheet: Document Number', 'Match: VG-CP2-CIV-CAL-0037');
    addPassBox(doc, 'Loadsheet: Document Title', 'Title matches loadsheet');
    addPassBox(doc, 'Loadsheet: Revision', 'Revision matches: A');
    addPassBox(doc, 'Loadsheet: Discipline', 'Discipline matches: CIV');

    addSection(doc, 'Phase 4: Contract / Project Validation');
    addPassBox(doc, 'Contract/Project Reference', 'CP2 contract reference confirmed');
    addPassBox(doc, 'Rev & Issue Purpose Alignment', 'Rev A + IFR are aligned');

    addSection(doc, 'Summary');
    doc.fontSize(10);
    doc.text('Total Checks: 16  |  Passed: 14  |  Failed: 1  |  Warnings: 0');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#c62828').font('Helvetica-Bold');
    doc.text('VERDICT: REJECTED — Document contains reviewer markup annotations that must be removed.');
    doc.font('Helvetica').fillColor('#333');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Report 3: PRO-PID-0044 — Multi-failure: DRAFT, wrong project, rev mismatch
// ══════════════════════════════════════════════════════════════════════════
async function createReport3() {
  await writePdf('VG-CP2-PRO-PID-0044_Rev0_errors.pdf', (doc) => {
    addReportHeader(doc, 'VG-CP2-PRO-PID-0044', 'FAIL');

    addSection(doc, 'Phase 1: AI Metadata Extraction');
    addPassBox(doc, 'AI OCR Extraction', 'Extracted 8 of 14 fields (partial)');

    addMetadataTable(doc, {
      document_number: 'NA',
      document_title: 'P&ID - Condensate Recovery Unit',
      revision: 'Rev 0',
      issue_date: 'March 2026',
      classification: 'NOT FOUND',
      issue_purpose: 'AFC - Approved for Construction',
      security_code: 'NOT FOUND',
      discipline_code: 'PRO - Process',
      document_type: 'PID',
      from_organisation: 'KBR',
      project: 'Cameron LNG Expansion',
      contract_reference: 'NOT SPECIFIED',
      prepared_by: 'T. Wilson',
    });

    addSection(doc, 'Phase 2: Cross-Page Consistency Analysis');
    addPassBox(doc, 'Blank Page Detection', 'No blank pages');
    addPassBox(doc, 'Non-OCR Page Detection', 'All pages have text');

    addErrorBox(doc, 'Draft Watermark Detected', [
      'Page 1: Large "DRAFT" watermark text found.',
      'Page 1: "DRAFT - NOT FOR CONSTRUCTION" statement present.',
      'Page 2: "DRAFT" watermark repeated on notes page.',
      'Documents with DRAFT status cannot be submitted for construction approval.'
    ], '1-2');

    addPassBox(doc, 'Markup Annotations Check', 'No markups detected');
    addWarnBox(doc, 'Signature Block Present', 'Only "Prepared by" found — missing Reviewed/Approved');
    addWarnBox(doc, 'Revision History Present', 'No revision history section found');

    addErrorBox(doc, 'Security Classification Missing', [
      'No security classification found in document.',
      'Document explicitly states: "Security classification not assigned yet."',
      'This is a mandatory field per VGL document control procedures.'
    ]);

    addErrorBox(doc, 'Cross-Page Consistency: Revision (Page 2)', [
      'MISMATCH DETECTED:',
      '  Page 1 Cover:  Revision: Rev 0',
      '  Page 2 Notes:  Revision: Rev 4',
      '',
      'The revision number on page 2 contradicts the cover page.',
      'This is a critical discrepancy that must be resolved.'
    ], '2');

    addErrorBox(doc, 'Cross-Page Consistency: Date (Page 2)', [
      'MISMATCH DETECTED:',
      '  Page 1 Cover:  Date: March 2026',
      '  Page 2 Notes:  Date: January 2025',
      '',
      'The document date on page 2 is over a year earlier than the cover page.'
    ], '2');

    addSection(doc, 'Phase 3: Loadsheet Cross-Validation');
    addPassBox(doc, 'Loadsheet: Document Title', 'Title matches');
    addPassBox(doc, 'Loadsheet: Revision', 'Revision 0 matches loadsheet');
    addPassBox(doc, 'Loadsheet: Discipline', 'PRO matches Process');

    addSection(doc, 'Phase 4: Contract / Project Validation');

    addErrorBox(doc, 'Wrong Contract/Project Reference', [
      'Document states PROJECT: "Cameron LNG Expansion"',
      'Expected: "Venture Global CP2 LNG" or "C2 EPC-BOP"',
      '',
      'This document appears to be submitted under the WRONG contract.',
      'Cameron LNG is a different facility — not the CP2 project.'
    ]);

    if (doc.y > 650) doc.addPage();

    addErrorBox(doc, 'Rev 0 + AFC Misalignment', [
      'Revision 0 cannot be "Approved for Construction" (AFC).',
      'Rev 0 is typically "Issued for Review" (IFR) or "Issued for Information" (IFI).',
      'AFC status requires at least one prior review cycle (Rev A or higher).'
    ]);

    addSection(doc, 'Summary');
    doc.fontSize(10);
    doc.text('Total Checks: 18  |  Passed: 7  |  Failed: 6  |  Warnings: 2');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#c62828').font('Helvetica-Bold');
    doc.text('VERDICT: REJECTED — 6 critical failures detected:');
    doc.fontSize(9).font('Helvetica');
    doc.text('  1. DRAFT watermark present');
    doc.text('  2. Security classification missing');
    doc.text('  3. Revision mismatch across pages (Rev 0 vs Rev 4)');
    doc.text('  4. Date mismatch across pages (2026 vs 2025)');
    doc.text('  5. Wrong project (Cameron LNG instead of CP2)');
    doc.text('  6. Rev 0 + AFC issue purpose misalignment');
    doc.fillColor('#333');
  });
}

// ── MAIN ──
async function main() {
  console.log('Generating sample AI OCR error reports...\n');
  await createReport1();
  await createReport2();
  await createReport3();
  console.log('\nDone. Error-highlighted PDFs saved to bot/downloads/');
}

main().catch(err => { console.error(err); process.exit(1); });
