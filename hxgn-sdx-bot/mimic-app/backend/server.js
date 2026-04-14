/**
 * HxGN SDx Mimic Application — Express Backend
 * Serves REST APIs and static frontend files.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createSeedData } = require('./seed');

const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.MIMIC_APP_PORT || 3000;
const TEST_PDFS_DIR = path.join(__dirname, 'test-pdfs');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── In-memory data store ──────────────────────────────────────────────
let store = createSeedData();

// ── PDF text extraction (real) ───────────────────────────────────────
async function extractTextFromPdf(doc) {
  if (!doc) return { text: '', pages: 0, method: 'none', perPageChars: [] };

  // Try to read a real PDF file from test-pdfs directory
  const pdfPath = path.join(TEST_PDFS_DIR, doc.fileName);
  if (fs.existsSync(pdfPath)) {
    try {
      const buffer = fs.readFileSync(pdfPath);
      const perPageText = [];
      const data = await pdfParse(buffer, {
        // Match pdf-parse's default page renderer (newline on Y change) so the
        // existing regex extractors keep matching, and ALSO capture per-page text
        // so we can detect image-only pages.
        pagerender: function (pageData) {
          return pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
            .then(tc => {
              let lastY, s = '';
              for (const item of tc.items) {
                if (lastY === item.transform[5] || !lastY) s += item.str;
                else s += '\n' + item.str;
                lastY = item.transform[5];
              }
              perPageText.push(s);
              return s;
            });
        }
      });
      const perPageChars = perPageText.map(t => t.trim().length);
      return {
        text: data.text || '',
        pages: data.numpages || perPageText.length || 0,
        method: 'pdf-parse',
        perPageChars
      };
    } catch (e) {
      // Parse failure = likely image-only or malformed PDF
      return { text: '', pages: 0, method: 'pdf-parse-failed', error: e.message, perPageChars: [] };
    }
  }

  // Fallback to hardcoded textContent if no PDF file exists
  if (doc.textContent) {
    return { text: doc.textContent, pages: 1, method: 'textContent-fallback', perPageChars: [doc.textContent.length] };
  }

  return { text: '', pages: 0, method: 'none', perPageChars: [] };
}

// ── Metadata extraction helper ───────────────────────────────────────
function extractField(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return (m[1] || m[0]).trim();
  }
  return null;
}

function extractDocumentMetadata(text) {
  return {
    contractNumber: extractField(text, [
      /CONTRACT\s+NUMBER\s*[:\-–]\s*([A-Z0-9][A-Z0-9\-\/\.]{4,})/i,
      /Doc(?:ument)?\s*No\.?\s*[:\-–]\s*([A-Z0-9][A-Z0-9\-\/\.]+)/i,
    ]),
    title: extractField(text, [
      /DOCUMENT\s+TITLE\s*[:\-–]\s*(.{8,})/i,
      /TITLE\s*[:\-–]\s*(.{5,})/i,
    ]),
    revision: extractField(text, [
      /REVISION\s+NUMBER\s*[:\-–]\s*(Rev\.?\s*[A-Z0-9]+|[A-Z0-9][A-Z0-9\.\-]*)/i,
      /\b(Rev\.?\s*[A-Z0-9]+)\b/i,
    ]),
    issuePurpose: extractField(text, [
      /ISSUE\s+PURPOSE\s*[:\-–]\s*([A-Z]{2,3})/i,
      /\b(IFU|IFI|IFC|IFR|IFT|AFC|AFD|IFA|PUR)\b/,
    ]),
    securityClassification: extractField(text, [
      /SECURITY\s+CLASSIFICATION\s*[:\-–]\s*([^\n]+)/i,
      /\b(Company\s+Use|Confidential|Restricted|Public)\b/i,
    ]),
    discipline: extractField(text, [
      /DISCIPLINE\s+CODE\s*[:\-–]\s*([A-Z]{2,4})/i,
      /\b(CMS|CIV|CME|ELE|INS|MEC|PIP|STR|PRO|HSE|QA|PUR)\b/,
    ]),
    documentType: extractField(text, [
      /DOCUMENT\s+TYPE\s*[:\-–]\s*([A-Z]{2,4})/i,
      /\b(SOW|MDR|SDR|DWG|SPE|CAL|REP|PRO|MOM|ITP|PID|SLD|GA|FAT|HAZ|REQ)\b/,
    ]),
    fromOrganisation: extractField(text, [
      /FROM\s+ORGANISATION\s*[:\-–]\s*([A-Z]{2,5})/i,
      /\b(WOR|KBR|AECOM|Bechtel|Fluor|Wood|Technip)\b/i,
    ]),
    project: extractField(text, [
      /PROJECT\s*[:\-–]\s*([^\n]+)/i,
      /\b(CP2|VG\s+CP2|Venture\s+Global\s+CP2|Cameron\s+LNG)\b/i,
    ]),
  };
}

// ── Auth middleware helper ─────────────────────────────────────────────
function findUser(username, password) {
  return store.users.find(u => u.username === username && u.password === password);
}

// ── ROUTES ─────────────────────────────────────────────────────────────

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = findUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ success: true, displayName: user.displayName, username: user.username });
});

// GET /api/todo-list
app.get('/api/todo-list', (req, res) => {
  const list = store.submittals.map(s => ({
    id: s.id,
    documentNumber: s.documentNumber,
    title: s.title,
    fileType: s.fileType,
    status: s.status,
    submittedBy: s.submittedBy,
    date: s.submissionDate,
    stepName: s.stepName,
    submittalDescription: s.submittalDescription,
    reasonForIssue: s.reasonForIssue,
    submittalType: s.submittalType,
    targetDate: s.targetDate,
    priority: s.priority,
    fromOrganisation: s.fromOrganisation,
    toOrganisation: s.toOrganisation,
    contract: s.contract,
    discipline: s.discipline
  }));
  res.json(list);
});

// POST /api/claim/:id
app.post('/api/claim/:id', (req, res) => {
  const submittal = store.submittals.find(s => s.id === req.params.id);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  if (submittal.status !== 'Review Submittal') {
    return res.status(400).json({ error: `Cannot claim — current status is "${submittal.status}"` });
  }
  submittal.claimedBy = req.body.username || 'dc_bot';
  submittal.status = 'In Review';
  res.json({ success: true, submittal });
});

// GET /api/submittal/:id
app.get('/api/submittal/:id', (req, res) => {
  const submittal = store.submittals.find(s => s.id === req.params.id);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  res.json({
    id: submittal.id,
    documentNumber: submittal.documentNumber,
    title: submittal.title,
    revision: submittal.revision,
    fileType: submittal.fileType,
    originator: submittal.originator,
    submissionDate: submittal.submissionDate,
    status: submittal.status,
    transmittalNumber: submittal.transmittalNumber,
    approved: submittal.approved,
    discipline: submittal.discipline,
    contract: submittal.contract,
    submittalType: submittal.submittalType,
    toOrganisation: submittal.toOrganisation,
    fromOrganisation: submittal.fromOrganisation,
    reasonForIssue: submittal.reasonForIssue
  });
});

// GET /api/datasheet/:id
app.get('/api/datasheet/:id', (req, res) => {
  const submittal = store.submittals.find(s => s.id === req.params.id);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  res.json(submittal.datasheet);
});

// GET /api/document/:id
app.get('/api/document/:id', async (req, res) => {
  const submittal = store.submittals.find(s => s.id === req.params.id);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  const doc = submittal.document;
  if (!doc) return res.json(null);

  // Extract text from real PDF file
  const extraction = await extractTextFromPdf(doc);
  // Clean up pdf-parse output: rejoin broken lines and normalize whitespace
  const text = extraction.text
    .replace(/-\n/g, '-')       // rejoin hyphenated line breaks
    .replace(/\n/g, '\n')       // keep newlines for multiline regex
    .replace(/[ \t]{2,}/g, ' '); // collapse multiple spaces to single
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  // Per-page coverage — any page with < 10 chars is treated as image-only / non-OCR
  const perPageChars = extraction.perPageChars || [];
  const imageOnlyPages = perPageChars
    .map((c, i) => ({ c, i: i + 1 }))
    .filter(x => x.c < 10)
    .map(x => x.i);
  const allPagesSearchable = perPageChars.length > 0 && imageOnlyPages.length === 0;
  const hasText = chars > 80 && allPagesSearchable;
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  const garbled = nonAscii > chars * 0.1;
  const hasDraft = /DRAFT|FOR\s+REVIEW\s+ONLY|NOT\s+FOR\s+CONSTRUCTION|PRELIMINARY/i.test(text);
  const hasMarkups = /\[COMMENT\]|\[MARKUP\]|<annotation|\/Annots/i.test(text);
  const hasSigs = /Prepared\s+by|Reviewed\s+by|Approved\s+by/i.test(text);
  const hasFooter = /Company\s+Use|Confidential|VGL|Venture\s+Global/i.test(text);
  const hasMetaEvery = hasFooter && hasSigs;
  const hasRevHist = /REVISION\s+HISTORY|Rev\s+History/i.test(text);
  const hasSection = /^[0-9]+\.\s+[A-Z]/m.test(text);
  const endsClean = /END\s+OF\s+DOCUMENT|={5,}$/i.test(text.trim());
  const hasSecondCover = /SECOND\s+COVER|DOCUMENT\s+CONTROL\s+INFORMATION|SDx\s+Project\s+Area/i.test(text);
  const hasSecurityClass = /SECURITY\s+CLASSIFICATION[:\s]+(Company\s*Use|Confidential|Restricted|Public)/i.test(text)
    || (/SECURITY\s+CLASSIFICATION/i.test(text) && /\b(Company\s*Use|Confidential|Restricted|Public)\b/i.test(text));
  const hasContractRef = /C2\s+EPC|CP2/i.test(text);
  const wrongProject = /Cameron|Sabine|Plaquemines/i.test(text);

  // Revision / Issue Purpose alignment
  const revMatch = text.match(/REVISION\s+NUMBER:\s*Rev\s+(\S+)/i);
  const issueMatch = text.match(/ISSUE\s+PURPOSE:\s*(\S+)/i);
  const rev = revMatch ? revMatch[1] : null;
  const issue = issueMatch ? issueMatch[1] : null;
  const revIssueAligned = !(rev === '0' && issue === 'AFC');

  const qualityChecks = [
    {
      label: 'OCR / Text Searchability',
      pass: hasText,
      detail: hasText
        ? `Readable text extracted on all ${perPageChars.length} page(s) — ${words} words, ${chars} chars`
        : (imageOnlyPages.length > 0
            ? `Image-only page(s) detected: ${imageOnlyPages.join(', ')} — no OCR text layer (per-page chars: [${perPageChars.join(', ')}])`
            : 'No text content — image-only or scanned document. OCR data found but text is not searchable')
    },
    {
      label: 'No Draft Watermarks',
      pass: !hasDraft,
      detail: hasDraft ? 'DRAFT or NOT FOR CONSTRUCTION marker detected' : 'No draft indicators found'
    },
    {
      label: 'No Markups or Annotations',
      pass: !hasMarkups,
      detail: hasMarkups ? 'Annotation or markup indicators detected in document' : 'No markup artifacts found'
    },
    {
      label: 'Page Orientation',
      pass: !garbled,
      detail: garbled ? 'Non-ASCII character ratio suggests encoding or orientation issue' : 'No orientation anomalies detected'
    },
    {
      label: 'Document Metadata on Each Page',
      pass: hasMetaEvery,
      detail: hasMetaEvery ? 'Document identity and security class present throughout' : 'Metadata may not appear on all pages'
    },
    {
      label: 'Security Classification Present',
      pass: hasSecurityClass,
      detail: hasSecurityClass ? 'Valid security classification found' : 'Security classification missing or invalid'
    },
    {
      label: 'Revision History Complete',
      pass: hasRevHist,
      detail: hasRevHist ? 'Revision history section present' : 'Revision history missing'
    },
    {
      label: 'Document Structure',
      pass: hasSection && hasSigs,
      detail: `Sections: ${hasSection ? 'Yes' : 'No'} | Signatures: ${hasSigs ? 'Yes' : 'No'} | Rev History: ${hasRevHist ? 'Yes' : 'No'}`
    },
    {
      label: 'Correct Contract Reference',
      pass: hasContractRef && !wrongProject,
      detail: wrongProject ? 'Document submitted under wrong contract/project' : (hasContractRef ? 'C2 EPC-BOP contract reference confirmed' : 'No contract reference found')
    },
    {
      label: 'Revision & Issue Purpose Alignment',
      pass: revIssueAligned,
      detail: revIssueAligned ? 'Revision and issue purpose are aligned' : 'Rev 0 cannot be AFC (Approved for Construction)'
    },
    {
      label: 'File Completeness',
      pass: endsClean,
      detail: endsClean ? 'Clean end-of-document marker found' : 'No end marker — file may be truncated'
    },
    {
      label: 'Second Cover Page',
      pass: hasSecondCover,
      detail: hasSecondCover ? 'Document Control Information block present' : 'Second cover page not detected'
    }
  ];

  res.json({
    fileName: doc.fileName,
    fileFormat: doc.fileFormat,
    fileSizeKB: doc.fileSizeKB,
    corrupted: doc.corrupted,
    qualityChecks,
    extraction: {
      method: extraction.method,
      pages: extraction.pages,
      chars: text.length,
      words: text.split(/\s+/).filter(Boolean).length,
      error: extraction.error || null
    }
  });
});

// GET /api/cross-validate/:id — Compare document content vs loadsheet & transmittal
app.get('/api/cross-validate/:id', async (req, res) => {
  const submittal = store.submittals.find(s => s.id === req.params.id);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }

  const doc = submittal.document;
  const ds = submittal.datasheet;
  if (!doc) {
    return res.json({ loadsheetChecks: [], transmittalChecks: [], extracted: null });
  }

  // Extract text from real PDF
  const extraction = await extractTextFromPdf(doc);
  if (!extraction.text) {
    return res.json({ loadsheetChecks: [], transmittalChecks: [], extracted: null, extraction });
  }

  const cleanText = extraction.text
    .replace(/-\n/g, '-')
    .replace(/\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ');
  const extracted = extractDocumentMetadata(cleanText);
  const loadsheetChecks = [];
  const transmittalChecks = [];

  // ── LOADSHEET vs DOCUMENT cross-validation ────────────────────────────
  if (ds) {
    // Document Number
    if (extracted.contractNumber && ds.documentNumber) {
      const match = extracted.contractNumber.toLowerCase() === ds.documentNumber.toLowerCase();
      loadsheetChecks.push({
        label: 'Document Number Match',
        field: 'Document Number',
        docValue: extracted.contractNumber,
        loadsheetValue: ds.documentNumber,
        pass: match,
        detail: match
          ? `Document number matches loadsheet: ${extracted.contractNumber}`
          : `Mismatch — Document: "${extracted.contractNumber}" vs Loadsheet: "${ds.documentNumber}"`
      });
    }

    // Document Title
    if (extracted.title && ds.title) {
      const docTitle = extracted.title.toLowerCase().substring(0, 40);
      const lsTitle = ds.title.toLowerCase().substring(0, 40);
      const match = docTitle.includes(lsTitle.substring(0, 20)) || lsTitle.includes(docTitle.substring(0, 20));
      loadsheetChecks.push({
        label: 'Document Title Match',
        field: 'Title',
        docValue: extracted.title.substring(0, 60),
        loadsheetValue: ds.title.substring(0, 60),
        pass: match,
        detail: match
          ? 'Document title matches loadsheet entry'
          : `Mismatch — Document: "${extracted.title.substring(0, 40)}" vs Loadsheet: "${ds.title.substring(0, 40)}"`
      });
    }

    // Revision
    if (extracted.revision && ds.revision) {
      const match = extracted.revision.toLowerCase().includes(ds.revision.toLowerCase()) ||
                    ds.revision.toLowerCase().includes(extracted.revision.toLowerCase());
      loadsheetChecks.push({
        label: 'Revision Match',
        field: 'Revision',
        docValue: extracted.revision,
        loadsheetValue: ds.revision,
        pass: match,
        detail: match
          ? `Revision matches: ${extracted.revision}`
          : `Mismatch — Document: "${extracted.revision}" vs Loadsheet: "${ds.revision}"`
      });
    }

    // Discipline
    if (extracted.discipline && ds.discipline) {
      const docDisc = extracted.discipline.toUpperCase().substring(0, 3);
      const lsDisc = ds.discipline.toUpperCase().substring(0, 3);
      const match = docDisc === lsDisc;
      loadsheetChecks.push({
        label: 'Discipline Match',
        field: 'Discipline',
        docValue: extracted.discipline,
        loadsheetValue: ds.discipline,
        pass: match,
        detail: match
          ? `Discipline matches: ${extracted.discipline}`
          : `Mismatch — Document: "${extracted.discipline}" vs Loadsheet: "${ds.discipline}"`
      });
    }

    // File Type
    if (ds.fileType) {
      const docFormat = doc.fileFormat || '';
      const match = docFormat.toUpperCase() === ds.fileType.toUpperCase();
      loadsheetChecks.push({
        label: 'File Type Match',
        field: 'File Type',
        docValue: docFormat,
        loadsheetValue: ds.fileType,
        pass: match,
        detail: match
          ? `File type matches: ${docFormat}`
          : `Mismatch — Document: "${docFormat}" vs Loadsheet: "${ds.fileType}"`
      });
    }

    // Security Classification (compare doc content vs default)
    if (extracted.securityClassification) {
      loadsheetChecks.push({
        label: 'Security Classification Present',
        field: 'Security Classification',
        docValue: extracted.securityClassification,
        loadsheetValue: 'Required',
        pass: true,
        detail: `Security classification found in document: ${extracted.securityClassification}`
      });
    } else {
      loadsheetChecks.push({
        label: 'Security Classification Present',
        field: 'Security Classification',
        docValue: 'Not found',
        loadsheetValue: 'Required',
        pass: false,
        detail: 'Security classification not found in document — required field'
      });
    }

    // Issue Purpose
    if (extracted.issuePurpose) {
      loadsheetChecks.push({
        label: 'Issue Purpose Present',
        field: 'Issue Purpose',
        docValue: extracted.issuePurpose,
        loadsheetValue: submittal.reasonForIssue || 'N/A',
        pass: true,
        detail: `Issue purpose found in document: ${extracted.issuePurpose}`
      });
    } else {
      loadsheetChecks.push({
        label: 'Issue Purpose Present',
        field: 'Issue Purpose',
        docValue: 'Not found',
        loadsheetValue: submittal.reasonForIssue || 'N/A',
        pass: false,
        detail: 'Issue purpose not found in document — required field'
      });
    }
  }

  // ── TRANSMITTAL vs DOCUMENT cross-validation ──────────────────────────
  if (submittal.transmittalNumber) {
    // If transmittal exists, verify fields were pulled correctly from document
    if (extracted.fromOrganisation) {
      const orgMatch = submittal.fromOrganisation &&
        extracted.fromOrganisation.toUpperCase().includes(submittal.fromOrganisation.toUpperCase().substring(0, 3));
      transmittalChecks.push({
        label: 'From Organisation Match',
        field: 'From Organisation',
        docValue: extracted.fromOrganisation,
        transmittalValue: submittal.fromOrganisation,
        pass: orgMatch,
        detail: orgMatch
          ? `Organisation matches: ${extracted.fromOrganisation}`
          : `Mismatch — Document: "${extracted.fromOrganisation}" vs Transmittal: "${submittal.fromOrganisation}"`
      });
    }

    if (extracted.project) {
      const isCP2 = /CP2|VG\s*CP2|Venture\s+Global/i.test(extracted.project);
      transmittalChecks.push({
        label: 'Project Reference Valid',
        field: 'Project',
        docValue: extracted.project.substring(0, 50),
        transmittalValue: submittal.contract || 'C2 EPC - BOP',
        pass: isCP2,
        detail: isCP2
          ? 'Document project reference matches CP2 contract'
          : `Document references "${extracted.project}" — does not match CP2 contract`
      });
    }

    if (extracted.documentType) {
      transmittalChecks.push({
        label: 'Document Type Extracted',
        field: 'Document Type',
        docValue: extracted.documentType,
        transmittalValue: 'Expected from document',
        pass: true,
        detail: `Document type "${extracted.documentType}" extracted for transmittal`
      });
    } else {
      transmittalChecks.push({
        label: 'Document Type Extracted',
        field: 'Document Type',
        docValue: 'Not found',
        transmittalValue: 'Required',
        pass: false,
        detail: 'Document type could not be extracted — transmittal field will be empty'
      });
    }
  } else {
    // No transmittal yet — pre-validate that required fields are extractable
    const extractable = ['contractNumber', 'title', 'revision', 'issuePurpose', 'securityClassification', 'documentType', 'discipline', 'fromOrganisation'];
    const found = extractable.filter(f => extracted[f]);
    const missing = extractable.filter(f => !extracted[f]);

    transmittalChecks.push({
      label: 'Transmittal Field Readiness',
      field: 'All Required Fields',
      docValue: `${found.length}/${extractable.length} extractable`,
      transmittalValue: `${extractable.length} required`,
      pass: missing.length === 0,
      detail: missing.length === 0
        ? 'All required transmittal fields can be extracted from document'
        : `Missing fields for transmittal: ${missing.join(', ')}`
    });

    missing.forEach(f => {
      transmittalChecks.push({
        label: `Missing: ${f}`,
        field: f,
        docValue: 'Not found',
        transmittalValue: 'Required for transmittal',
        pass: false,
        detail: `"${f}" could not be extracted from document — transmittal will be incomplete`
      });
    });
  }

  res.json({ loadsheetChecks, transmittalChecks, extracted });
});

// POST /api/transmittal/create
app.post('/api/transmittal/create', (req, res) => {
  const { submittalId } = req.body;
  const submittal = store.submittals.find(s => s.id === submittalId);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  const transmittalNumber = `TR-CP2-${Date.now().toString(36).toUpperCase()}`;
  submittal.transmittalNumber = transmittalNumber;
  res.json({
    success: true,
    transmittalNumber,
    date: new Date().toISOString().split('T')[0],
    documentReference: submittal.documentNumber
  });
});

// POST /api/submittal/approve
app.post('/api/submittal/approve', (req, res) => {
  const { submittalId, revisionNumber } = req.body;
  const submittal = store.submittals.find(s => s.id === submittalId);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  if (!revisionNumber || !revisionNumber.trim()) {
    return res.status(400).json({ error: 'Revision number is required' });
  }
  submittal.approved = true;
  submittal.revision = revisionNumber.trim();
  res.json({ success: true, message: 'Submittal approved', revision: submittal.revision });
});

// POST /api/submittal/bot-reviewed
app.post('/api/submittal/bot-reviewed', (req, res) => {
  const { submittalId } = req.body;
  const submittal = store.submittals.find(s => s.id === submittalId);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  submittal.status = 'Bot Reviewed';
  submittal.stepName = 'Bot Reviewed';
  res.json({ success: true, message: 'Status set to Bot Reviewed', status: submittal.status });
});

// POST /api/submittal/bot-rejected
// Used by the bot when a document fails any validation step.
// Renders as a red badge in the To Do list so the demo audience sees the failure.
app.post('/api/submittal/bot-rejected', (req, res) => {
  const { submittalId, reason } = req.body;
  const submittal = store.submittals.find(s => s.id === submittalId);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  submittal.status = 'Bot Rejected';
  submittal.stepName = 'Bot Rejected';
  submittal.rejectionReason = reason || 'Validation failed';
  res.json({ success: true, message: 'Status set to Bot Rejected', status: submittal.status });
});

// POST /api/submittal/complete  (available but bot must NOT use this)
app.post('/api/submittal/complete', (req, res) => {
  const { submittalId } = req.body;
  const submittal = store.submittals.find(s => s.id === submittalId);
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }
  submittal.status = 'Complete';
  submittal.stepName = 'Complete';
  res.json({ success: true, message: 'Status set to Complete', status: submittal.status });
});

// POST /api/reset  — re-seed data for re-runnable tests
app.post('/api/reset', (req, res) => {
  store = createSeedData();
  res.json({ success: true, message: 'Data reset to seed state' });
});

// Catch-all: serve frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`HxGN SDx Mimic App running at http://localhost:${PORT}`);
});
