/**
 * Azure OpenAI (GPT-4o) OCR Engine — drop-in alternative to gemini-ocr.js
 *
 * GPT-4o cannot consume raw PDF like Gemini, so we extract text with pdf-parse
 * and run the same two-phase prompt flow (metadata extraction + consistency).
 *
 * Exposes the same public surface as gemini-ocr.js: runOCRValidation(pdf, datasheet, submittal).
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { AzureOpenAI } = require('openai');

class AzureOCREngine {
  constructor() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    if (!apiKey || !endpoint || !deployment) {
      throw new Error('Azure OpenAI env vars missing: AZURE_OPENAI_API_KEY / _ENDPOINT / _DEPLOYMENT_NAME');
    }
    this.client = new AzureOpenAI({ apiKey, endpoint, deployment, apiVersion });
    this.deployment = deployment;
  }

  async _extractPdfText(pdfPath) {
    const buf = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    const pages = Array.isArray(result.pages) ? result.pages : [];
    const pageCount = result.total || result.numpages || pages.length || 1;
    const text = result.text || pages.map(p => p.text || '').join('\n');
    const perPageChars = pages.map(p => (p.text || '').trim().length);
    const imageOnlyPages = perPageChars.map((n, i) => ({ n, i })).filter(x => x.n < 5).map(x => x.i + 1);
    return { text, pageCount, perPageChars, imageOnlyPages };
  }

  async extractMetadata(pdfPath) {
    console.log(`    [OCR] (Azure GPT-4o) Extracting metadata from ${path.basename(pdfPath)}...`);
    const { text } = await this._extractPdfText(pdfPath);

    const system = 'You are an OCR and Document Metadata Analysis specialist. OCR ONLY. Transcribe exactly as shown. Do not explain or summarize. Return ONLY valid JSON.';
    const user = `Extract all metadata fields from the following PDF text.

Use "NA" for fields not found.

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
}

PDF TEXT:
"""
${text.slice(0, 30000)}
"""`;

    const result = await this._callWithRetry([
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]);
    return this._parseJSON(result);
  }

  async validateConsistency(pdfPath, referenceData) {
    console.log(`    [OCR] (Azure GPT-4o) Cross-page consistency analysis...`);
    const extracted = await this._extractPdfText(pdfPath);
    const { text, pageCount, imageOnlyPages } = extracted;
    this._lastExtraction = extracted;

    const system = 'You are an elite Document Integrity Auditor. OCR ONLY. Report only discrepancies. Return ONLY valid JSON.';
    const user = `REFERENCE DATA (canonical values for this document):
${JSON.stringify(referenceData, null, 2)}

DIRECTIVE:
Verify consistency ONLY for these fields: document_number, revision, document_title, issue_date, issue_purpose.
Report an issue ONLY if a page explicitly states a DIFFERENT value for one of those fields than the reference.
DO NOT report: page counts, previous revision notes, formatting differences, synonyms, punctuation variations.
Treat "04", "Rev 4", "Rev. 4", "Revision 4" as equal to "4".
Treat date formats like "03 April 2026", "03-Apr-2026", "April 3, 2026" as equal.
If no contradicting value is found, return an empty issues array.

Image-only / non-OCR page criterion: a page contains NO readable text at all (page appears blank in the extracted text).
Only mark a page number that is <= page_count (${pageCount}).

Also report:
- Draft watermarks (literal text "DRAFT" or "NOT FOR CONSTRUCTION" visible on the page)
- Review markups / reviewer annotations (e.g., text like "[COMMENT]", "[MARKUP]", "/Annots")
- Whether signatures, revision history section, and security classification field are present

Return ONLY valid JSON:
{
  "issues": [{"page": 1, "field": "field_name", "found": "what_was_found", "expected": "what_was_expected"}],
  "blank_pages": [],
  "non_ocr_pages": [],
  "has_draft_watermark": false,
  "has_markups": false,
  "has_signatures": true,
  "has_revision_history": true,
  "has_security_classification": true,
  "page_count": ${pageCount}
}

PDF TEXT (page count ${pageCount}):
"""
${text.slice(0, 30000)}
"""`;

    const result = await this._callWithRetry([
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]);
    const parsed = this._parseJSON(result);
    // Deterministic override: trust pdf-parse for image-only page detection
    parsed.non_ocr_pages = imageOnlyPages;
    parsed.page_count = pageCount;
    return parsed;
  }

  async _callWithRetry(messages, maxRetries = 4) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const resp = await this.client.chat.completions.create({
          model: this.deployment,
          messages,
          temperature: 0,
          response_format: { type: 'json_object' }
        });
        return resp.choices?.[0]?.message?.content || '';
      } catch (err) {
        const status = err.status || err.statusCode || 0;
        const msg = (err.message || '') + ' ' + status;
        if (status === 429 || /rate|quota|throttle/i.test(msg)) {
          const wait = 15 + attempt * 15;
          console.log(`    [OCR] Azure rate limit — waiting ${wait}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, wait * 1000));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Azure OpenAI: Max retries exceeded');
  }

  _parseJSON(text) {
    let cleaned = (text || '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    try { return JSON.parse(cleaned); } catch (_) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Failed to parse Azure OpenAI response');
    }
  }
}

async function runOCRValidation(pdfPath, datasheet, submittal) {
  const engine = new AzureOCREngine();
  const checks = [];
  let isValid = true;

  console.log('    [OCR] ═══ Phase 1: Azure GPT-4o Metadata Extraction ═══');
  const extracted = await engine.extractMetadata(pdfPath);
  const refData = extracted?.reference_data || {};

  checks.push({
    name: 'AI OCR Extraction',
    status: Object.keys(refData).length > 0 ? 'PASS' : 'FAIL',
    note: Object.keys(refData).length > 0
      ? `Extracted ${Object.values(refData).filter(v => v && v !== 'NA').length} metadata fields via Azure GPT-4o`
      : 'Failed to extract metadata from document'
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('    [OCR] ═══ Phase 2: Cross-Page Consistency ═══');
  const analysis = await engine.validateConsistency(pdfPath, refData);

  if (analysis.blank_pages && analysis.blank_pages.length > 0) {
    checks.push({ name: 'Blank Page Detection', status: 'FAIL', note: `Blank pages: ${analysis.blank_pages.join(', ')}` });
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

  if (analysis.issues && analysis.issues.length > 0) {
    analysis.issues.forEach(issue => {
      checks.push({
        name: `Consistency: ${issue.field} (Page ${issue.page})`,
        status: 'FAIL',
        note: `Expected "${issue.expected}", found "${issue.found}"`
      });
      isValid = false;
    });
  } else {
    checks.push({ name: 'Cross-Page Consistency', status: 'PASS', note: `All metadata consistent across ${analysis.page_count || '?'} page(s)` });
  }

  if (datasheet) {
    console.log('    [OCR] ═══ Phase 3: Loadsheet Cross-Validation ═══');

    if (refData.document_number && datasheet.documentNumber) {
      const a = refData.document_number.toLowerCase(), b = datasheet.documentNumber.toLowerCase();
      const match = a.includes(b) || b.includes(a);
      checks.push({
        name: 'Loadsheet: Document Number',
        status: match ? 'PASS' : 'FAIL',
        note: match ? `Match: ${refData.document_number}` : `Mismatch — OCR: "${refData.document_number}" vs Loadsheet: "${datasheet.documentNumber}"`
      });
      if (!match) isValid = false;
    }

    if (refData.document_title && datasheet.title) {
      const a = refData.document_title.toLowerCase().substring(0, 30);
      const b = datasheet.title.toLowerCase().substring(0, 30);
      const match = a.includes(b.substring(0, 15)) || b.includes(a.substring(0, 15));
      checks.push({
        name: 'Loadsheet: Document Title',
        status: match ? 'PASS' : 'FAIL',
        note: match ? 'Title matches loadsheet' : `Mismatch — OCR: "${refData.document_title.substring(0, 50)}" vs Loadsheet: "${datasheet.title.substring(0, 50)}"`
      });
      if (!match) isValid = false;
    }

    if (refData.revision && datasheet.revision) {
      const a = refData.revision.toLowerCase(), b = datasheet.revision.toLowerCase();
      const match = a.includes(b) || b.includes(a);
      checks.push({
        name: 'Loadsheet: Revision',
        status: match ? 'PASS' : 'FAIL',
        note: match ? `Revision matches: ${refData.revision}` : `Mismatch — OCR: "${refData.revision}" vs Loadsheet: "${datasheet.revision}"`
      });
      if (!match) isValid = false;
    }

    if (refData.discipline_code && datasheet.discipline) {
      const a = refData.discipline_code.toUpperCase().substring(0, 3);
      const b = datasheet.discipline.toUpperCase().substring(0, 3);
      const match = a === b;
      checks.push({
        name: 'Loadsheet: Discipline',
        status: match ? 'PASS' : 'FAIL',
        note: match ? `Discipline matches: ${refData.discipline_code}` : `Mismatch — OCR: "${refData.discipline_code}" vs Loadsheet: "${datasheet.discipline}"`
      });
      if (!match) isValid = false;
    }
  }

  if (submittal) {
    const project = refData.project || '';
    const contractRef = refData.contract_reference || '';
    const isCP2 = /CP2|VG.*CP2|Venture\s+Global/i.test(project) || /C2/i.test(contractRef);
    const wrongProject = /Cameron|Sabine|Plaquemines/i.test(project);

    checks.push({
      name: 'Contract/Project Reference',
      status: isCP2 && !wrongProject ? 'PASS' : 'FAIL',
      note: wrongProject ? `Wrong project detected: "${project}" — expected CP2`
        : (isCP2 ? 'Correct CP2 contract reference confirmed' : 'No CP2 contract reference found in document')
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

  return { checks, extracted: refData, analysis, isValid };
}

module.exports = { AzureOCREngine, runOCRValidation };
