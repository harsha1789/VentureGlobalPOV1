import { TestBed } from '@angular/core/testing';
import { ValidationService } from './validation.service';

const VALID_TEXT = `
CONTRACT NUMBER:        C2-WOR-SOW-0042
DOCUMENT TITLE:         Statement of Work — Piping and Mechanical Installation
REVISION NUMBER:        Rev A
ISSUE PURPOSE:          IFR — Issued for Review
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE:          SOW — Statement of Work
DISCIPLINE CODE:        MEC — Mechanical
DOCUMENT DATE:          01 April 2026
FROM ORGANISATION:      WOR — Worley Group Pty Ltd
PROJECT:                Venture Global CP2 LNG — C2 EPC-BOP
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
SDx Project Area: C2
Prepared by: James R. Harrington   Date: 01-Apr-2026
Reviewed by: Sarah K. Okonkwo      Date: 02-Apr-2026
Approved by: Michael T. Brennan    Date: 03-Apr-2026
REVISION HISTORY
A  01-Apr-2026  First Issue
END OF DOCUMENT
Document: C2-WOR-SOW-0042 | Company Use
`;

const INVALID_TEXT = `
WORLEY GROUP
INTERNAL DOCUMENT
Title: Piping Work Scope
Prepared by: Dave
Date: sometime in March
Install pipes. Connect flanges. Test for leaks.
- Dave
`;

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ValidationService] });
    service = TestBed.inject(ValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── TIER 1 METADATA ──────────────────────────────────────────────────────

  describe('extractMetadata — valid document', () => {
    let checks: ReturnType<typeof service.extractMetadata>;

    beforeEach(() => {
      checks = service.extractMetadata(VALID_TEXT, 'C2-WOR-SOW-0042.txt');
    });

    it('should extract contract number as pass', () => {
      const c = checks.find(c => c.field === 'Contract Number');
      expect(c?.status).toBe('pass');
      expect(c?.extracted).toContain('C2-WOR-SOW-0042');
    });

    it('should extract document title as pass', () => {
      const c = checks.find(c => c.field === 'Document Title');
      expect(c?.status).toBe('pass');
    });

    it('should extract revision as pass', () => {
      const c = checks.find(c => c.field === 'Revision Number');
      expect(c?.status).toBe('pass');
      expect(c?.extracted).toContain('Rev A');
    });

    it('should extract issue purpose as pass', () => {
      const c = checks.find(c => c.field === 'Issue Purpose');
      expect(c?.status).toBe('pass');
      expect(c?.extracted).toContain('IFR');
    });

    it('should extract security classification as pass', () => {
      const c = checks.find(c => c.field === 'Security Classification');
      expect(c?.status).toBe('pass');
    });

    it('should extract document type as pass', () => {
      const c = checks.find(c => c.field === 'Document Type');
      expect(c?.status).toBe('pass');
      expect(c?.extracted).toContain('SOW');
    });

    it('should detect second cover page', () => {
      const c = checks.find(c => c.field === 'Second Cover Page');
      expect(c?.status).toBe('pass');
    });

    it('should verify doc number matches file name', () => {
      const c = checks.find(c => c.field === 'Doc Number Matches File Name');
      expect(c?.status).toBe('pass');
    });

    it('should validate file naming convention', () => {
      const c = checks.find(c => c.field === 'File Naming Convention');
      expect(c?.status).toBe('pass');
    });
  });

  describe('extractMetadata — invalid document', () => {
    let checks: ReturnType<typeof service.extractMetadata>;

    beforeEach(() => {
      checks = service.extractMetadata(INVALID_TEXT, 'WOR_doc_final_v3_SEND.txt');
    });

    it('should fail contract number', () => {
      const c = checks.find(c => c.field === 'Contract Number');
      expect(c?.status).toBe('fail');
    });

    it('should fail revision number', () => {
      const c = checks.find(c => c.field === 'Revision Number');
      expect(c?.status).toBe('fail');
    });

    it('should fail issue purpose', () => {
      const c = checks.find(c => c.field === 'Issue Purpose');
      expect(c?.status).toBe('fail');
    });

    it('should fail security classification', () => {
      const c = checks.find(c => c.field === 'Security Classification');
      expect(c?.status).toBe('fail');
    });

    it('should fail file naming convention', () => {
      const c = checks.find(c => c.field === 'File Naming Convention');
      expect(c?.status).not.toBe('pass');
    });

    it('should fail second cover page', () => {
      const c = checks.find(c => c.field === 'Second Cover Page');
      expect(c?.status).not.toBe('pass');
    });
  });

  describe('extractMetadata — special character detection', () => {
    it('should fail contract number with special chars', () => {
      const text = 'CONTRACT NUMBER: C2/WOR/SOW/0042\nDOCUMENT TITLE: Test';
      const checks = service.extractMetadata(text, 'C2-WOR-SOW-0042.txt');
      const c = checks.find(c => c.field === 'Contract Number');
      expect(c?.status).toBe('fail');
    });

    it('should fail file name with special chars', () => {
      const checks = service.extractMetadata(VALID_TEXT, 'C2-WOR-SOW-0042 (final).txt');
      const c = checks.find(c => c.field === 'File Naming Convention');
      expect(c?.status).toBe('fail');
    });
  });

  describe('extractMetadata — PUR issue purpose', () => {
    it('should recognise PUR as valid issue purpose', () => {
      const text = `CONTRACT NUMBER: C2-ELE-REQ-WOR-00006
DOCUMENT TITLE: High Voltage Cable Requisition
REVISION NUMBER: Rev 0
ISSUE PURPOSE: PUR — Issued for Purchase
SECURITY CLASSIFICATION: Company Use`;
      const checks = service.extractMetadata(text, 'C2-ELE-REQ-WOR-00006.txt');
      const c = checks.find(c => c.field === 'Issue Purpose');
      expect(c?.status).toBe('pass');
    });
  });

  // ── TIER 2 QUALITY ──────────────────────────────────────────────────────

  describe('runQualityChecks — valid document', () => {
    let checks: ReturnType<typeof service.runQualityChecks>;

    beforeEach(() => {
      checks = service.runQualityChecks(VALID_TEXT);
    });

    it('should pass OCR text check', () => {
      const c = checks.find(c => c.check === 'OCR / Text Searchability');
      expect(c?.status).toBe('pass');
    });

    it('should pass draft watermark check', () => {
      const c = checks.find(c => c.check === 'No Draft Watermarks');
      expect(c?.status).toBe('pass');
    });

    it('should pass file completeness check', () => {
      const c = checks.find(c => c.check === 'File Completeness');
      expect(c?.status).toBe('pass');
    });

    it('should pass revision issue alignment', () => {
      const c = checks.find(c => c.check === 'Revision & Issue Purpose Alignment');
      expect(c?.status).toBe('pass');
    });
  });

  describe('runQualityChecks — draft document', () => {
    it('should fail draft watermark check', () => {
      const text = 'DRAFT — NOT FOR CONSTRUCTION\nSome content here with enough words to pass OCR check.';
      const checks = service.runQualityChecks(text);
      const c = checks.find(c => c.check === 'No Draft Watermarks');
      expect(c?.status).toBe('fail');
    });
  });

  describe('runQualityChecks — empty document', () => {
    it('should fail OCR check for empty text', () => {
      const checks = service.runQualityChecks('');
      const c = checks.find(c => c.check === 'OCR / Text Searchability');
      expect(c?.status).toBe('fail');
    });
  });

  // ── TIER 3 TRANSMITTAL ───────────────────────────────────────────────────

  describe('buildTransmittal', () => {
    it('should build transmittal with TRN number', () => {
      const meta = service.extractMetadata(VALID_TEXT, 'C2-WOR-SOW-0042.txt');
      const trn  = service.buildTransmittal(meta, 'C2-WOR-SOW-0042.txt');
      expect(trn.trnNumber).toMatch(/^TRN-C2-WOR-\d{4}$/);
    });

    it('should set fixed contract to C2 EPC-BOP', () => {
      const meta = service.extractMetadata(VALID_TEXT, 'C2-WOR-SOW-0042.txt');
      const trn  = service.buildTransmittal(meta, 'C2-WOR-SOW-0042.txt');
      expect(trn.contract).toBe('C2 EPC-BOP');
    });

    it('should set TO org as VGL', () => {
      const meta = service.extractMetadata(VALID_TEXT, 'C2-WOR-SOW-0042.txt');
      const trn  = service.buildTransmittal(meta, 'C2-WOR-SOW-0042.txt');
      expect(trn.toOrg).toContain('VGL');
    });
  });

  // ── TIER 4 DECISION ───────────────────────────────────────────────────────

  describe('determineDecision', () => {
    it('should accept when no failures and ≤2 warnings', () => {
      const score = { metaPass: 10, metaFail: 0, metaWarn: 1, qualPass: 8, qualFail: 0, qualWarn: 1, overall: 90 };
      expect(service.determineDecision(score)).toBe('accept');
    });

    it('should route to review when no failures but >2 warnings', () => {
      const score = { metaPass: 8, metaFail: 0, metaWarn: 4, qualPass: 6, qualFail: 0, qualWarn: 3, overall: 70 };
      expect(service.determineDecision(score)).toBe('review');
    });

    it('should reject when any failures present', () => {
      const score = { metaPass: 5, metaFail: 3, metaWarn: 2, qualPass: 6, qualFail: 1, qualWarn: 2, overall: 55 };
      expect(service.determineDecision(score)).toBe('reject');
    });

    it('should reject for invalid document (many failures)', () => {
      const meta = service.extractMetadata(INVALID_TEXT, 'WOR_doc_final_v3.txt');
      const qual = service.runQualityChecks(INVALID_TEXT);
      const score = service.calculateScore(meta, qual);
      expect(service.determineDecision(score)).toBe('reject');
    });

    it('should accept valid document', () => {
      const meta = service.extractMetadata(VALID_TEXT, 'C2-WOR-SOW-0042.txt');
      const qual = service.runQualityChecks(VALID_TEXT);
      const score = service.calculateScore(meta, qual);
      expect(service.determineDecision(score)).toBe('accept');
    });
  });
});
