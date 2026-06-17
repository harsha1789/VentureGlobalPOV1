/**
 * Generates rich test PDF files for document control validation testing.
 *
 * Creates 5 PDFs in the ./test-pdfs/ directory:
 *   1. VG-CP2-MEC-DWG-0001_RevA — VALID: complete metadata, signatures, rev history, structure
 *   2. VG-CP2-ELE-SPC-0042_RevB — VALID: complete with Rev B and full revision history
 *   3. VG-CP2-PIP-DWG-0112_RevA — NEGATIVE: image-only scanned pages (no text layer), mixed with a text page
 *   4. VG-CP2-CIV-CAL-0037_RevA — NEGATIVE: contains reviewer markups and annotations
 *   5. VG-CP2-PRO-PID-0044_Rev0 — NEGATIVE: DRAFT watermark, wrong project, Rev 0 + AFC, missing fields
 *
 * Run: node generate-test-pdfs.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, 'test-pdfs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Runtime date helpers — stamped into each PDF to prove it was generated on this run
const NOW = new Date();
const RUNTIME_DATE_LONG = NOW.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });  // e.g., "14 April 2026"
const RUNTIME_DATE_SHORT = NOW.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'); // "14-Apr-2026"
const RUNTIME_STAMP = NOW.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

function addRuntimeStamp(doc) {
  const y = 95;
  doc.save();
  doc.fontSize(8).fillColor('#c62828').font('Helvetica-Bold')
    .text(`Generated at runtime: ${RUNTIME_STAMP}`, 50, y, { align: 'right', width: doc.page.width - 100 });
  doc.restore();
  doc.fillColor('#333').font('Helvetica');
}

function writePdf(filename, buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
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

// ── Helper: VGL branded header block ──
function addCoverHeader(doc, title) {
  // Blue banner
  doc.rect(0, 0, doc.page.width, 90).fill('#003b5c');
  doc.fontSize(22).fillColor('#ffffff').text('ENGINEERING PROJECT — C2', 50, 25, { align: 'center', width: doc.page.width - 100 });
  doc.fontSize(13).text(title || 'CONTRACT DOCUMENT', 50, 55, { align: 'center', width: doc.page.width - 100 });
  doc.fillColor('#333');
  doc.y = 110;
}

// ── Helper: metadata fields table ──
function addMetadataTable(doc, fields) {
  const startY = doc.y;
  doc.rect(50, startY, doc.page.width - 100, fields.length * 22 + 10).stroke('#003b5c');
  doc.y = startY + 8;
  doc.fontSize(9.5);
  fields.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fillColor('#003b5c').text(`${label}:`, 60, doc.y, { continued: true, width: 190 });
    doc.font('Helvetica').fillColor('#333').text(`  ${value}`, { width: 280 });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.5);
}

// ── Helper: page footer ──
function addFooter(doc, docNumber, rev, secClass) {
  const y = doc.page.height - 35;
  doc.save();
  doc.moveTo(50, y - 5).lineTo(doc.page.width - 50, y - 5).stroke('#ccc');
  doc.fontSize(7).fillColor('#888')
    .text(`Document: ${docNumber}  |  Revision: ${rev}  |  ${secClass}  |  Engineering Project`, 50, y, {
      align: 'center', width: doc.page.width - 100
    });
  doc.restore();
}

// ── Helper: draw a fake engineering diagram (vector shapes) ──
function drawEngineeringDiagram(doc, label) {
  const cx = doc.page.width / 2;
  doc.save();
  // Title block outline
  doc.rect(60, doc.y, doc.page.width - 120, 350).stroke('#999');

  const baseY = doc.y + 20;

  // Equipment boxes
  doc.rect(100, baseY + 30, 80, 50).stroke('#333');
  doc.fontSize(7).fillColor('#333').text('PUMP P-101', 105, baseY + 50);

  doc.rect(250, baseY + 30, 80, 50).stroke('#333');
  doc.fontSize(7).text('HX E-201', 260, baseY + 50);

  doc.rect(400, baseY + 30, 80, 50).stroke('#333');
  doc.fontSize(7).text('VESSEL V-301', 405, baseY + 50);

  // Pipe lines connecting equipment
  doc.moveTo(180, baseY + 55).lineTo(250, baseY + 55).stroke('#003b5c');
  doc.moveTo(330, baseY + 55).lineTo(400, baseY + 55).stroke('#003b5c');

  // Flow arrows
  doc.moveTo(210, baseY + 50).lineTo(220, baseY + 55).lineTo(210, baseY + 60).fill('#003b5c');
  doc.moveTo(360, baseY + 50).lineTo(370, baseY + 55).lineTo(360, baseY + 60).fill('#003b5c');

  // Instrument circles
  doc.circle(215, baseY + 90, 12).stroke('#666');
  doc.fontSize(6).fillColor('#666').text('FT', 210, baseY + 87);
  doc.text('101', 210, baseY + 94);

  doc.circle(365, baseY + 90, 12).stroke('#666');
  doc.fontSize(6).text('TT', 360, baseY + 87);
  doc.text('201', 360, baseY + 94);

  // Valve symbols
  doc.moveTo(140, baseY + 120).lineTo(160, baseY + 130).lineTo(140, baseY + 140).closePath().stroke('#333');
  doc.moveTo(160, baseY + 120).lineTo(140, baseY + 130).lineTo(160, baseY + 140).closePath().stroke('#333');

  // Legend box
  doc.rect(60, baseY + 180, 200, 80).stroke('#999');
  doc.fontSize(8).fillColor('#003b5c').text('LEGEND', 70, baseY + 185);
  doc.fontSize(7).fillColor('#333');
  doc.text('── Process Line', 70, baseY + 200);
  doc.text('⊗  Instrument', 70, baseY + 215);
  doc.text('▷◁ Control Valve', 70, baseY + 230);

  // Notes
  doc.fontSize(8).fillColor('#003b5c').text(label || 'ENGINEERING DRAWING', 300, baseY + 190);
  doc.fontSize(7).fillColor('#666').text('Scale: NTS', 300, baseY + 210);
  doc.text('Sheet: 1 of 1', 300, baseY + 225);

  doc.restore();
  doc.y = doc.y + 370;
}

// ── Helper: draw a rasterized "scanned" image block (PNG buffer embedded in PDF) ──
function drawScannedImageBlock(doc, label, width, height) {
  // Create an in-memory PNG-like bitmap via pdfkit's image from buffer
  // We'll draw shapes and then rasterize the entire page appearance using doc.image
  // Since we can't truly rasterize, we'll create a dense pattern of shapes that looks scanned

  const startY = doc.y + 10;
  const w = width || (doc.page.width - 120);
  const h = height || 400;

  // Background with slight noise appearance (gray fill)
  doc.save();
  doc.rect(60, startY, w, h).fill('#f5f3ef');

  // Simulate scan artifacts — random gray dots/lines
  for (let i = 0; i < 80; i++) {
    const x = 70 + Math.random() * (w - 20);
    const y = startY + 10 + Math.random() * (h - 20);
    const gray = 0.7 + Math.random() * 0.25;
    doc.circle(x, y, 0.5 + Math.random() * 1).fill(`rgb(${gray * 255}, ${gray * 255}, ${gray * 255})`);
  }

  // Dense line pattern (like a scanned engineering drawing)
  doc.strokeColor('#444').lineWidth(0.5);
  // Title block border
  doc.rect(70, startY + 10, w - 20, h - 20).stroke();
  doc.rect(70, startY + h - 80, w - 20, 70).stroke();

  // Horizontal dividers in title block
  for (let r = 0; r < 3; r++) {
    doc.moveTo(70, startY + h - 80 + r * 23).lineTo(70 + w - 20, startY + h - 80 + r * 23).stroke();
  }
  // Vertical dividers
  doc.moveTo(70 + (w - 20) / 2, startY + h - 80).lineTo(70 + (w - 20) / 2, startY + h - 10).stroke();

  // Piping route lines (thicker, like scanned drawing)
  doc.lineWidth(1.5).strokeColor('#222');
  doc.moveTo(120, startY + 100).lineTo(300, startY + 100).lineTo(300, startY + 200)
    .lineTo(450, startY + 200).stroke();
  doc.moveTo(200, startY + 150).lineTo(200, startY + 250).lineTo(350, startY + 250).stroke();

  // Equipment rectangles
  doc.lineWidth(1).strokeColor('#333');
  doc.rect(120, startY + 70, 50, 60).stroke();
  doc.rect(280, startY + 170, 50, 60).stroke();
  doc.rect(420, startY + 170, 60, 60).stroke();

  // Dimension lines
  doc.lineWidth(0.3).strokeColor('#555');
  doc.moveTo(120, startY + 50).lineTo(300, startY + 50).stroke();
  doc.moveTo(120, startY + 47).lineTo(120, startY + 53).stroke();
  doc.moveTo(300, startY + 47).lineTo(300, startY + 53).stroke();

  // Label in center (but this is just shapes, NO selectable text via doc.text)
  // The key point: this page has NO doc.text() calls → pdf-parse won't extract text

  doc.restore();
  doc.y = startY + h + 15;
}

// ══════════════════════════════════════════════════════════════════════════
// 1. VALID COMPLETE DOCUMENT (all checks should PASS)
// ══════════════════════════════════════════════════════════════════════════
async function createDoc1_ValidComplete() {
  await writePdf('VG-CP2-MEC-DWG-0001_RevA.pdf', (doc) => {
    // ── Page 1: Cover ──
    addCoverHeader(doc, 'CONTRACT DOCUMENT');
    addRuntimeStamp(doc);
    doc.moveDown(0.5);
    addMetadataTable(doc, [
      ['CONTRACT NUMBER', 'VG-CP2-MEC-DWG-0001'],
      ['DOCUMENT TITLE', 'Mechanical Equipment Layout — Train 1'],
      ['REVISION NUMBER', 'Rev A'],
      ['ISSUE PURPOSE', 'IFR — Issued for Review'],
      ['SECURITY CLASSIFICATION', 'Company Use'],
      ['DOCUMENT TYPE', 'DWG — Drawing'],
      ['DISCIPLINE CODE', 'MEC — Mechanical'],
      ['DOCUMENT DATE', RUNTIME_DATE_LONG],
      ['FROM ORGANISATION', 'WOR — Worley Group Pty Ltd'],
      ['TO ORGANISATION', 'PRJ — Project Owner'],
      ['PROJECT', 'Engineering Project — C2 EPC-BOP'],
    ]);
    doc.moveDown(0.5);
    drawEngineeringDiagram(doc, 'MECHANICAL EQUIPMENT LAYOUT — TRAIN 1');
    addFooter(doc, 'VG-CP2-MEC-DWG-0001', 'A', 'Company Use');

    // ── Page 2: Second Cover ──
    doc.addPage();
    addCoverHeader(doc, 'DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#003b5c').text('SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('SDx Project Area:           C2');
    doc.text('Contract Reference:         C2 EPC-BOP');
    doc.text('Transmittal Reference:      TRN-C2-WOR-2026-0001');
    doc.text('Previous Revision:          — (First Issue)');
    doc.text('Page Count:                 4 pages');
    doc.text('Language:                   English');
    doc.text('File Name:                  VG-CP2-MEC-DWG-0001_RevA.pdf');
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('APPROVAL SIGNATURES');
    doc.font('Helvetica').moveDown(0.3);
    doc.text(`Prepared by:    J. Smith                 Date: ${RUNTIME_DATE_SHORT}`);
    doc.text(`Reviewed by:    A. Kumar                 Date: ${RUNTIME_DATE_SHORT}`);
    doc.text(`Approved by:    M. Brennan               Date: ${RUNTIME_DATE_SHORT}`);
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#003b5c').text('REVISION HISTORY');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#333').font('Courier');
    doc.text('Rev    Date           Description                         Author');
    doc.text('───    ──────────     ───────────────────────────────     ──────────');
    doc.text(`A      ${RUNTIME_DATE_SHORT}    First Issue — Issued for Review     J. Smith`);
    doc.font('Helvetica');
    addFooter(doc, 'VG-CP2-MEC-DWG-0001', 'A', 'Company Use');

    // ── Page 3: Technical Content ──
    doc.addPage();
    doc.fontSize(14).fillColor('#003b5c').text('1. SCOPE OF WORK');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('This drawing defines the mechanical equipment layout for Train 1 of the Engineering Project facility under Contract C2 EPC-BOP. All equipment shall be installed in accordance with project engineering documents and applicable codes and standards.');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('2. REFERENCES');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('All equipment installation shall comply with:');
    doc.text('  • ASME B31.3 — Process Piping');
    doc.text('  • API 610 — Centrifugal Pumps');
    doc.text('  • Project Specification VGL-MEC-SPE-001');
    doc.text('  • Vendor data books as supplied');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('3. ACCEPTANCE CRITERIA');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('Equipment alignment tolerances shall be per manufacturer recommendations. Foundation bolt torque values per project standard VGL-MEC-STD-003.');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('4. MATERIAL SPECIFICATION');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('All carbon steel components: ASTM A36 / A106 Grade B');
    doc.text('Stainless steel: ASTM A312 TP316L');
    doc.text('Bolting: ASTM A193 B7 / A194 2H');
    addFooter(doc, 'VG-CP2-MEC-DWG-0001', 'A', 'Company Use');

    // ── Page 4: End ──
    doc.addPage();
    doc.moveDown(10);
    doc.fontSize(16).fillColor('#003b5c').text('═══════════════════════════════════', { align: 'center' });
    doc.text('END OF DOCUMENT', { align: 'center' });
    doc.text('═══════════════════════════════════', { align: 'center' });
    addFooter(doc, 'VG-CP2-MEC-DWG-0001', 'A', 'Company Use');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 2. VALID DOCUMENT REV B (all checks should PASS)
// ══════════════════════════════════════════════════════════════════════════
async function createDoc2_ValidRevB() {
  await writePdf('VG-CP2-ELE-SPC-0042_RevB.pdf', (doc) => {
    // ── Page 1: Cover ──
    addCoverHeader(doc, 'CONTRACT DOCUMENT');
    doc.moveDown(0.5);
    addMetadataTable(doc, [
      ['CONTRACT NUMBER', 'VG-CP2-ELE-SPC-0042'],
      ['DOCUMENT TITLE', 'Electrical Single Line Diagram — Substation B'],
      ['REVISION NUMBER', 'Rev B'],
      ['ISSUE PURPOSE', 'IFC — Issued for Construction'],
      ['SECURITY CLASSIFICATION', 'Company Use'],
      ['DOCUMENT TYPE', 'SLD — Single Line Diagram'],
      ['DISCIPLINE CODE', 'ELE — Electrical'],
      ['DOCUMENT DATE', '03 April 2026'],
      ['FROM ORGANISATION', 'KBR — KBR Inc.'],
      ['TO ORGANISATION', 'PRJ — Project Owner'],
      ['PROJECT', 'Engineering Project — C2 EPC-BOP'],
    ]);
    doc.moveDown(0.5);
    drawEngineeringDiagram(doc, 'ELECTRICAL SLD — SUBSTATION B');
    addFooter(doc, 'VG-CP2-ELE-SPC-0042', 'B', 'Company Use');

    // ── Page 2: Second Cover ──
    doc.addPage();
    addCoverHeader(doc, 'DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#003b5c').text('SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('SDx Project Area:           C2');
    doc.text('Contract Reference:         C2 EPC-BOP');
    doc.text('File Name:                  VG-CP2-ELE-SPC-0042_RevB.pdf');
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('APPROVAL SIGNATURES');
    doc.font('Helvetica').moveDown(0.3);
    doc.text('Prepared by:    A. Jones                 Date: 03-Apr-2026');
    doc.text('Reviewed by:    R. Mehta                 Date: 04-Apr-2026');
    doc.text('Approved by:    D. Chang                 Date: 05-Apr-2026');
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#003b5c').text('REVISION HISTORY');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#333').font('Courier');
    doc.text('Rev    Date           Description                              Author');
    doc.text('───    ──────────     ──────────────────────────────────────   ─────────');
    doc.text('B      03-Apr-2026    Issued for Construction                  A. Jones');
    doc.text('A      15-Feb-2026    First Issue — Issued for Review          A. Jones');
    doc.font('Helvetica');
    addFooter(doc, 'VG-CP2-ELE-SPC-0042', 'B', 'Company Use');

    // ── Page 3: Content ──
    doc.addPage();
    doc.fontSize(14).fillColor('#003b5c').text('1. SCOPE');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('This single line diagram covers Substation B power distribution layout for the Engineering Project facility under Contract C2 EPC-BOP. Power distribution at 11kV and 415V levels.');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('2. DESIGN BASIS');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('All switchgear rated per IEC 62271 standards.');
    doc.text('Transformer rating: 11kV/415V, 2500 kVA, ONAN cooling.');
    doc.text('Bus coupler: 2000A, 50kA rated.');
    addFooter(doc, 'VG-CP2-ELE-SPC-0042', 'B', 'Company Use');

    // ── Page 4: End ──
    doc.addPage();
    doc.moveDown(10);
    doc.fontSize(16).fillColor('#003b5c').text('═══════════════════════════════════', { align: 'center' });
    doc.text('END OF DOCUMENT', { align: 'center' });
    doc.text('═══════════════════════════════════', { align: 'center' });
    addFooter(doc, 'VG-CP2-ELE-SPC-0042', 'B', 'Company Use');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 3. IMAGE-ONLY SCANNED PDF — no text layer on scanning pages
//    Page 1: text cover (partial metadata, missing fields)
//    Page 2: IMAGE-ONLY scanned drawing (no doc.text calls)
//    Page 3: IMAGE-ONLY scanned drawing (no doc.text calls)
//    This should FAIL: Non-OCR pages, missing security classification, etc.
// ══════════════════════════════════════════════════════════════════════════
async function createDoc3_ImageOnly() {
  await writePdf('VG-CP2-PIP-DWG-0112_RevA.pdf', (doc) => {
    // ── Page 1: Minimal text cover ──
    addCoverHeader(doc, 'SCANNED DOCUMENT');
    addRuntimeStamp(doc);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('CONTRACT NUMBER: VG-CP1-PIP-DWG-9999');
    doc.text('TITLE: Piping Isometric — Scanned Drawing Area 400');
    doc.text('REVISION NUMBER: Rev A');
    doc.text(`DATE: ${RUNTIME_DATE_LONG}`);
    doc.text('FROM: WOR — Worley');
    doc.text('PROJECT: Engineering Project — C2 EPC-BOP');
    doc.moveDown(1);
    doc.fontSize(9).fillColor('#c62828');
    doc.text('NOTE: Page 2 is a scanned image without OCR text layer.');
    doc.text('This page requires OCR processing for text searchability.');
    addFooter(doc, 'VG-CP2-PIP-DWG-0112', 'A', '');

    // ── Page 2: SCANNED IMAGE — NO TEXT (only VG.png embedded, no doc.text calls) ──
    doc.addPage();
    const vgImg = path.join(OUT_DIR, 'VG.png');
    if (fs.existsSync(vgImg)) {
      // Center VG.png on the page; preserve aspect ratio
      const imgWidth = doc.page.width - 120;
      doc.image(vgImg, 60, 120, { width: imgWidth });
    }
    // No doc.text() calls — image-only page
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 4. DOCUMENT WITH REVIEW MARKUPS AND ANNOTATIONS
//    Should FAIL: has_markups = true, annotation text embedded
// ══════════════════════════════════════════════════════════════════════════
async function createDoc4_WithMarkups() {
  await writePdf('VG-CP2-CIV-CAL-0037_RevA.pdf', (doc) => {
    // ── Page 1: Cover ──
    addCoverHeader(doc, 'CONTRACT DOCUMENT');
    doc.moveDown(0.5);
    addMetadataTable(doc, [
      ['CONTRACT NUMBER', 'VG-CP2-CIV-CAL-0037'],
      ['DOCUMENT TITLE', 'Foundation Loading Analysis — Area 300'],
      ['REVISION NUMBER', 'Rev A'],
      ['ISSUE PURPOSE', 'IFR — Issued for Review'],
      ['SECURITY CLASSIFICATION', 'Company Use'],
      ['DOCUMENT TYPE', 'CAL — Calculation'],
      ['DISCIPLINE CODE', 'CIV — Civil'],
      ['DOCUMENT DATE', '02 April 2026'],
      ['FROM ORGANISATION', 'WOR — Worley Group Pty Ltd'],
      ['PROJECT', 'Engineering Project — C2 EPC-BOP'],
    ]);
    addFooter(doc, 'VG-CP2-CIV-CAL-0037', 'A', 'Company Use');

    // ── Page 2: Second Cover ──
    doc.addPage();
    addCoverHeader(doc, 'DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#003b5c').text('SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('SDx Project Area:       C2');
    doc.text('Contract Reference:     C2 EPC-BOP');
    doc.moveDown(1);
    doc.text('Prepared by:    H. Tanaka                Date: 02-Apr-2026');
    doc.text('Reviewed by:    F. Al-Rashid              Date: 03-Apr-2026');
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#003b5c').text('REVISION HISTORY');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#333').font('Courier');
    doc.text('Rev    Date           Description              Author');
    doc.text('───    ──────────     ──────────────────────   ──────────');
    doc.text('A      02-Apr-2026    First Issue              H. Tanaka');
    doc.font('Helvetica');
    addFooter(doc, 'VG-CP2-CIV-CAL-0037', 'A', 'Company Use');

    // ── Page 3: Content WITH MARKUP ANNOTATIONS ──
    doc.addPage();
    doc.fontSize(14).fillColor('#003b5c').text('1. INTRODUCTION');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('This calculation report presents the foundation loading analysis for Area 300 under Contract C2 EPC-BOP. All calculations follow IBC 2021 and project specification VGL-CIV-STD-004.');
    doc.moveDown(0.8);

    // ── REVIEWER MARKUP ANNOTATIONS (these make the document FAIL) ──
    doc.rect(55, doc.y - 5, doc.page.width - 110, 90).fill('#fff3f3').stroke('#c62828');
    doc.fontSize(10).fillColor('#c62828').font('Helvetica-Bold');
    doc.text('[COMMENT] Reviewer F. Al-Rashid:', 65, doc.y + 5);
    doc.font('Helvetica').fontSize(9);
    doc.text('Please double-check the soil bearing capacity assumption of 150 kPa — geotechnical report indicates 120 kPa for this area.', 65);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('[MARKUP] Section 2.3 highlighted for further review by structural team.', 65);
    doc.moveDown(0.3);
    doc.font('Courier').fontSize(8);
    doc.text('/Annots [<< /Type /Annot /Subtype /Text /Contents (Need to verify load case LC-04 against seismic criteria) >>]', 65);
    doc.font('Helvetica').fillColor('#333');
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#003b5c').text('2. DESIGN INPUTS');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('Soil bearing capacity: 150 kPa (assumed — pending geotechnical confirmation)');
    doc.text('Seismic zone: Zone 2A per IBC 2021');
    doc.text('Foundation type: Isolated pad footings with grade beams');
    doc.text('Concrete grade: C40/50 (40 MPa cylinder / 50 MPa cube)');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('3. RESULTS');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('All foundations satisfy the required safety factor of 2.5 under combined loading.');
    doc.text('Maximum settlement: 12mm (allowable: 25mm).');
    addFooter(doc, 'VG-CP2-CIV-CAL-0037', 'A', 'Company Use');

    // ── Page 4: End ──
    doc.addPage();
    doc.moveDown(10);
    doc.fontSize(16).fillColor('#003b5c').text('═══════════════════════════════════', { align: 'center' });
    doc.text('END OF DOCUMENT', { align: 'center' });
    doc.text('═══════════════════════════════════', { align: 'center' });
    addFooter(doc, 'VG-CP2-CIV-CAL-0037', 'A', 'Company Use');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 5. MULTI-FAILURE DOCUMENT: DRAFT + wrong project + Rev 0/AFC + missing fields
//    Should FAIL on multiple checks
// ══════════════════════════════════════════════════════════════════════════
async function createDoc5_MultiFailure() {
  await writePdf('VG-CP2-PRO-PID-0044_Rev0.pdf', (doc) => {
    // ── Page 1: Cover with DRAFT watermark and WRONG project ──
    doc.fontSize(20).text('CAMERON LNG EXPANSION', { align: 'center' });
    doc.fontSize(12).text('DRAWING PACKAGE', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10);
    doc.font('Helvetica-Bold').text('DOCUMENT TITLE:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  P&ID - Condensate Recovery Unit');
    doc.font('Helvetica-Bold').text('REVISION NUMBER:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  Rev 0');
    doc.font('Helvetica-Bold').text('ISSUE PURPOSE:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  AFC - Approved for Construction');
    doc.font('Helvetica-Bold').text('DOCUMENT TYPE:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  PID');
    doc.font('Helvetica-Bold').text('DISCIPLINE CODE:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  PRO - Process');
    doc.font('Helvetica-Bold').text('DOCUMENT DATE:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  March 2026');
    doc.font('Helvetica-Bold').text('FROM ORGANISATION:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  KBR');
    doc.font('Helvetica-Bold').text('PROJECT:', { continued: true, width: 200 });
    doc.font('Helvetica').text('  Cameron LNG Expansion');

    doc.moveDown(2);
    doc.fontSize(48).text('DRAFT', { align: 'center' });
    doc.fontSize(12).text('DRAFT - NOT FOR CONSTRUCTION', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10);
    doc.text('This document contains the process and instrumentation diagrams for the condensate recovery unit.');
    doc.moveDown(0.5);
    doc.text('Prepared by: T. Wilson');
    doc.moveDown(1);
    doc.fontSize(9);
    doc.text('Note: Security classification not assigned yet.');
    doc.text('No prior versions documented for this issue.');
    doc.text('Contract reference: NOT SPECIFIED');

    // ── Page 2: Content with WRONG revision reference ──
    doc.addPage();
    doc.fontSize(14).text('P&ID NOTES - CONDENSATE RECOVERY UNIT');
    doc.moveDown(0.5);
    doc.fontSize(36).text('DRAFT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text('Project: Cameron LNG Expansion');
    doc.text('Document: VG-CP2-PRO-PID-0044');
    doc.text('Revision: Rev 4');
    doc.text('Date: January 2025');
    doc.moveDown(1);
    doc.text('1. All instruments shall be per ISA S5.1 symbology.');
    doc.text('2. Pipe class ratings per project piping specification.');
    doc.text('3. Control valve fail positions as shown on individual P&IDs.');
    doc.moveDown(1);
    doc.text('This preliminary issue is for review purposes only and may contain errors.');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 6. VALID INSTRUMENTATION SPEC — VG-000000-INF-SPC-VGL-00003 (all checks PASS)
// ══════════════════════════════════════════════════════════════════════════
async function createDoc6_InstrumentationSpec() {
  await writePdf('VG-000000-INF-SPC-VGL-00003_RevA.pdf', (doc) => {
    // ── Page 1: Cover ──
    addCoverHeader(doc, 'CONTRACT DOCUMENT');
    addRuntimeStamp(doc);
    doc.moveDown(0.5);
    addMetadataTable(doc, [
      ['CONTRACT NUMBER',        'VG-000000-INF-SPC-VGL-00003'],
      ['DOCUMENT TITLE',         'Instrumentation Design Basis Specification'],
      ['REVISION NUMBER',        'Rev A'],
      ['ISSUE PURPOSE',          'IFR — Issued for Review'],
      ['SECURITY CLASSIFICATION','Company Use'],
      ['DOCUMENT TYPE',          'SPC — Specification'],
      ['DISCIPLINE CODE',        'INF — Instrumentation'],
      ['DOCUMENT DATE',          RUNTIME_DATE_LONG],
      ['FROM ORGANISATION',      'VGL — Venture Global LNG'],
      ['TO ORGANISATION',        'PRJ — Project Owner'],
      ['PROJECT',                'Engineering Project — C2 EPC-BOP'],
    ]);
    doc.moveDown(0.5);
    drawEngineeringDiagram(doc, 'INSTRUMENTATION DESIGN BASIS — C2 EPC-BOP');
    addFooter(doc, 'VG-000000-INF-SPC-VGL-00003', 'A', 'Company Use');

    // ── Page 2: Second Cover ──
    doc.addPage();
    addCoverHeader(doc, 'DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#003b5c').text('SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('SDx Project Area:           C2');
    doc.text('Contract Reference:         C2 EPC-BOP');
    doc.text('Transmittal Reference:      TRN-C2-VGL-2026-0003');
    doc.text('Previous Revision:          — (First Issue)');
    doc.text('Page Count:                 4 pages');
    doc.text('Language:                   English');
    doc.text('File Name:                  VG-000000-INF-SPC-VGL-00003_RevA.pdf');
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('APPROVAL SIGNATURES');
    doc.font('Helvetica').moveDown(0.3);
    doc.text(`Prepared by:    S. Jones                 Date: ${RUNTIME_DATE_SHORT}`);
    doc.text(`Reviewed by:    R. Patel                 Date: ${RUNTIME_DATE_SHORT}`);
    doc.text(`Approved by:    M. Brennan               Date: ${RUNTIME_DATE_SHORT}`);
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#003b5c').text('REVISION HISTORY');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#333').font('Courier');
    doc.text('Rev    Date           Description                         Author');
    doc.text('───    ──────────     ───────────────────────────────     ──────────');
    doc.text(`A      ${RUNTIME_DATE_SHORT}    First Issue — Issued for Review     S. Jones`);
    doc.font('Helvetica');
    addFooter(doc, 'VG-000000-INF-SPC-VGL-00003', 'A', 'Company Use');

    // ── Page 3: Technical Content ──
    doc.addPage();
    doc.fontSize(14).fillColor('#003b5c').text('1. SCOPE');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('This specification defines the instrumentation design basis applicable to all process units within the C2 EPC-BOP scope of the Engineering Project facility. All instrumentation and control systems shall be designed, procured, and installed in accordance with this document.');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('2. REFERENCES');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('  • ISA 5.1 — Instrumentation Symbols and Identification');
    doc.text('  • IEC 61511 — Functional Safety, Safety Instrumented Systems');
    doc.text('  • IEC 61508 — Functional Safety of E/E/PE Systems');
    doc.text('  • Project Specification VGL-INF-STD-001');
    doc.text('  • Process Hazard Analysis Report VGL-HSE-HAZ-0001');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('3. DESIGN BASIS');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('All SIL-rated loops shall be designed and verified per IEC 61511. Safety Integrity Level targets per the SIL determination study. DCS shall be Emerson DeltaV. SIS shall be Triconex Tricon CX. Field instrumentation to be NAMUR compliant.');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#003b5c').text('4. ACCEPTANCE CRITERIA');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('Loop accuracy: ±0.5% of span for process measurements. Control valve seat leakage: Class IV per ANSI/FCI 70-2. Pressure transmitters: HART 7 protocol, 4-20mA output.');
    addFooter(doc, 'VG-000000-INF-SPC-VGL-00003', 'A', 'Company Use');

    // ── Page 4: End ──
    doc.addPage();
    doc.moveDown(10);
    doc.fontSize(16).fillColor('#003b5c').text('═══════════════════════════════════', { align: 'center' });
    doc.text('END OF DOCUMENT', { align: 'center' });
    doc.text('═══════════════════════════════════', { align: 'center' });
    addFooter(doc, 'VG-000000-INF-SPC-VGL-00003', 'A', 'Company Use');
  });
}

// ── MAIN ────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Generating Rich Test PDFs for OCR Validation');
  console.log('═══════════════════════════════════════════════════════\n');

  await createDoc1_ValidComplete();
  await createDoc2_ValidRevB();
  await createDoc3_ImageOnly();
  await createDoc4_WithMarkups();
  await createDoc5_MultiFailure();
  await createDoc6_InstrumentationSpec();

  const files = fs.readdirSync(OUT_DIR);
  console.log(`\n  Done — ${files.length} PDFs generated in ${OUT_DIR}`);
  files.forEach(f => {
    const size = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(1);
    console.log(`    ${f}  (${size} KB)`);
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
