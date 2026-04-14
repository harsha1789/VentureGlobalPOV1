import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  AuditRecord, CheckStatus, ContractDocument, Decision, ErrorShowcaseDetails, PipelineResult,
  SessionStats, TerminalLog, LogLevel, FileUploadResult,
  LoadSheetRow, LoadSheetValidationResult, WorkQueueItem,
  TransmittalPayload, DistributionRecipient, RejectionRecord
} from '../models';
import { ValidationService } from './validation.service';
import { SdxApiService } from './sdx-api.service';
import { NotificationService } from './notification.service';
import { DistributionService } from './distribution.service';
import { FileIngestionService } from './file-ingestion.service';
import { ErrorReportService } from './error-report.service';

@Injectable({ providedIn: 'root' })
export class PipelineService {

  // ── SIGNALS ───────────────────────────────────────────────────────────────
  auditLog    = signal<AuditRecord[]>([]);
  terminalLog = signal<TerminalLog[]>([]);
  stats       = signal<SessionStats>({ total: 0, pass: 0, fail: 0, review: 0 });
  isRunning   = signal(false);
  currentDoc  = signal<string>('');

  // ── WORK QUEUE ────────────────────────────────────────────────────────────
  workQueue   = signal<WorkQueueItem[]>([]);
  isLoadingQueue = signal(false);

  // ── PIPELINE RESULTS STORE (for error report generation) ─────────────────
  private pipelineResults = new Map<number, { docName: string; result: PipelineResult; sourceText: string }>();

  // ── STREAMS ───────────────────────────────────────────────────────────────
  rowUpdate$ = new Subject<{ id: number; record: AuditRecord }>();

  private rowCounter = 0;

  constructor(
    private validation:   ValidationService,
    private sdxApi:       SdxApiService,
    private notification: NotificationService,
    private distribution: DistributionService,
    private ingestion:    FileIngestionService,
    private errorReport:  ErrorReportService,
  ) {}

  // ── WORK QUEUE OPERATIONS ───────────────────────────────────────────────

  async loadWorkQueue(project?: string): Promise<void> {
    this.isLoadingQueue.set(true);
    this.log('SYS', 'Fetching pending submittals from SDx…', 'sys');

    try {
      const items = await this.sdxApi.fetchPendingSubmittals(project);
      this.workQueue.set(items);
      this.log('OK', `Work queue loaded: ${items.length} pending submittals`, 'ok');
    } catch (err: any) {
      this.log('ERR', `Failed to load work queue: ${err.message}`, 'err');
    }

    this.isLoadingQueue.set(false);
  }

  async claimWorkItem(itemId: string, username: string): Promise<void> {
    const result = await this.sdxApi.claimSubmittal(itemId, username);
    if (result.success) {
      this.workQueue.update(items =>
        items.map(i => i.id === itemId
          ? { ...i, status: 'claimed' as const, claimedBy: username, claimedAt: new Date() }
          : i
        )
      );
      this.log('OK', `Submittal ${itemId} claimed by ${username}`, 'ok');
    }
  }

  async unclaimWorkItem(itemId: string): Promise<void> {
    const result = await this.sdxApi.unclaimSubmittal(itemId);
    if (result.success) {
      this.workQueue.update(items =>
        items.map(i => i.id === itemId
          ? { ...i, status: 'pending' as const, claimedBy: null, claimedAt: null }
          : i
        )
      );
      this.log('SYS', `Submittal ${itemId} released`, 'sys');
    }
  }

  // ── FILE-BASED PIPELINE (REAL DOCUMENT PROCESSING) ───────────────────────

  async processUploadedFiles(
    files: FileUploadResult[],
    loadSheet: LoadSheetRow[],
    validation: LoadSheetValidationResult[],
    operator: string
  ): Promise<PipelineResult[]> {
    this.isRunning.set(true);
    this.log('SYS', `Processing ${files.length} uploaded files with ${loadSheet.length} load sheet rows`, 'sys');

    const batchDocs = files.map(f => ({
      name: f.name, text: f.extractedText, type: 'valid' as const,
    }));

    const results = await Promise.all(files.map((file, i) => {
      this.log('INFO', `[${i + 1}/${files.length}] Processing: ${file.name}`, 'info');
      const doc: ContractDocument = {
        name: file.name,
        text: file.extractedText,
        type: 'valid',
      };
      return this.runDocument(doc, 'File Upload', batchDocs);
    }));

    this.isRunning.set(false);
    this.log('OK', `File processing complete: ${files.length} documents processed`, 'ok');
    return results;
  }

  // ── MAIN PIPELINE RUNNER ─────────────────────────────────────────────────

  async runDocument(doc: ContractDocument, scenarioLabel: string, batchDocuments?: ContractDocument[]): Promise<PipelineResult> {
    const t0 = Date.now();
    this.currentDoc.set(doc.name);

    // Insert placeholder row
    const id = ++this.rowCounter;
    this.addPlaceholderRow(id, doc.name, scenarioLabel);

    this.log('INFO', `Starting pipeline: ${doc.name}`, 'info');

    // TIER 0 — PRE-FLIGHT (BEGINNING)
    this.log('INFO', '  T0 · Running pre-flight checks…', 'info');
    await this.delay(20);
    const preFlight = this.validation.runPreFlightChecks(doc.text, doc.name);
    const pfFail = preFlight.filter(c => c.status === 'fail').length;
    const pfPass = preFlight.filter(c => c.status === 'pass').length;
    const pfWarn = preFlight.filter(c => c.status === 'warn').length;
    this.log(
      pfFail > 0 ? 'ERR' : 'OK',
      `  T0 · Pre-flight: ${pfPass}✓ ${pfFail}✗ ${pfWarn}⚠ · ${pfFail > 0 ? 'PRE-FLIGHT FAILURES — review before proceeding' : 'All pre-flight checks passed'}`,
      pfFail > 0 ? 'err' : 'ok'
    );

    // TIER 1 — METADATA + CONTRACT CHECKS
    this.log('INFO', '  T1 · Extracting metadata & validating contract fields…', 'info');
    await this.delay(30);
    const metadata = this.validation.extractMetadata(doc.text, doc.name);
    const metaFail = metadata.filter(c => c.status === 'fail').length;
    const metaPass = metadata.filter(c => c.status === 'pass').length;
    const metaWarn = metadata.filter(c => c.status === 'warn').length;
    this.log(
      metaFail > 0 ? 'WARN' : 'OK',
      `  T1 · Metadata + Contract: ${metaPass}✓ ${metaFail}✗ ${metaWarn}⚠ · ${metaFail > 0 ? 'FAILURES DETECTED' : 'All fields validated'}`,
      metaFail > 0 ? 'warn' : 'ok'
    );

    // TIER 1R — PRIOR REVISION CHECK (via SDx API)
    this.log('INFO', '  T1R · Checking prior revision history via SDx…', 'info');
    await this.delay(20);
    const docNumber = metadata.find(m => m.field === 'Contract Number')?.extracted;
    const revNumber = metadata.find(m => m.field === 'Revision Number')?.extracted;
    if (docNumber && revNumber) {
      const revCheck = await this.sdxApi.checkPriorRevisionExists(docNumber, revNumber);
      if (!revCheck.exists && revNumber && !/^(0|Rev\s*0|R00|A|Rev\s*A)$/i.test(revNumber)) {
        this.log('WARN', `  T1R · Prior revision not found in SDx for ${docNumber}`, 'warn');
      } else if (revCheck.underReview) {
        this.log('WARN', `  T1R · Prior revision ${revCheck.priorRevision} is still under review`, 'warn');
      } else {
        this.log('OK', '  T1R · Prior revision check passed', 'ok');
      }
    } else {
      this.log('WARN', '  T1R · Cannot verify prior revision — document number or revision not found', 'warn');
    }

    // TIER 2 — QUALITY CHECKS
    this.log('INFO', '  T2 · Running document quality checks…', 'info');
    await this.delay(25);
    const quality = this.validation.runQualityChecks(doc.text);
    const qualFail = quality.filter(c => c.status === 'fail').length;
    const qualPass = quality.filter(c => c.status === 'pass').length;
    const qualWarn = quality.filter(c => c.status === 'warn').length;
    this.log(
      qualFail > 0 ? 'WARN' : 'OK',
      `  T2 · Quality: ${qualPass}✓ ${qualFail}✗ ${qualWarn}⚠ · ${qualFail > 0 ? 'Quality issues found' : 'All checks passed'}`,
      qualFail > 0 ? 'warn' : 'ok'
    );

    // TIER 2S — SUBMITTAL CHECKS
    this.log('INFO', '  T2S · Running submittal validation checks…', 'info');
    await this.delay(20);
    const batchData = batchDocuments?.map(d => ({ text: d.text, name: d.name }));
    const submittalChecks = this.validation.runSubmittalChecks(doc.text, metadata, batchData);
    const subFail = submittalChecks.filter(c => c.status === 'fail').length;
    const subPass = submittalChecks.filter(c => c.status === 'pass').length;
    const subWarn = submittalChecks.filter(c => c.status === 'warn').length;
    this.log(
      subFail > 0 ? 'WARN' : 'OK',
      `  T2S · Submittal: ${subPass}✓ ${subFail}✗ ${subWarn}⚠ · ${subFail > 0 ? 'Submittal issues found' : 'Submittal checks passed'}`,
      subFail > 0 ? 'warn' : 'ok'
    );

    // TIER 3 — TRANSMITTAL BUILDER
    this.log('INFO', '  T3 · Building transmittal payload…', 'info');
    await this.delay(20);
    const transmittal = this.validation.buildTransmittal(metadata, doc.name);
    this.log('OK', `  T3 · Transmittal built: ${transmittal.trnNumber}`, 'ok');

    // TIER 3D — DISTRIBUTION MATRIX LOOKUP
    this.log('INFO', '  T3D · Looking up distribution matrix…', 'info');
    await this.delay(15);
    const recipients = this.distribution.getRecipientsForTransmittal(transmittal);
    this.log('OK', `  T3D · Distribution: ${recipients.length} recipients identified`, 'ok');

    // TIER 3V — TRANSMITTAL VALIDATION
    this.log('INFO', '  T3V · Validating transmittal payload…', 'info');
    await this.delay(15);
    const transmittalValidation = this.validation.validateTransmittal(transmittal);
    const trnFail = transmittalValidation.filter(c => c.status === 'fail').length;
    const trnPass = transmittalValidation.filter(c => c.status === 'pass').length;
    const trnWarn = transmittalValidation.filter(c => c.status === 'warn').length;
    this.log(
      trnFail > 0 ? 'WARN' : 'OK',
      `  T3V · Transmittal validation: ${trnPass}✓ ${trnFail}✗ ${trnWarn}⚠ · ${trnFail > 0 ? 'Transmittal incomplete' : 'Transmittal fully populated'}`,
      trnFail > 0 ? 'warn' : 'ok'
    );

    // TIER 4 — DECISION ENGINE
    this.log('INFO', '  T4 · Evaluating decision engine…', 'info');
    await this.delay(20);
    const score    = this.validation.calculateScore(metadata, quality, preFlight, submittalChecks, transmittalValidation);
    const decision = this.validation.determineDecision(score);
    const auditRef = 'AUD-' + Date.now().toString(36).toUpperCase();

    const decisionLabel = decision.toUpperCase();
    this.log(
      decision === 'accept' ? 'OK' : decision === 'reject' ? 'ERR' : 'WARN',
      `  T4 · Decision: ${decisionLabel} · Score: ${score.overall}/100`,
      decision === 'accept' ? 'ok' : decision === 'reject' ? 'err' : 'warn'
    );

    // TIER 4N — NOTIFICATION ROUTING (based on decision)
    if (decision === 'accept') {
      this.log('INFO', '  T4N · Queuing transmittal notification to distribution list…', 'info');
      await this.notification.sendTransmittalNotification(transmittal, recipients);
      this.log('OK', `  T4N · Transmittal notification sent to ${recipients.length} recipients`, 'ok');

      // Update document status in SDx
      if (docNumber) {
        await this.sdxApi.updateDocumentStatus(docNumber, 'current');
        this.log('OK', `  T4N · Document status updated to "current" in SDx`, 'ok');
      }
    } else if (decision === 'reject') {
      this.log('INFO', '  T4N · Document rejected — notification will be sent via rejection dialog', 'info');
    }

    // TIER 5 — FINAL GATE (END)
    this.log('INFO', '  T5 · Running final gate checks…', 'info');
    await this.delay(15);
    const finalGate = this.validation.runFinalGateChecks(preFlight, metadata, quality, submittalChecks, transmittalValidation, decision);
    const fgFail = finalGate.filter(c => c.status === 'fail').length;
    const fgPass = finalGate.filter(c => c.status === 'pass').length;
    const fgWarn = finalGate.filter(c => c.status === 'warn').length;
    this.log(
      fgFail > 0 ? 'WARN' : 'OK',
      `  T5 · Final gate: ${fgPass}✓ ${fgFail}✗ ${fgWarn}⚠ · ${fgFail > 0 ? 'Final gate issues' : 'All gate checks cleared'}`,
      fgFail > 0 ? 'warn' : 'ok'
    );

    const durationMs = Date.now() - t0;
    this.log('OK', `  Pipeline complete: ${doc.name} → ${decisionLabel} (${durationMs}ms)`, 'ok');

    const result: PipelineResult = {
      preFlight, metadata, quality, submittalChecks, transmittal, transmittalValidation,
      score, decision, finalGate, durationMs, auditRef, trnNumber: transmittal.trnNumber
    };

    // Store pipeline result for error report generation
    this.pipelineResults.set(id, { docName: doc.name, result, sourceText: doc.text });

    // Update audit log
    const operator = 'harsha'; // Will be replaced with currentUser in dashboard
    this.updateAuditRecord(id, doc.name, scenarioLabel, result, operator);
    this.updateStats(decision);

    // Update work queue item status if applicable
    this.workQueue.update(items =>
      items.map(i => {
        if (i.documentNumber === docNumber) {
          return { ...i, status: decision === 'accept' ? 'completed' as const : decision === 'reject' ? 'rejected' as const : 'in_review' as const };
        }
        return i;
      })
    );

    return result;
  }

  async runBulk(docs: ContractDocument[], scenarioLabel: string): Promise<void> {
    this.log('INFO', `Bulk processing initiated · ${docs.length} documents queued`, 'info');
    await Promise.all(docs.map((d, i) => {
      this.log('INFO', `[${i + 1}/${docs.length}] Processing: ${d.name}`, 'info');
      return this.runDocument(d, scenarioLabel, docs);
    }));
    this.log('OK', `Bulk run complete · ${docs.length} documents processed`, 'ok');
  }

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────

  private addPlaceholderRow(id: number, docName: string, scenario: string): void {
    const placeholder: AuditRecord = {
      id, documentName: docName, scenario,
      decision: 'review' as Decision,
      score: 0, trnNumber: '—', durationMs: 0,
      timestamp: new Date(), operator: '',
      checks: { totalPass: 0, totalFail: 0, totalWarn: 0 },
      tiersRun: [],
    };
    this.auditLog.update(log => [placeholder, ...log]);
  }

  private updateAuditRecord(id: number, docName: string, scenario: string, result: PipelineResult, operator: string): void {
    const s = result.score;
    const record: AuditRecord = {
      id,
      documentName: docName,
      scenario,
      decision:     result.decision,
      score:        result.score.overall,
      trnNumber:    result.trnNumber,
      durationMs:   result.durationMs,
      timestamp:    new Date(),
      operator,
      checks: {
        totalPass: s.preFlightPass + s.metaPass + s.qualPass + s.submittalPass + s.transmittalPass + s.finalGatePass,
        totalFail: s.preFlightFail + s.metaFail + s.qualFail + s.submittalFail + s.transmittalFail + s.finalGateFail,
        totalWarn: s.preFlightWarn + s.metaWarn + s.qualWarn + s.submittalWarn + s.transmittalWarn + s.finalGateWarn,
      },
      tiersRun: ['T0', 'T1', 'T2', 'T2S', 'T3', 'T3V', 'T4', 'T5'],
    };
    this.auditLog.update(log => log.map(r => r.id === id ? record : r));
  }

  private updateStats(decision: Decision): void {
    this.stats.update(s => ({
      total:  s.total + 1,
      pass:   decision === 'accept'  ? s.pass + 1  : s.pass,
      fail:   decision === 'reject'  ? s.fail + 1  : s.fail,
      review: decision === 'review'  ? s.review + 1 : s.review,
    }));
  }

  // ── TERMINAL ─────────────────────────────────────────────────────────────

  log(tag: string, message: string, level: LogLevel): void {
    const now = new Date();
    const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
    const entry: TerminalLog = {
      timestamp: ts,
      tag: `[${tag}]`,
      message,
      level,
    };
    this.terminalLog.update(logs => [...logs, entry]);
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────

  // ── ERROR REPORT ──────────────────────────────────────────────────────────

  downloadErrorReport(recordId: number): void {
    const entry = this.pipelineResults.get(recordId);
    if (!entry) {
      this.log('WARN', `No pipeline result found for record #${recordId} — cannot generate error report`, 'warn');
      return;
    }
    this.log('INFO', `Generating error report PDF for ${entry.docName}…`, 'info');
    this.errorReport.generateErrorReport(entry.docName, entry.result);
    this.log('OK', `Error report downloaded for ${entry.docName}`, 'ok');
  }

  getPipelineIssueDetails(recordId: number): ErrorShowcaseDetails | null {
    const entry = this.pipelineResults.get(recordId);
    if (!entry) return null;

    const ocrCheck = entry.result.quality.find(q => q.check.toLowerCase().includes('ocr'));
    const issueCheck = (label: string, status: CheckStatus, note: string, tier?: string) => ({ label, status, note, tier });

    const issues = [
      ...entry.result.preFlight.filter(c => c.status !== 'pass').map(c => issueCheck(c.check, c.status, c.detail, c.tier)),
      ...entry.result.metadata.filter(c => c.status !== 'pass').map(c => issueCheck(c.field, c.status, c.note, c.tier)),
      ...entry.result.quality.filter(c => c.status !== 'pass').map(c => issueCheck(c.check, c.status, c.detail, c.method)),
      ...entry.result.submittalChecks.filter(c => c.status !== 'pass').map(c => issueCheck(c.check, c.status, c.detail, c.tier)),
      ...entry.result.transmittalValidation.filter(c => c.status !== 'pass').map(c => issueCheck(c.check, c.status, c.detail, c.tier)),
      ...entry.result.finalGate.filter(c => c.status !== 'pass').map(c => issueCheck(c.check, c.status, c.detail, c.tier)),
    ];

    const previewText = entry.sourceText
      .split(/\r?\n/)
      .filter(line => line.trim().length > 0)
      .slice(0, 18)
      .join('\n');

    return {
      docName: entry.docName,
      ocrStatus: ocrCheck?.status || 'warn',
      ocrDetail: ocrCheck?.detail || 'OCR status unavailable',
      issues,
      previewText: previewText || '[No extracted text available for preview]'
    };
  }

  getPipelineResult(recordId: number): PipelineResult | null {
    return this.pipelineResults.get(recordId)?.result || null;
  }

  clearAuditLog(): void {
    this.auditLog.set([]);
    this.pipelineResults.clear();
    this.stats.set({ total: 0, pass: 0, fail: 0, review: 0 });
    this.rowCounter = 0;
    this.log('SYS', 'Audit log cleared', 'sys');
  }

  exportCSV(operator: string): void {
    const log = this.auditLog();
    if (log.length === 0) { this.log('WARN', 'No records to export', 'warn'); return; }
    const headers = ['#','Document','Scenario','Decision','Score','TRN','Duration(ms)','Pass','Fail','Warn','Timestamp','Operator'];
    const rows = log.map(r => [
      r.id, r.documentName, r.scenario, r.decision, r.score,
      r.trnNumber, r.durationMs, r.checks.totalPass, r.checks.totalFail,
      r.checks.totalWarn, r.timestamp.toISOString(), r.operator
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `VG_CP2_AuditLog_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    this.log('OK', `Exported ${log.length} records to CSV`, 'ok');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
