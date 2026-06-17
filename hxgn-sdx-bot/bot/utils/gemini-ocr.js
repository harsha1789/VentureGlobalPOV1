/**
 * VGL OCR Engine — Node.js port of VGL_OCR (process_compliance_ai.py)
 *
 * Uses AI vision OCR to:
 *  1. Extract metadata from a PDF document
 *  2. Cross-validate metadata consistency across all pages
 *  3. Compare extracted data against loadsheet reference
 *
 * Ported from VGL_OCR Python project to Node.js.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

dayjs.extend(customParseFormat);

const GEMINI_GENERATION_CONFIG = { responseMimeType: 'application/json' };

class VGLOCREngine {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: GEMINI_GENERATION_CONFIG
    });
  }

  async extractMetadata(pdfPath) {
    console.log(`    [OCR] Extracting metadata from ${path.basename(pdfPath)}...`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const prompt = `[CONTEXT]
You are an OCR and Document Metadata Analysis specialist.

[REQUEST]
Extract all metadata fields from this PDF document.

[ACTIONS]
1. Scan every page for metadata fields.
2. Map fields to the requested JSON structure.
3. Use "NA" for fields not found.

[FRAMING]
OCR ONLY. Transcribe the text exactly as it appears. Do not explain, summarize, or provide context.

Return ONLY valid JSON with this exact structure:
{
  "reference_data": {
    "document_number": "",
    "revision": "",
    "issue_date": "",
    "document_title": "",
    "classification": "",
    "issue_purpose": "",
    "file_name": "",
    "security_code": "",
    "discipline_code": "",
    "document_type": "",
    "from_organisation": "",
    "project": "",
    "contract_reference": "",
    "prepared_by": ""
  }
}`;

    const result = await this._callWithRetry([
      prompt,
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }
    ]);
    return this._parseJSON(result);
  }

  async validateConsistency(pdfPath, referenceData) {
    console.log(`    [OCR] Cross-page consistency analysis...`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const prompt = `[CONTEXT]
You are an elite Document Integrity Auditor.

[REFERENCE DATA]
${JSON.stringify(referenceData, null, 2)}

[CRITICAL DIRECTIVE]
You MUST verify consistency ACROSS ALL PAGES. Documents often hide errors deep inside.
For example, 'Revision' might be '1' on the cover, but accidentally say 'Rev 4' on page 5.
YOU MUST HUNT for 'Rev', 'Revision', 'Date', 'Title', or 'Document Number' on EVERY single page.

[ACTIONS]
1. Look at Page 1. Extract metadata. Compare to reference.
2. Look at Page 2, Page 3, Page 4, etc., individually.
3. Every time you see a revision number, document number, date, or title on ANY page, compare it to the reference.
4. If it differs, generate an Issue with the specific page number.
5. Check for blank pages, image-only pages, draft watermarks, and markup annotations.

[FRAMING]
- Report ONLY discrepancies. Do not report correct matches.
- Treat "04", "Rev 4", "Rev. 4", "Revision 4" as value "4".
- "Reason for Issue" maps to "issue_purpose".
- OCR ONLY: Transcribe exactly as shown. No hallucinations.

Return ONLY valid JSON:
{
  "issues": [
    {"page": 1, "field": "field_name", "found": "what_was_found", "expected": "what_was_expected"}
  ],
  "blank_pages": [],
  "non_ocr_pages": [],
  "has_draft_watermark": false,
  "has_markups": false,
  "has_signatures": true,
  "has_revision_history": true,
  "has_security_classification": true,
  "page_count": 1
}`;

    const result = await this._callWithRetry([
      prompt,
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }
    ]);
    return this._parseJSON(result);
  }

  async _callWithRetry(contents, maxRetries = 3) {
    const backoff = [20, 35, 50];
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(contents);
        const response = await result.response;
        return response.text();
      } catch (err) {
        const msg = (err.message || '') + (err.status || '');
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate') || msg.includes('quota')) {
          const waitSec = backoff[attempt] ?? 50;
          console.log(`    [OCR] Rate limit hit. Waiting ${waitSec}s... (Attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
        throw err;
      }
    }
    throw new Error('AI API: Max retries exceeded');
  }

  _parseJSON(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn('    [OCR] JSON parse failed, attempting extraction...');
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }
  }
}

function _normalize(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
}

function _datesEqual(a, b) {
  const formats = [
    undefined,
    'D MMM YYYY', 'DD MMM YYYY',
    'D MMMM YYYY', 'DD MMMM YYYY',
    'DD/MM/YYYY', 'D/M/YYYY',
    'MM/DD/YYYY', 'M/D/YYYY',
    'YYYY-MM-DD', 'DD-MM-YYYY'
  ];
  for (const fmtA of formats) {
    for (const fmtB of formats) {
      const da = fmtA ? dayjs(a, fmtA, true) : dayjs(a);
      const db = fmtB ? dayjs(b, fmtB, true) : dayjs(b);
      if (da.isValid() && db.isValid() && da.isSame(db, 'day')) return true;
    }
  }
  return false;
}

/**
 * Filter out false-positive OCR issues ported from VGL_OCR validation_helpers.py.
 * Removes issues where:
 *   - found equals expected after whitespace/case normalization
 *   - both values resolve to the same date, ignoring format differences
 */
function filterIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.filter(issue => {
    const found = _normalize(issue.found);
    const expected = _normalize(issue.expected);
    if (!found || !expected) return true;
    if (found === expected) return false;
    const fieldName = String(issue.field || '').toLowerCase();
    if (fieldName.includes('date') && _datesEqual(issue.found, issue.expected)) return false;
    return true;
  });
}

/**
 * Extract per-page text items with bounding-box positions using pdfjs-dist.
 * Returns: Array<Array<{ str, transform, width, height }>> indexed by page (0-based).
 */
async function _extractTextPositions(srcBytes) {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(srcBytes),
      verbosity: 0,
      isEvalSupported: false,
      useSystemFonts: true
    });
    const doc = await loadingTask.promise;
    const perPage = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      perPage.push((content.items || []).map(it => ({
        str: it.str,
        transform: it.transform,
        width: it.width,
        height: it.height || Math.abs(it.transform?.[3]) || 10
      })));
    }
    return perPage;
  } catch (err) {
    console.warn(`    [OCR] Text-position extraction failed (${err.message}); will fall back to legend-only highlights`);
    return [];
  }
}

function _normalizeForMatch(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Create a copy of the PDF with red error annotations on pages with failed checks.
 * Real text-bbox highlights are drawn on matched text via pdfjs-dist positions.
 * Whole-page markers are drawn for blank/image-only pages.
 * Returns the output path, or null if no failures or generation fails.
 * Port of VGL_OCR process_compliance_ai.py → generate_highlighted_pdf().
 */
async function generateHighlightedPDF(pdfPath, failedIssues) {
  if (!failedIssues || failedIssues.length === 0) return null;

  const withPages = failedIssues.filter(i => Number.isFinite(Number(i.page)) && Number(i.page) > 0);
  if (withPages.length === 0) return null;

  try {
    const srcBytes = fs.readFileSync(pdfPath);
    const textPositions = await _extractTextPositions(srcBytes);

    const pdfDoc = await PDFDocument.load(srcBytes);
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    const byPage = new Map();
    for (const issue of withPages) {
      const idx = Number(issue.page) - 1;
      if (idx < 0 || idx >= pages.length) continue;
      if (!byPage.has(idx)) byPage.set(idx, []);
      byPage.get(idx).push(issue);
    }

    const red = rgb(0.85, 0.1, 0.1);
    const redFill = rgb(1, 0.92, 0.92);
    const yellowHighlight = rgb(1, 0.92, 0.3);

    for (const [idx, issues] of byPage) {
      const page = pages[idx];
      const { width, height } = page.getSize();
      const items = textPositions[idx] || [];

      // ── Whole-page markers for blank / image-only pages ──
      const wholePageIssue = issues.find(i => /blank|non_ocr|image_only/i.test(String(i.field || '')));
      if (wholePageIssue) {
        page.drawRectangle({
          x: 4, y: 4, width: width - 8, height: height - 8,
          borderColor: red, borderWidth: 4, opacity: 1
        });
        const stampText = /blank/i.test(wholePageIssue.field) ? 'BLANK PAGE' : 'IMAGE-ONLY PAGE — NO OCR TEXT';
        const stampW = helvBold.widthOfTextAtSize(stampText, 20) + 24;
        page.drawRectangle({
          x: (width - stampW) / 2, y: height / 2 - 20,
          width: stampW, height: 40,
          color: redFill, borderColor: red, borderWidth: 2, opacity: 0.9
        });
        page.drawText(stampText, {
          x: (width - stampW) / 2 + 12, y: height / 2 - 6,
          size: 20, font: helvBold, color: red
        });
      }

      // ── Real text-bbox highlights for consistency issues ──
      const matchedIssues = new Set();
      for (const issue of issues) {
        if (wholePageIssue === issue) continue;
        const needle = _normalizeForMatch(issue.found);
        if (!needle || needle === 'na') continue;

        const hits = items.filter(it => {
          const s = _normalizeForMatch(it.str);
          return s && (s === needle || s.includes(needle) || needle.includes(s));
        });

        for (const hit of hits) {
          const [, , , , x, y] = hit.transform;
          const itemH = Math.max(hit.height, 8);
          const pad = 1.5;
          // Yellow highlight fill with red border — standard compliance-tool convention
          page.drawRectangle({
            x: x - pad, y: y - pad,
            width: hit.width + pad * 2, height: itemH + pad * 2,
            color: yellowHighlight, borderColor: red, borderWidth: 1.2, opacity: 0.55
          });
          matchedIssues.add(issue);
        }
      }

      // ── Legend box at top of page listing all issues ──
      const blockH = 22 + issues.length * 34;
      const blockY = height - blockH - 18;
      const blockX = 18;
      const blockW = width - 36;

      page.drawRectangle({ x: blockX, y: blockY, width: blockW, height: blockH, color: redFill, borderColor: red, borderWidth: 1.5, opacity: 0.92 });
      page.drawText(`ERRORS ON PAGE ${idx + 1}`, { x: blockX + 10, y: blockY + blockH - 16, size: 11, font: helvBold, color: red });

      let cursorY = blockY + blockH - 32;
      for (const issue of issues) {
        const marker = matchedIssues.has(issue) ? '[HIGHLIGHTED]' : (issue === wholePageIssue ? '[PAGE-MARK]' : '');
        const line1 = `ERROR: ${issue.field || 'field'} ${marker}`.trim();
        const line2 = `Expected: ${String(issue.expected || '').slice(0, 100)}`;
        const line3 = `Found: ${String(issue.found || '').slice(0, 100)}`;
        page.drawText(line1, { x: blockX + 10, y: cursorY, size: 9, font: helvBold, color: red });
        page.drawText(line2, { x: blockX + 10, y: cursorY - 10, size: 8, font: helv, color: red });
        page.drawText(line3, { x: blockX + 10, y: cursorY - 20, size: 8, font: helv, color: red });
        cursorY -= 34;
      }
    }

    const dir = path.dirname(pdfPath);
    const base = path.basename(pdfPath, path.extname(pdfPath));
    const outPath = path.join(dir, `${base}_errors.pdf`);
    const outBytes = await pdfDoc.save();
    fs.writeFileSync(outPath, outBytes);
    console.log(`    [OCR] Highlighted error PDF generated: ${path.basename(outPath)}`);
    return outPath;
  } catch (err) {
    console.warn(`    [OCR] Failed to generate highlighted PDF: ${err.message}`);
    return null;
  }
}

async function runOCRValidation(pdfPath, datasheet, submittal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in .env — required for OCR validation');
  }

  const engine = new VGLOCREngine(apiKey);
  const checks = [];
  let isValid = true;

  // ── Phase 1: AI Metadata Extraction ──
  console.log('    [OCR] ═══ Phase 1: AI Metadata Extraction ═══');
  const extracted = await engine.extractMetadata(pdfPath);
  const refData = extracted?.reference_data || {};

  checks.push({
    name: 'AI OCR Extraction',
    status: Object.keys(refData).length > 0 ? 'PASS' : 'FAIL',
    note: Object.keys(refData).length > 0
      ? `Extracted ${Object.values(refData).filter(v => v && v !== 'NA').length} metadata fields via AI OCR`
      : 'Failed to extract metadata from document'
  });

  // Brief pause between API calls to avoid rate limiting
  await new Promise(r => setTimeout(r, 3000));

  // ── Phase 2: Cross-Page Consistency Analysis ──
  console.log('    [OCR] ═══ Phase 2: Cross-Page Consistency ═══');
  const analysis = await engine.validateConsistency(pdfPath, refData);

  if (analysis.blank_pages && analysis.blank_pages.length > 0) {
    checks.push({ name: 'Blank Page Detection', status: 'FAIL', note: `Blank pages found: ${analysis.blank_pages.join(', ')}` });
    isValid = false;
  } else {
    checks.push({ name: 'Blank Page Detection', status: 'PASS', note: 'No blank pages detected' });
  }

  if (analysis.non_ocr_pages && analysis.non_ocr_pages.length > 0) {
    checks.push({ name: 'Non-OCR Page Detection', status: 'FAIL', note: `Image-only pages: ${analysis.non_ocr_pages.join(', ')}` });
    isValid = false;
  } else {
    checks.push({ name: 'Non-OCR Page Detection', status: 'PASS', note: 'All pages have searchable text' });
  }

  checks.push({
    name: 'Draft Watermark Check',
    status: analysis.has_draft_watermark ? 'FAIL' : 'PASS',
    note: analysis.has_draft_watermark ? 'DRAFT or NOT FOR CONSTRUCTION marker detected' : 'No draft watermarks found'
  });
  if (analysis.has_draft_watermark) isValid = false;

  checks.push({
    name: 'Markup Annotations Check',
    status: analysis.has_markups ? 'FAIL' : 'PASS',
    note: analysis.has_markups ? 'Review markups or annotations found in document' : 'No markup artifacts detected'
  });
  if (analysis.has_markups) isValid = false;

  checks.push({
    name: 'Signature Block Present',
    status: analysis.has_signatures ? 'PASS' : 'WARN',
    note: analysis.has_signatures ? 'Prepared/Reviewed/Approved signatures found' : 'Signature block not detected'
  });

  checks.push({
    name: 'Revision History Present',
    status: analysis.has_revision_history ? 'PASS' : 'WARN',
    note: analysis.has_revision_history ? 'Revision history section found' : 'No revision history detected'
  });

  checks.push({
    name: 'Security Classification',
    status: analysis.has_security_classification ? 'PASS' : 'FAIL',
    note: analysis.has_security_classification ? 'Valid security classification found' : 'Security classification missing'
  });
  if (!analysis.has_security_classification) isValid = false;

  const rawIssues = Array.isArray(analysis.issues) ? analysis.issues : [];
  const filteredIssues = filterIssues(rawIssues);
  analysis.issues = filteredIssues;
  analysis.raw_issues = rawIssues;
  const suppressedCount = rawIssues.length - filteredIssues.length;
  if (suppressedCount > 0) {
    console.log(`    [OCR] False-positive filter suppressed ${suppressedCount} issue(s)`);
  }

  if (filteredIssues.length > 0) {
    filteredIssues.forEach(issue => {
      checks.push({
        name: `Consistency: ${issue.field} (Page ${issue.page})`,
        status: 'FAIL',
        note: `Expected "${issue.expected}", found "${issue.found}"`,
        page: Number(issue.page) || null,
        field: issue.field,
        expected: issue.expected,
        found: issue.found
      });
      isValid = false;
    });
  } else {
    checks.push({
      name: 'Cross-Page Consistency',
      status: 'PASS',
      note: `All metadata consistent across ${analysis.page_count || '?'} page(s)`
    });
  }

  // ── Phase 3: Loadsheet Cross-Validation ──
  if (datasheet) {
    console.log('    [OCR] ═══ Phase 3: Loadsheet Cross-Validation ═══');

    if (refData.document_number && datasheet.documentNumber) {
      const docMatch = refData.document_number.toLowerCase().includes(datasheet.documentNumber.toLowerCase()) ||
                        datasheet.documentNumber.toLowerCase().includes(refData.document_number.toLowerCase());
      checks.push({
        name: 'Loadsheet: Document Number',
        status: docMatch ? 'PASS' : 'FAIL',
        note: docMatch ? `Match: ${refData.document_number}` : `Mismatch — OCR: "${refData.document_number}" vs Loadsheet: "${datasheet.documentNumber}"`
      });
      if (!docMatch) isValid = false;
    }

    if (refData.document_title && datasheet.title) {
      const ocrTitle = refData.document_title.toLowerCase().substring(0, 30);
      const lsTitle = datasheet.title.toLowerCase().substring(0, 30);
      const titleMatch = ocrTitle.includes(lsTitle.substring(0, 15)) || lsTitle.includes(ocrTitle.substring(0, 15));
      checks.push({
        name: 'Loadsheet: Document Title',
        status: titleMatch ? 'PASS' : 'FAIL',
        note: titleMatch ? `Title matches loadsheet` : `Mismatch — OCR: "${refData.document_title.substring(0, 50)}" vs Loadsheet: "${datasheet.title.substring(0, 50)}"`
      });
      if (!titleMatch) isValid = false;
    }

    if (refData.revision && datasheet.revision) {
      const revMatch = refData.revision.toLowerCase().includes(datasheet.revision.toLowerCase()) ||
                        datasheet.revision.toLowerCase().includes(refData.revision.toLowerCase());
      checks.push({
        name: 'Loadsheet: Revision',
        status: revMatch ? 'PASS' : 'FAIL',
        note: revMatch ? `Revision matches: ${refData.revision}` : `Mismatch — OCR: "${refData.revision}" vs Loadsheet: "${datasheet.revision}"`
      });
      if (!revMatch) isValid = false;
    }

    if (refData.discipline_code && datasheet.discipline) {
      const ocrDisc = refData.discipline_code.toUpperCase().substring(0, 3);
      const lsDisc = datasheet.discipline.toUpperCase().substring(0, 3);
      const discMatch = ocrDisc === lsDisc;
      checks.push({
        name: 'Loadsheet: Discipline',
        status: discMatch ? 'PASS' : 'FAIL',
        note: discMatch ? `Discipline matches: ${refData.discipline_code}` : `Mismatch — OCR: "${refData.discipline_code}" vs Loadsheet: "${datasheet.discipline}"`
      });
      if (!discMatch) isValid = false;
    }
  }

  // ── Phase 4: Contract / Project Validation ──
  if (submittal) {
    const project = refData.project || '';
    const contractRef = refData.contract_reference || '';
    const isCP2 = /CP2|VG.*CP2|Venture\s+Global/i.test(project) || /C2/i.test(contractRef);
    const wrongProject = /Cameron|Sabine|Plaquemines/i.test(project);

    checks.push({
      name: 'Contract/Project Reference',
      status: isCP2 && !wrongProject ? 'PASS' : 'FAIL',
      note: wrongProject
        ? `Wrong project detected: "${project}" — expected CP2`
        : (isCP2 ? `Correct CP2 contract reference confirmed` : `No CP2 contract reference found in document`)
    });
    if (!isCP2 || wrongProject) isValid = false;

    const rev = refData.revision || '';
    const issuePurpose = refData.issue_purpose || '';
    if (rev === '0' && /AFC|Approved\s+for\s+Construction/i.test(issuePurpose)) {
      checks.push({ name: 'Rev & Issue Purpose Alignment', status: 'FAIL', note: 'Rev 0 cannot be AFC (Approved for Construction)' });
      isValid = false;
    } else {
      checks.push({ name: 'Rev & Issue Purpose Alignment', status: 'PASS', note: `Revision "${rev}" and issue purpose "${issuePurpose}" are aligned` });
    }
  }

  const failedIssuesForPdf = checks
    .filter(c => c.status === 'FAIL' && c.page)
    .map(c => ({ page: c.page, field: c.field, expected: c.expected, found: c.found }));

  // Whole-page markers: blank pages, image-only pages from the analysis
  for (const p of (analysis.blank_pages || [])) {
    failedIssuesForPdf.push({ page: Number(p), field: 'blank_page', expected: 'page content', found: 'BLANK PAGE' });
  }
  for (const p of (analysis.non_ocr_pages || [])) {
    failedIssuesForPdf.push({ page: Number(p), field: 'non_ocr_page', expected: 'OCR text', found: 'IMAGE-ONLY PAGE' });
  }

  const highlightedPdfPath = await generateHighlightedPDF(pdfPath, failedIssuesForPdf);

  return { checks, extracted: refData, analysis, isValid, highlightedPdfPath };
}

module.exports = { VGLOCREngine, runOCRValidation, filterIssues, generateHighlightedPDF };
