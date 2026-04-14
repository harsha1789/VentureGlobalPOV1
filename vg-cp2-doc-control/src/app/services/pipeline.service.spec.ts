import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PipelineService } from './pipeline.service';
import { ValidationService } from './validation.service';
import { ContractDocument } from '../models';

const VALID_DOC: ContractDocument = {
  name: 'C2-WOR-SOW-0042.txt',
  type: 'valid',
  text: `CONTRACT NUMBER: C2-WOR-SOW-0042
DOCUMENT TITLE: Statement of Work
REVISION NUMBER: Rev A
ISSUE PURPOSE: IFR
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE: SOW
DISCIPLINE CODE: MEC
DOCUMENT DATE: 01 April 2026
FROM ORGANISATION: WOR — Worley
PROJECT: VG CP2 LNG
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
SDx Project Area: C2
Prepared by: J. Harrington  Date: 01-Apr-2026
Reviewed by: S. Okonkwo     Date: 02-Apr-2026
REVISION HISTORY
A  01-Apr-2026  First Issue
END OF DOCUMENT
Company Use`,
};

const INVALID_DOC: ContractDocument = {
  name: 'WOR_doc_final.txt',
  type: 'invalid',
  text: 'Random notes without any proper structure or metadata at all.',
};

describe('PipelineService', () => {
  let service: PipelineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PipelineService, ValidationService],
    });
    service = TestBed.inject(PipelineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise with empty audit log', () => {
    expect(service.auditLog()).toEqual([]);
  });

  it('should initialise with zero stats', () => {
    const s = service.stats();
    expect(s.total).toBe(0);
    expect(s.pass).toBe(0);
    expect(s.fail).toBe(0);
    expect(s.review).toBe(0);
  });

  it('should add a record after processing valid document', async () => {
    await service.runDocument(VALID_DOC, 'Test');
    expect(service.auditLog().length).toBe(1);
  });

  it('should return accept decision for valid document', async () => {
    const result = await service.runDocument(VALID_DOC, 'Test');
    expect(result.decision).toBe('accept');
  });

  it('should return reject decision for invalid document', async () => {
    const result = await service.runDocument(INVALID_DOC, 'Test');
    expect(result.decision).toBe('reject');
  });

  it('should increment stats.total after processing', async () => {
    await service.runDocument(VALID_DOC, 'Test');
    expect(service.stats().total).toBe(1);
  });

  it('should increment stats.pass for accepted document', async () => {
    await service.runDocument(VALID_DOC, 'Test');
    expect(service.stats().pass).toBe(1);
  });

  it('should increment stats.fail for rejected document', async () => {
    await service.runDocument(INVALID_DOC, 'Test');
    expect(service.stats().fail).toBe(1);
  });

  it('should log pipeline steps to terminal', async () => {
    await service.runDocument(VALID_DOC, 'Test');
    const logs = service.terminalLog();
    expect(logs.length).toBeGreaterThan(3);
  });

  it('should add TRN number starting with TRN-C2-WOR', async () => {
    const result = await service.runDocument(VALID_DOC, 'Test');
    expect(result.trnNumber).toMatch(/^TRN-C2-WOR-\d{4}$/);
  });

  it('should record duration in milliseconds', async () => {
    const result = await service.runDocument(VALID_DOC, 'Test');
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('should clear audit log on clearAuditLog()', async () => {
    await service.runDocument(VALID_DOC, 'Test');
    service.clearAuditLog();
    expect(service.auditLog()).toEqual([]);
    expect(service.stats().total).toBe(0);
  });

  it('should process bulk documents sequentially', async () => {
    const docs = [VALID_DOC, INVALID_DOC];
    await service.runBulk(docs, 'Bulk');
    expect(service.auditLog().length).toBe(2);
    expect(service.stats().total).toBe(2);
  });

  it('should set auditRef with AUD- prefix', async () => {
    const result = await service.runDocument(VALID_DOC, 'Test');
    expect(result.auditRef).toMatch(/^AUD-/);
  });

  it('should include all 4 tiers in result', async () => {
    const result = await service.runDocument(VALID_DOC, 'Test');
    expect(result.metadata.length).toBeGreaterThan(0);
    expect(result.quality.length).toBeGreaterThan(0);
    expect(result.transmittal).toBeTruthy();
    expect(result.score).toBeTruthy();
  });
});
