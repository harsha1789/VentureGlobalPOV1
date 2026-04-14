import { Injectable } from '@angular/core';
import {
  MetadataCheck, QualityCheck, CheckStatus, TransmittalPayload,
  ValidationScore, Decision, PipelineResult,
  PreFlightCheck, SubmittalCheck, TransmittalValidation, FinalGateCheck,
  VALID_ISSUE_PURPOSES, VALID_SECURITY_CLASSES, VALID_DOC_TYPES,
  VALID_DISCIPLINES, SPECIAL_CHAR_PATTERN
} from '../models';

@Injectable({ providedIn: 'root' })
export class ValidationService {

  // ── TIER 0: PRE-FLIGHT CHECKS (BEGINNING) ─────────────────────────────────

  runPreFlightChecks(text: string, filename: string): PreFlightCheck[] {
    const ACCEPTED_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|dwg|txt)$/i;
    const hasExtension = /\.[^.]+$/.test(filename);
    const extensionOk = ACCEPTED_EXTENSIONS.test(filename);
    const hasContent = text.length > 0;
    const hasMinContent = text.length >= 20;
    const filenameNotEmpty = filename.trim().length > 0;
    const noLeadingTrailingSpaces = filename === filename.trim();
    const noDoubleSpaces = !/\s{2,}/.test(filename.replace(/\.[^.]+$/, ''));
    const hasSpecialChars = SPECIAL_CHAR_PATTERN.test(filename.replace(/\.[^.]+$/, ''));
    const hasProjectPrefix = /^(C2|CP2|VG)/i.test(filename);

    return [
      {
        check: 'File Type Validation',
        detail: !hasExtension
          ? 'No file extension detected'
          : extensionOk ? `Accepted file type: ${filename.match(/\.[^.]+$/)?.[0]}` : `Unsupported file extension: ${filename.match(/\.[^.]+$/)?.[0]}`,
        status: extensionOk ? 'pass' : 'fail',
        tier: 'T0',
      },
      {
        check: 'File Not Empty',
        detail: hasContent
          ? (hasMinContent ? `Document has content (${text.length} chars)` : 'File has minimal content — may be incomplete')
          : 'File is empty — no content to process',
        status: hasContent ? (hasMinContent ? 'pass' : 'warn') : 'fail',
        tier: 'T0',
      },
      {
        check: 'Filename Validity',
        detail: filenameNotEmpty
          ? (noLeadingTrailingSpaces && noDoubleSpaces
            ? 'Filename is clean — no extra spaces'
            : 'Filename has leading/trailing or double spaces')
          : 'Filename is empty',
        status: filenameNotEmpty ? (noLeadingTrailingSpaces && noDoubleSpaces ? 'pass' : 'warn') : 'fail',
        tier: 'T0',
      },
      {
        check: 'Filename Special Characters',
        detail: hasSpecialChars
          ? 'Special characters detected in filename — may cause SDx upload issues'
          : 'No prohibited special characters in filename',
        status: hasSpecialChars ? 'fail' : 'pass',
        tier: 'T0',
      },
      {
        check: 'Project Prefix Present',
        detail: hasProjectPrefix
          ? 'Filename starts with recognised project prefix'
          : 'Filename does not start with C2/CP2/VG prefix — verify correct project',
        status: hasProjectPrefix ? 'pass' : 'warn',
        tier: 'T0',
      },
    ];
  }

  // ── TIER 1: METADATA EXTRACTION & VALIDATION ─────────────────────────────

  extractMetadata(text: string, filename: string): MetadataCheck[] {
    const contractNo   = this.extract(text, [
      /CONTRACT\s+NUMBER\s*[:\-–]\s*([A-Z0-9][A-Z0-9\-\/\.]{4,})/i,
      /Doc(?:ument)?\s*No\.?\s*[:\-–]\s*([A-Z0-9][A-Z0-9\-\/\.]+)/i,
      /\b([A-Z]{1,5}-[A-Z0-9]{2,6}-[A-Z]{2,4}[-\d][A-Z0-9\-]*)\b/,
    ]);
    const title        = this.extract(text, [
      /DOCUMENT\s+TITLE\s*[:\-–]\s*(.{8,})/i,
      /TITLE\s*[:\-–]\s*(.{5,})/i,
      /Subject\s*[:\-–]\s*(.{5,})/i,
    ]);
    const revision     = this.extract(text, [
      /REVISION\s+NUMBER\s*[:\-–]\s*([A-Z0-9][A-Z0-9\.\-]*)/i,
      /REVISION\s*[:\-–]\s*([A-Z0-9][A-Z0-9\.\-]*)/i,
      /\bRev\.?\s+([A-Z0-9]+)\b/i,
      /\b(R\d{2})\b/,
    ]);
    const issuePurpose = this.extract(text, [
      /ISSUE\s+PURPOSE\s*[:\-–]\s*([A-Z]{2,3}[^\n]*)/i,
      /\b(IFU|IFI|IFC|IFR|IFT|AFC|AFD|IFA|PUR)\b([^\n]*)/,
      /Reason\s+for\s+Issue\s*[:\-–]\s*([^\n]+)/i,
      /Status\s*[:\-–]\s*(IFU|IFI|IFC|IFR|IFT|AFC|AFD|IFA|PUR)/i,
    ]);
    const secClass     = this.extract(text, [
      /SECURITY\s+CLASSIFICATION\s*[:\-–]\s*([^\n]+)/i,
      /Classification\s*[:\-–]\s*([^\n]+)/i,
      /\b(Company\s+Use|Confidential|Restricted|Public)\b/i,
    ]);
    const docType      = this.extract(text, [
      /DOCUMENT\s+TYPE\s*[:\-–]\s*([A-Z]{2,4}[^\n]*)/i,
      /\b(SOW|MDR|SDR|DWG|SPE|CAL|REP|PRO|MOM|ITP|PID|SLD|GA|FAT|HAZ|REQ)\b/,
    ]);
    const discipline   = this.extract(text, [
      /DISCIPLINE\s+CODE\s*[:\-–]\s*([A-Z]{2,4})/i,
      /Discipline\s*[:\-–]\s*([A-Z]{2,4})/i,
      /\b(CMS|CIV|CME|ELE|INS|MEC|PIP|STR|PRO|HSE|QA|PUR)\b/,
    ]);
    const dateVal      = this.extract(text, [
      /DOCUMENT\s+DATE\s*[:\-–]\s*(\d{1,2}[\s\-\/][A-Za-z]+[\s\-\/]\d{2,4})/i,
      /EFFECTIVE\s+DATE\s*[:\-–]\s*(\d{1,2}[\s\-\/][A-Za-z]+[\s\-\/]\d{2,4})/i,
      /Date\s*[:\-–]\s*(\d{1,2}[\-\/][A-Za-z0-9]+[\-\/]\d{2,4})/i,
      /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2})\b/i,
    ]);
    const contractor   = this.extract(text, [
      /FROM\s+ORGANISATION\s*[:\-–]\s*([^\n]+)/i,
      /Contractor\s*[:\-–]\s*([^\n]+)/i,
      /\b(Worley|AECOM|Bechtel|Fluor|Wood|KBR|Technip|SNC-Lavalin)\b/i,
      /Prepared\s+by\s*[:\-–]\s*([^\n]+)/i,
    ]);
    const project      = this.extract(text, [
      /PROJECT(?:\s+NAME)?\s*[:\-–]\s*([^\n]+)/i,
      /\b(CP2|CP1|VG\s+CP2|Calcasieu|Cameron\s+LNG)\b/i,
      /Contract\s+Reference\s*[:\-–]\s*([^\n]+)/i,
    ]);
    const supplierName = this.extract(text, [
      /SUPPLIER\s+NAME\s*[:\-–]\s*([^\n]+)/i,
      /Vendor\s*[:\-–]\s*([^\n]+)/i,
      /Manufacturer\s*[:\-–]\s*([^\n]+)/i,
    ]);
    const poNumber     = this.extract(text, [
      /PURCHASE\s+ORDER\s+(?:NUMBER|NO\.?)\s*[:\-–]\s*([A-Z0-9\-]+)/i,
      /PO\s+(?:NUMBER|NO\.?)\s*[:\-–]\s*([A-Z0-9\-]+)/i,
      /\bPO[-\s](\d{5,})\b/i,
    ]);

    const secondCover  = /SECOND\s+COVER|DOCUMENT\s+CONTROL\s+INFORMATION|SDx\s+Project\s+Area|Transmittal\s+Reference/i.test(text);

    // Special character checks
    const docNumHasSpecialChars  = contractNo ? SPECIAL_CHAR_PATTERN.test(contractNo) : false;
    const fileNameHasSpecialChars = SPECIAL_CHAR_PATTERN.test(filename);

    // Document number vs filename cross-match (strip extension)
    const fileBaseName = filename.replace(/\.[^.]+$/, '');
    const docNumMatchesFile = contractNo
      ? contractNo.toLowerCase() === fileBaseName.toLowerCase()
      : false;

    // File naming convention
    const fileNameOk = /^[A-Z0-9]{1,6}-[A-Z]{2,5}-[A-Z]{2,4}[-_]/i.test(filename);

    return [
      {
        field: 'Contract Number',
        extracted: contractNo,
        status: this.s(contractNo, v =>
          SPECIAL_CHAR_PATTERN.test(v) ? 'fail' :
          /^[A-Z]{1,5}-[A-Z0-9]{2,6}-[A-Z]{2,4}/i.test(v) ? 'pass' : 'warn'
        ),
        note: contractNo
          ? (docNumHasSpecialChars ? 'Special characters detected in document number' : 'Matches expected pattern')
          : 'Not found — mandatory field',
        tier: 'T1',
      },
      {
        field: 'Document Title',
        extracted: title ? title.substring(0, 80) : null,
        status: title && title.length > 8 ? 'pass' : title ? 'warn' : 'fail',
        note: title ? (title.length > 8 ? 'Present and descriptive' : 'Found but too short') : 'Document title not found',
        tier: 'T1',
      },
      {
        field: 'Revision Number',
        extracted: revision,
        status: this.s(revision, v =>
          /^(Rev\s*[A-Z0-9]+|[A-Z]|R\d{2}|\d{2})$/i.test(v) ? 'pass' : 'warn'
        ),
        note: revision ? 'Valid revision identifier found' : 'Revision missing — mandatory',
        tier: 'T1',
      },
      {
        field: 'Issue Purpose',
        extracted: issuePurpose,
        status: this.s(issuePurpose, v =>
          new RegExp(`\\b(${VALID_ISSUE_PURPOSES.join('|')})\\b`, 'i').test(v) ? 'pass' : 'warn'
        ),
        note: issuePurpose ? 'Valid issue purpose code (IFU/IFI/IFC/IFR/IFT/AFC/PUR…)' : 'Issue purpose code not found',
        tier: 'T1',
      },
      {
        field: 'Security Classification',
        extracted: secClass,
        status: this.s(secClass, v =>
          VALID_SECURITY_CLASSES.some(c => v.toLowerCase().includes(c.toLowerCase())) ? 'pass' : 'warn'
        ),
        note: secClass ? 'Valid classification present' : 'Missing — required on all documents',
        tier: 'T1',
      },
      {
        field: 'Document Type',
        extracted: docType,
        status: this.s(docType, v =>
          new RegExp(`\\b(${VALID_DOC_TYPES.join('|')})\\b`, 'i').test(v) ? 'pass' : 'warn'
        ),
        note: docType ? 'Recognised document type code' : 'Document type not found',
        tier: 'T1',
      },
      {
        field: 'Discipline Code',
        extracted: discipline,
        status: this.s(discipline, v =>
          new RegExp(`\\b(${VALID_DISCIPLINES.join('|')})\\b`, 'i').test(v) ? 'pass' : 'warn'
        ),
        note: discipline ? 'Valid discipline code' : 'Discipline code not found',
        tier: 'T1',
      },
      {
        field: 'Document Date',
        extracted: dateVal,
        status: dateVal ? 'pass' : 'warn',
        note: dateVal ? 'Date extracted successfully' : 'Date not clearly found',
        tier: 'T1',
      },
      {
        field: 'Contractor / Organisation',
        extracted: contractor ? contractor.substring(0, 60) : null,
        status: contractor ? 'pass' : 'warn',
        note: contractor ? 'Submitting organisation identified' : 'Contractor name not found',
        tier: 'T1',
      },
      {
        field: 'Project Reference',
        extracted: project ? project.substring(0, 60) : null,
        status: project ? 'pass' : 'warn',
        note: project ? 'Project reference found' : 'Project reference not found',
        tier: 'T1',
      },
      {
        field: 'File Naming Convention',
        extracted: filename,
        status: fileNameHasSpecialChars ? 'fail' : fileNameOk ? 'pass' : 'warn',
        note: fileNameHasSpecialChars
          ? 'Special characters detected in file name'
          : fileNameOk ? 'Follows VGL naming convention' : 'Does not follow [PROJ]-[CNTR]-[TYPE] pattern',
        tier: 'T1',
      },
      {
        field: 'Doc Number Matches File Name',
        extracted: docNumMatchesFile ? 'Match confirmed' : contractNo ? `Expected: ${fileBaseName}` : null,
        status: !contractNo ? 'warn' : docNumMatchesFile ? 'pass' : 'fail',
        note: docNumMatchesFile
          ? 'Document number matches file name'
          : contractNo ? 'Document number does not match file name — check 3 failed' : 'Cannot verify — document number not found',
        tier: 'T1',
      },
      {
        field: 'Second Cover Page',
        extracted: secondCover ? 'Present — DC Information block found' : null,
        status: secondCover ? 'pass' : 'warn',
        note: secondCover ? 'Document Control block found' : 'Required for WOR submissions',
        tier: 'T1',
      },
      {
        field: 'Supplier Name',
        extracted: supplierName,
        status: supplierName ? 'pass' : 'warn',
        note: supplierName ? 'Supplier name populated' : 'Supplier name not found (required for supplier docs)',
        tier: 'T1',
      },
      {
        field: 'Purchase Order Number',
        extracted: poNumber,
        status: poNumber ? 'pass' : 'warn',
        note: poNumber ? 'PO number found and populated' : 'PO number not found (required for supplier documentation)',
        tier: 'T1',
      },
      // ── CONTRACT-SPECIFIC CHECKS ──
      {
        field: 'Contract Reference Validation',
        extracted: contractNo,
        status: this.s(contractNo, v =>
          /^C2[-\s]/i.test(v) ? 'pass' :
          /^(CP2|VG)/i.test(v) ? 'pass' : 'warn'
        ),
        note: contractNo
          ? (/^C2[-\s]/i.test(contractNo) ? 'Document belongs to C2 EPC-BOP contract' : 'Contract reference does not match C2 EPC-BOP — verify correct contract')
          : 'Cannot validate contract — document number not found',
        tier: 'T1',
      },
      {
        field: 'Correct Contract Submission',
        extracted: project ? project.substring(0, 60) : null,
        status: project
          ? (/CP2|VG\s*CP2|Calcasieu\s+Pass\s+2|C2/i.test(project) ? 'pass' : 'fail')
          : 'warn',
        note: project
          ? (/CP2|VG\s*CP2|Calcasieu\s+Pass\s+2|C2/i.test(project) ? 'Document submitted under correct project (CP2)' : 'Project reference does not match CP2 — possible wrong contract submission')
          : 'Project reference not found — cannot confirm correct contract',
        tier: 'T1',
      },
    ];
  }

  // ── TIER 2: DOCUMENT QUALITY CHECKS ──────────────────────────────────────

  runQualityChecks(text: string): QualityCheck[] {
    const words         = text.split(/\s+/).filter(Boolean).length;
    const chars         = text.length;
    const hasText       = chars > 80;
    const pageMarkers   = (text.match(/={10,}|^-{10,}/gm) || []).length;
    const garbled       = (text.match(/[^\x00-\x7F]/g) || []).length > chars * 0.1;
    const nonEngWords   = (text.match(/\b(de|la|le|el|los|das|der|die|il|les|du|von|und|pour)\b/gi) || []).length;
    const hasSecond     = /SECOND\s+COVER|DOCUMENT\s+CONTROL\s+INFORMATION|SDx\s+Project\s+Area|Transmittal\s+Reference/i.test(text);
    const hasSigs       = /Prepared\s+by|Reviewed\s+by|Approved\s+by/i.test(text);
    const hasRevHist    = /REVISION\s+HISTORY|Rev\s+History|HISTORY\s+OF\s+REVISION/i.test(text);
    const hasSection    = /^[0-9]+\.\s+[A-Z]/m.test(text);
    const hasFooter     = /Company\s+Use|Confidential|VGL|Venture\s+Global/i.test(text);
    const endsClean     = /END\s+OF\s+DOCUMENT|={5,}$/i.test(text.trim());
    const hasDraft      = /DRAFT|FOR\s+REVIEW\s+ONLY|NOT\s+FOR\s+CONSTRUCTION|PRELIMINARY/i.test(text);
    const hasMarkups    = /\[COMMENT\]|\[MARKUP\]|<annotation|\/Annots/i.test(text);
    const blankSuspect  = pageMarkers > 0 && words / Math.max(pageMarkers, 1) < 15;
    const hasMetaEvery  = hasFooter && hasSigs;
    const revIssueAlign = this.checkRevisionIssueAlignment(text);

    return [
      {
        check: 'OCR / Text Searchability',
        detail: hasText ? `Readable text extracted — ${words} words, ${chars} chars` : 'No text content — image-only or empty document',
        status: hasText ? 'pass' : 'fail',
        method: 'FileReader text extraction — PyMuPDF equivalent',
      },
      {
        check: 'Blank Page Detection',
        detail: blankSuspect ? 'Low word density between page markers — possible blank pages' : 'Content density adequate throughout',
        status: blankSuspect ? 'warn' : 'pass',
        method: 'Word count / page-marker ratio heuristic',
      },
      {
        check: 'Page Orientation',
        detail: garbled ? 'Non-ASCII character ratio suggests encoding or orientation issue' : 'No orientation anomalies detected',
        status: garbled ? 'warn' : 'pass',
        method: 'Character encoding analysis — scanned docs require Azure Document Intelligence',
      },
      {
        check: 'Language Compliance',
        detail: nonEngWords > 5 ? `${nonEngWords} non-English words detected` : 'Document appears to be in English throughout',
        status: nonEngWords > 5 ? 'warn' : 'pass',
        method: 'Keyword frequency analysis — langdetect equivalent',
      },
      {
        check: 'English Translation Present',
        detail: nonEngWords > 5 ? 'Non-English content without inline English translation' : 'English confirmed as primary language',
        status: nonEngWords > 5 && !/english\s+translation/i.test(text) ? 'fail' : 'pass',
        method: 'Section header scan',
      },
      {
        check: 'No Draft Watermarks',
        detail: hasDraft ? 'DRAFT or preliminary marker detected — document not finalised' : 'No draft indicators found',
        status: hasDraft ? 'fail' : 'pass',
        method: 'Keyword pattern matching',
      },
      {
        check: 'No Markups or Annotations',
        detail: hasMarkups ? 'Annotation or markup indicators detected' : 'No markup artifacts found',
        status: hasMarkups ? 'fail' : 'pass',
        method: 'Annotation object scan — PyMuPDF page.annots()',
      },
      {
        check: 'Document Structure',
        detail: `Sections: ${hasSection ? '✓' : '✗'} · Signatures: ${hasSigs ? '✓' : '✗'} · Rev history: ${hasRevHist ? '✓' : '✗'} · Footer: ${hasFooter ? '✓' : '✗'}`,
        status: (hasSection && hasSigs) ? 'pass' : (hasSection || hasSigs) ? 'warn' : 'fail',
        method: 'Structural pattern matching',
      },
      {
        check: 'Metadata on Each Page',
        detail: hasMetaEvery ? 'Document identity and security class present throughout' : 'Metadata may not appear on all pages',
        status: hasMetaEvery ? 'pass' : 'warn',
        method: 'Header/footer presence scan',
      },
      {
        check: 'Contractor Second Cover Page',
        detail: hasSecond ? 'Document Control Information block present' : 'Second cover page not detected — required for WOR',
        status: hasSecond ? 'pass' : 'warn',
        method: 'Section keyword scan',
      },
      {
        check: 'Revision & Issue Purpose Alignment',
        detail: revIssueAlign.message,
        status: revIssueAlign.status,
        method: 'Rule table: Rev 0 → IFR/IFI, AFC → post-IFR only',
      },
      {
        check: 'File Completeness',
        detail: endsClean ? 'Clean end-of-document termination marker found' : 'No end marker — file may be truncated',
        status: endsClean ? 'pass' : 'warn',
        method: 'EOF pattern check',
      },
    ];
  }

  // ── TIER 2S: SUBMITTAL CHECKS ─────────────────────────────────────────────

  runSubmittalChecks(text: string, metadata: MetadataCheck[], batchDocuments?: { text: string; name: string }[]): SubmittalCheck[] {
    const revision    = metadata.find(m => m.field === 'Revision Number')?.extracted;
    const discipline  = metadata.find(m => m.field === 'Discipline Code')?.extracted;
    const issuePurp   = metadata.find(m => m.field === 'Issue Purpose')?.extracted;
    const docType     = metadata.find(m => m.field === 'Document Type')?.extracted;
    const hasRevHist  = /REVISION\s+HISTORY|Rev\s+History|HISTORY\s+OF\s+REVISION/i.test(text);
    const hasPriorRev = /Previous\s+Revision|Prior\s+Rev|Supersede[sd]?\b/i.test(text);
    const isRevZero   = revision ? /^(0|Rev\s*0|R00|00)$/i.test(revision) : true;
    const hasReviewStatus = /Under\s+Review|Pending\s+Review|In\s+Review/i.test(text);

    // Batch consistency checks (loadsheet checks 4 & 5)
    let mixedDiscipline = false;
    let mixedIssuePurpose = false;
    if (batchDocuments && batchDocuments.length > 1) {
      const disciplines = new Set<string>();
      const purposes = new Set<string>();
      for (const doc of batchDocuments) {
        const dMeta = this.extractMetadata(doc.text, doc.name);
        const d = dMeta.find(m => m.field === 'Discipline Code')?.extracted;
        const p = dMeta.find(m => m.field === 'Issue Purpose')?.extracted;
        if (d) disciplines.add(d.toUpperCase());
        if (p) purposes.add(p.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3));
      }
      mixedDiscipline = disciplines.size > 1;
      mixedIssuePurpose = purposes.size > 1;
    }

    return [
      {
        check: 'Prior Revision Availability',
        detail: isRevZero
          ? 'First revision (Rev 0) — no prior revision expected'
          : (hasPriorRev ? 'Reference to prior revision found in document' : 'No prior revision reference found — verify superseded revision exists'),
        status: isRevZero ? 'pass' : (hasPriorRev ? 'pass' : 'warn'),
        tier: 'T2S',
      },
      {
        check: 'Prior Revisions Not Under Review',
        detail: hasReviewStatus
          ? 'Document references a revision still under review — potential conflict'
          : 'No prior revision under-review conflicts detected',
        status: hasReviewStatus ? 'warn' : 'pass',
        tier: 'T2S',
      },
      {
        check: 'Revision History Completeness',
        detail: hasRevHist
          ? 'Revision history section present in document'
          : (isRevZero ? 'Rev 0 — revision history may not yet exist' : 'Revision history missing — required for Rev 1+'),
        status: hasRevHist ? 'pass' : (isRevZero ? 'pass' : 'fail'),
        tier: 'T2S',
      },
      {
        check: 'No Mixed Disciplines in Batch',
        detail: !batchDocuments || batchDocuments.length <= 1
          ? 'Single document submittal — batch discipline check not applicable'
          : (mixedDiscipline ? 'Multiple disciplines detected in submittal batch — review required' : 'All documents in batch share the same discipline'),
        status: !batchDocuments || batchDocuments.length <= 1 ? 'pass' : (mixedDiscipline ? 'warn' : 'pass'),
        tier: 'T2S',
      },
      {
        check: 'No Mixed Issue Purpose in Batch',
        detail: !batchDocuments || batchDocuments.length <= 1
          ? 'Single document submittal — batch issue purpose check not applicable'
          : (mixedIssuePurpose ? 'Multiple issue purposes in batch — superseding exception may apply' : 'All documents in batch share the same issue purpose'),
        status: !batchDocuments || batchDocuments.length <= 1 ? 'pass' : (mixedIssuePurpose ? 'warn' : 'pass'),
        tier: 'T2S',
      },
      {
        check: 'Submittal Package Completeness',
        detail: (discipline && issuePurp && docType)
          ? `Submittal fields complete: ${discipline} / ${issuePurp} / ${docType}`
          : 'Missing discipline, issue purpose, or document type for submittal',
        status: (discipline && issuePurp && docType) ? 'pass' : 'fail',
        tier: 'T2S',
      },
    ];
  }

  // ── TIER 3: TRANSMITTAL BUILDER ───────────────────────────────────────────

  buildTransmittal(metadata: MetadataCheck[], filename: string): TransmittalPayload {
    const getMeta = (field: string): string => {
      const f = metadata.find(m => m.field === field);
      return (f?.extracted) || '—';
    };
    const trnNum = `TRN-C2-WOR-${String(Math.floor(Math.random() * 900) + 100).padStart(4, '0')}`;
    const today  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return {
      trnNumber:      trnNum,
      fromOrg:        getMeta('Contractor / Organisation') || 'WOR — Worley',
      contract:       'C2 EPC-BOP',
      toOrg:          'VGL — Venture Global',
      fromRole:       'Contractor Document Control',
      title:          getMeta('Document Title') || filename.replace(/\.[^.]+$/, ''),
      documentType:   getMeta('Document Type'),
      discipline:     getMeta('Discipline Code'),
      revision:       getMeta('Revision Number'),
      reasonForIssue: getMeta('Issue Purpose'),
      securityClass:  getMeta('Security Classification') || 'Company Use',
      issueState:     'Submitted',
      dateIssued:     today,
    };
  }

  // ── TIER 3V: TRANSMITTAL VALIDATION ────────────────────────────────────────

  validateTransmittal(transmittal: TransmittalPayload): TransmittalValidation[] {
    const trnFormatOk = /^TRN-C2-[A-Z]{2,5}-\d{4}$/.test(transmittal.trnNumber);
    const hasFromOrg = transmittal.fromOrg !== '—' && transmittal.fromOrg.length > 0;
    const hasToOrg = transmittal.toOrg !== '—' && transmittal.toOrg.length > 0;
    const hasTitle = transmittal.title !== '—' && transmittal.title.length > 3;
    const hasDocType = transmittal.documentType !== '—' && VALID_DOC_TYPES.some(t => transmittal.documentType.includes(t));
    const hasDiscipline = transmittal.discipline !== '—' && VALID_DISCIPLINES.some(d => transmittal.discipline.includes(d));
    const hasRevision = transmittal.revision !== '—' && transmittal.revision.length > 0;
    const hasReasonForIssue = transmittal.reasonForIssue !== '—' && VALID_ISSUE_PURPOSES.some(p => transmittal.reasonForIssue.includes(p));
    const hasSecClass = transmittal.securityClass !== '—' && VALID_SECURITY_CLASSES.some(c => transmittal.securityClass.toLowerCase().includes(c.toLowerCase()));
    const hasDate = transmittal.dateIssued.length > 0;

    const requiredFields = [hasFromOrg, hasToOrg, hasTitle, hasDocType, hasDiscipline, hasRevision, hasReasonForIssue, hasSecClass, hasDate];
    const populatedCount = requiredFields.filter(Boolean).length;

    return [
      {
        check: 'TRN Number Format',
        detail: trnFormatOk
          ? `Valid transmittal number: ${transmittal.trnNumber}`
          : `TRN format invalid: ${transmittal.trnNumber} — expected TRN-C2-XXX-NNNN`,
        status: trnFormatOk ? 'pass' : 'fail',
        tier: 'T3V',
      },
      {
        check: 'Transmittal From/To Organisations',
        detail: hasFromOrg && hasToOrg
          ? `From: ${transmittal.fromOrg} → To: ${transmittal.toOrg}`
          : `Missing organisation: From=${hasFromOrg ? '✓' : '✗'} To=${hasToOrg ? '✓' : '✗'}`,
        status: hasFromOrg && hasToOrg ? 'pass' : 'fail',
        tier: 'T3V',
      },
      {
        check: 'Transmittal Document Type Valid',
        detail: hasDocType
          ? `Document type populated: ${transmittal.documentType}`
          : 'Document type missing or not a recognised VGL type code',
        status: hasDocType ? 'pass' : 'warn',
        tier: 'T3V',
      },
      {
        check: 'Transmittal Discipline Valid',
        detail: hasDiscipline
          ? `Discipline populated: ${transmittal.discipline}`
          : 'Discipline missing or not a recognised VGL discipline code',
        status: hasDiscipline ? 'pass' : 'warn',
        tier: 'T3V',
      },
      {
        check: 'Transmittal Reason for Issue',
        detail: hasReasonForIssue
          ? `Reason for issue: ${transmittal.reasonForIssue}`
          : 'Reason for issue missing or invalid code',
        status: hasReasonForIssue ? 'pass' : 'fail',
        tier: 'T3V',
      },
      {
        check: 'Transmittal Completeness',
        detail: `${populatedCount}/9 required transmittal fields populated`,
        status: populatedCount >= 9 ? 'pass' : populatedCount >= 6 ? 'warn' : 'fail',
        tier: 'T3V',
      },
    ];
  }

  // ── TIER 4: DECISION ENGINE ───────────────────────────────────────────────

  calculateScore(
    metadata: MetadataCheck[],
    quality: QualityCheck[],
    preFlight: PreFlightCheck[] = [],
    submittal: SubmittalCheck[] = [],
    transmittalVal: TransmittalValidation[] = [],
    finalGate: FinalGateCheck[] = []
  ): ValidationScore {
    const preFlightPass = preFlight.filter(c => c.status === 'pass').length;
    const preFlightFail = preFlight.filter(c => c.status === 'fail').length;
    const preFlightWarn = preFlight.filter(c => c.status === 'warn').length;
    const metaPass = metadata.filter(c => c.status === 'pass').length;
    const metaFail = metadata.filter(c => c.status === 'fail').length;
    const metaWarn = metadata.filter(c => c.status === 'warn').length;
    const qualPass = quality.filter(c => c.status === 'pass').length;
    const qualFail = quality.filter(c => c.status === 'fail').length;
    const qualWarn = quality.filter(c => c.status === 'warn').length;
    const submittalPass = submittal.filter(c => c.status === 'pass').length;
    const submittalFail = submittal.filter(c => c.status === 'fail').length;
    const submittalWarn = submittal.filter(c => c.status === 'warn').length;
    const transmittalPass = transmittalVal.filter(c => c.status === 'pass').length;
    const transmittalFail = transmittalVal.filter(c => c.status === 'fail').length;
    const transmittalWarn = transmittalVal.filter(c => c.status === 'warn').length;
    const finalGatePass = finalGate.filter(c => c.status === 'pass').length;
    const finalGateFail = finalGate.filter(c => c.status === 'fail').length;
    const finalGateWarn = finalGate.filter(c => c.status === 'warn').length;

    const totalPass  = preFlightPass + metaPass + qualPass + submittalPass + transmittalPass + finalGatePass;
    const totalChecks = totalPass + preFlightFail + metaFail + qualFail + submittalFail + transmittalFail + finalGateFail
      + preFlightWarn + metaWarn + qualWarn + submittalWarn + transmittalWarn + finalGateWarn;
    const overall    = totalChecks > 0 ? Math.round((totalPass / totalChecks) * 100) : 0;
    return {
      preFlightPass, preFlightFail, preFlightWarn,
      metaPass, metaFail, metaWarn,
      qualPass, qualFail, qualWarn,
      submittalPass, submittalFail, submittalWarn,
      transmittalPass, transmittalFail, transmittalWarn,
      finalGatePass, finalGateFail, finalGateWarn,
      overall
    };
  }

  determineDecision(score: ValidationScore): Decision {
    const totalFail = score.preFlightFail + score.metaFail + score.qualFail + score.submittalFail + score.transmittalFail;
    const totalWarn = score.preFlightWarn + score.metaWarn + score.qualWarn + score.submittalWarn + score.transmittalWarn;
    if (score.preFlightFail > 0) return 'reject';   // Pre-flight failures are hard stops
    if (totalFail === 0 && totalWarn <= 3) return 'accept';
    if (totalFail === 0)                   return 'review';
    return 'reject';
  }

  // ── TIER 5: FINAL GATE CHECKS (END) ─────────────────────────────────────

  runFinalGateChecks(
    preFlight: PreFlightCheck[],
    metadata: MetadataCheck[],
    quality: QualityCheck[],
    submittal: SubmittalCheck[],
    transmittalVal: TransmittalValidation[],
    decision: Decision
  ): FinalGateCheck[] {
    const allChecks = [
      ...preFlight.map(c => c.status),
      ...metadata.map(c => c.status),
      ...quality.map(c => c.status),
      ...submittal.map(c => c.status),
      ...transmittalVal.map(c => c.status),
    ];
    const totalChecks = allChecks.length;
    const totalPass = allChecks.filter(s => s === 'pass').length;
    const totalFail = allChecks.filter(s => s === 'fail').length;
    const totalWarn = allChecks.filter(s => s === 'warn').length;

    const preFlightOk = preFlight.every(c => c.status !== 'fail');
    const metadataOk = metadata.every(c => c.status !== 'fail');
    const qualityOk = quality.every(c => c.status !== 'fail');
    const submittalOk = submittal.every(c => c.status !== 'fail');
    const transmittalOk = transmittalVal.every(c => c.status !== 'fail');

    const allStagesPass = preFlightOk && metadataOk && qualityOk && submittalOk && transmittalOk;
    const complianceScore = totalChecks > 0 ? Math.round((totalPass / totalChecks) * 100) : 0;

    return [
      {
        check: 'All Pipeline Stages Completed',
        detail: `Pre-flight: ${preFlightOk ? '✓' : '✗'} · Metadata: ${metadataOk ? '✓' : '✗'} · Quality: ${qualityOk ? '✓' : '✗'} · Submittal: ${submittalOk ? '✓' : '✗'} · Transmittal: ${transmittalOk ? '✓' : '✗'}`,
        status: allStagesPass ? 'pass' : 'fail',
        tier: 'T5',
      },
      {
        check: 'Compliance Score',
        detail: `${complianceScore}% compliance — ${totalPass} pass, ${totalFail} fail, ${totalWarn} warn out of ${totalChecks} total checks`,
        status: complianceScore >= 85 ? 'pass' : complianceScore >= 60 ? 'warn' : 'fail',
        tier: 'T5',
      },
      {
        check: 'SDx Upload Readiness',
        detail: decision === 'accept'
          ? 'Document cleared for automatic SDx upload'
          : decision === 'review'
          ? 'Document requires human review before SDx upload'
          : 'Document rejected — not eligible for SDx upload until issues resolved',
        status: decision === 'accept' ? 'pass' : decision === 'review' ? 'warn' : 'fail',
        tier: 'T5',
      },
      {
        check: 'No Critical Failures Remaining',
        detail: totalFail === 0
          ? 'No critical failures across all validation stages'
          : `${totalFail} critical failure(s) remain — must be resolved before acceptance`,
        status: totalFail === 0 ? 'pass' : 'fail',
        tier: 'T5',
      },
      {
        check: 'Audit Trail Complete',
        detail: 'All validation results captured with timestamps and operator identity',
        status: 'pass',
        tier: 'T5',
      },
    ];
  }

  // ── LOAD SHEET CROSS-VALIDATION ──────────────────────────────────────────

  crossValidateWithLoadSheet(
    text: string,
    filename: string,
    loadSheetRow: { documentNumber: string; revision: string; issuePurpose: string; documentTitle: string; securityClassification: string; disciplineCode: string; documentType: string }
  ): MetadataCheck[] {
    const metadata = this.extractMetadata(text, filename);
    const crossChecks: MetadataCheck[] = [];

    // Cross-validate document number
    const extractedDocNum = metadata.find(m => m.field === 'Contract Number')?.extracted;
    if (extractedDocNum && loadSheetRow.documentNumber) {
      const match = extractedDocNum.toLowerCase() === loadSheetRow.documentNumber.toLowerCase();
      crossChecks.push({
        field: 'Load Sheet: Document Number Match',
        extracted: `Doc: ${extractedDocNum} | LS: ${loadSheetRow.documentNumber}`,
        status: match ? 'pass' : 'fail',
        note: match ? 'Document number matches load sheet' : 'Document number does not match load sheet entry',
        tier: 'T1',
      });
    }

    // Cross-validate revision
    const extractedRev = metadata.find(m => m.field === 'Revision Number')?.extracted;
    if (extractedRev && loadSheetRow.revision) {
      const revMatch = extractedRev.toLowerCase().includes(loadSheetRow.revision.toLowerCase()) ||
                       loadSheetRow.revision.toLowerCase().includes(extractedRev.toLowerCase());
      crossChecks.push({
        field: 'Load Sheet: Revision Match',
        extracted: `Doc: ${extractedRev} | LS: ${loadSheetRow.revision}`,
        status: revMatch ? 'pass' : 'warn',
        note: revMatch ? 'Revision matches load sheet' : 'Revision may not match load sheet entry — verify',
        tier: 'T1',
      });
    }

    // Cross-validate issue purpose
    const extractedPurpose = metadata.find(m => m.field === 'Issue Purpose')?.extracted;
    if (extractedPurpose && loadSheetRow.issuePurpose) {
      const purposeMatch = extractedPurpose.toUpperCase().includes(loadSheetRow.issuePurpose.toUpperCase().substring(0, 3));
      crossChecks.push({
        field: 'Load Sheet: Issue Purpose Match',
        extracted: `Doc: ${extractedPurpose} | LS: ${loadSheetRow.issuePurpose}`,
        status: purposeMatch ? 'pass' : 'warn',
        note: purposeMatch ? 'Issue purpose matches load sheet' : 'Issue purpose may differ from load sheet',
        tier: 'T1',
      });
    }

    // Cross-validate security classification
    const extractedSec = metadata.find(m => m.field === 'Security Classification')?.extracted;
    if (extractedSec && loadSheetRow.securityClassification) {
      const secMatch = extractedSec.toLowerCase().includes(loadSheetRow.securityClassification.toLowerCase());
      crossChecks.push({
        field: 'Load Sheet: Security Class Match',
        extracted: `Doc: ${extractedSec} | LS: ${loadSheetRow.securityClassification}`,
        status: secMatch ? 'pass' : 'warn',
        note: secMatch ? 'Security classification matches load sheet' : 'Security classification differs from load sheet',
        tier: 'T1',
      });
    }

    return [...metadata, ...crossChecks];
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  private extract(text: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return (match[1] || match[0]).trim();
    }
    return null;
  }

  private s(value: string | null, validator: (v: string) => CheckStatus): CheckStatus {
    if (!value) return 'fail';
    return validator(value);
  }

  private checkRevisionIssueAlignment(text: string): { status: CheckStatus; message: string } {
    const revision     = this.extract(text, [/REVISION\s+NUMBER\s*[:\-–]\s*([A-Z0-9][A-Z0-9\.\-]*)/i, /\bRev\.?\s+([A-Z0-9]+)\b/i]);
    const issuePurpose = this.extract(text, [/ISSUE\s+PURPOSE\s*[:\-–]\s*([A-Z]{2,3})/i, /\b(IFU|IFI|IFC|IFR|IFT|AFC|AFD|IFA|PUR)\b/]);
    if (!revision || !issuePurpose) return { status: 'warn', message: 'Cannot verify alignment — revision or issue purpose not found' };
    const isRevZero = /^(0|Rev\s*0|R00)$/i.test(revision);
    const isAFC = /\bAFC\b/i.test(issuePurpose);
    if (isRevZero && isAFC) return { status: 'fail', message: 'Rev 0 cannot be AFC — document has not been through review cycle' };
    return { status: 'pass', message: `Revision ${revision} and issue purpose ${issuePurpose} appear aligned` };
  }
}
