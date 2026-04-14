import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PipelineService } from '../../services/pipeline.service';
import { ContractDataService } from '../../services/contract-data.service';
import { NotificationService } from '../../services/notification.service';
import { DistributionService } from '../../services/distribution.service';
import { FileIngestionService } from '../../services/file-ingestion.service';
import { ScenarioPanelComponent } from '../scenario-panel/scenario-panel.component';
import { TerminalComponent } from '../terminal/terminal.component';
import { AuditLogComponent } from '../audit-log/audit-log.component';
import { WorkQueueComponent } from '../work-queue/work-queue.component';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import { RejectionDialogComponent } from '../rejection-dialog/rejection-dialog.component';
import { ErrorShowcaseComponent } from '../error-showcase/error-showcase.component';
import {
  Scenario, WorkQueueItem, FileUploadResult, LoadSheetRow,
  LoadSheetValidationResult, AuditRecord, PipelineResult, ErrorShowcaseDetails
} from '../../models';
import { FilterByStatusPipe } from '../../pipes/filter-by-status.pipe';

@Component({
  selector: 'vg-dashboard',
  standalone: true,
  imports: [
    CommonModule, ScenarioPanelComponent, TerminalComponent, AuditLogComponent,
    WorkQueueComponent, FileUploadComponent, RejectionDialogComponent, ErrorShowcaseComponent, FilterByStatusPipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  selectedScenario = signal<string | null>(null);
  isRunning        = signal(false);

  // Tab control
  activeMainTab: 'queue' | 'upload' | 'scenarios' = 'queue';

  // Rejection dialog state
  rejectionDialogOpen = false;
  rejectionDocName = '';
  rejectionDocNumber = '';
  rejectionContractor = '';
  rejectionContractorEmail = '';
  rejectionFailedChecks: { field: string; note: string }[] = [];

  // Last pipeline result (for rejection dialog)
  lastPipelineResult: PipelineResult | null = null;

  // File upload state
  pendingFiles: FileUploadResult[] = [];
  pendingLoadSheet: LoadSheetRow[] = [];
  pendingValidation: LoadSheetValidationResult[] = [];

  constructor(
    public  auth:         AuthService,
    public  pipeline:     PipelineService,
    public  notification: NotificationService,
    public  distribution: DistributionService,
    public  ingestion:    FileIngestionService,
    private contractData: ContractDataService,
    private router:       Router,
  ) {}

  errorShowcaseOpen = false;
  showcaseDetails: ErrorShowcaseDetails | null = null;
  showcaseDocName = '';

  ngOnInit(): void {
    this.pipeline.log('SYS', `User authenticated: ${this.auth.currentUser()?.displayName} (${this.auth.getRoleLabel(this.auth.currentUser()?.role || 'viewer')})`, 'sys');
    this.pipeline.log('SYS', 'System ready · Select a tab to begin', 'sys');

    // Load work queue on init
    this.pipeline.loadWorkQueue('C2');
  }

  // ── SCENARIO MODE ─────────────────────────────────────────────────────────

  onScenarioSelected(scenarioId: string): void {
    if (this.isRunning()) return;
    this.selectedScenario.set(scenarioId);
  }

  async onRunScenario(): Promise<void> {
    const id = this.selectedScenario();
    if (!id || this.isRunning()) return;

    this.isRunning.set(true);
    this.pipeline.isRunning.set(true);
    const docs = this.contractData.getDocumentsForScenario(id);

    if (id === 'bulk') {
      await this.pipeline.runBulk(docs, 'Bulk');
    } else {
      const label = id === 'valid' ? 'Valid Contract' : 'Invalid Contract';
      const result = await this.pipeline.runDocument(docs[0], label);
      this.lastPipelineResult = result;

      // Auto-open rejection dialog if rejected
      if (result.decision === 'reject' && this.auth.hasPermission('canApproveReject')) {
        this.openRejectionDialog(docs[0].name, result);
      }
    }

    this.isRunning.set(false);
    this.pipeline.isRunning.set(false);
  }

  // ── WORK QUEUE ────────────────────────────────────────────────────────────

  onClaimItem(itemId: string): void {
    const user = this.auth.currentUser();
    if (user && this.auth.hasPermission('canClaimDocuments')) {
      this.pipeline.claimWorkItem(itemId, user.username);
    }
  }

  onUnclaimItem(itemId: string): void {
    this.pipeline.unclaimWorkItem(itemId);
  }

  async onProcessQueueItem(item: WorkQueueItem): Promise<void> {
    if (this.isRunning()) return;
    this.isRunning.set(true);
    this.pipeline.isRunning.set(true);

    // Fetch submittal details and process
    this.pipeline.log('INFO', `Processing work queue item: ${item.documentNumber}`, 'info');

    // Create a document from queue item metadata (in production, SDx API would provide the file content)
    const doc = {
      name: item.documentName,
      text: `CONTRACT NUMBER: ${item.documentNumber}\nDOCUMENT TITLE: ${item.documentName}\nFROM ORGANISATION: ${item.contractor}\nCONTRACT: ${item.contract}\nDISCIPLINE CODE: ${item.discipline}\nDOCUMENT TYPE: ${item.documentType}\nISSUE PURPOSE: ${item.issuePurpose}\nSECURITY CLASSIFICATION: Company Use\nPROJECT: VG CP2 LNG\n`,
      type: 'valid' as const,
    };

    const result = await this.pipeline.runDocument(doc, 'Work Queue');
    this.lastPipelineResult = result;

    if (result.decision === 'reject' && this.auth.hasPermission('canApproveReject')) {
      this.openRejectionDialog(item.documentName, result);
    }

    this.isRunning.set(false);
    this.pipeline.isRunning.set(false);
  }

  onRefreshQueue(): void {
    this.pipeline.loadWorkQueue('C2');
  }

  // ── FILE UPLOAD ───────────────────────────────────────────────────────────

  onFilesReady(event: { files: FileUploadResult[]; loadSheet: LoadSheetRow[]; validation: LoadSheetValidationResult[] }): void {
    this.pendingFiles = event.files;
    this.pendingLoadSheet = event.loadSheet;
    this.pendingValidation = event.validation;
  }

  async onProcessUploadedFiles(): Promise<void> {
    if (this.isRunning() || this.pendingFiles.length === 0) return;

    this.isRunning.set(true);
    this.pipeline.isRunning.set(true);
    const operator = this.auth.currentUser()?.username || 'unknown';

    const results = await this.pipeline.processUploadedFiles(
      this.pendingFiles, this.pendingLoadSheet, this.pendingValidation, operator
    );

    // Check for rejections and open dialog for the first rejected doc
    const firstRejected = results.find(r => r.decision === 'reject');
    if (firstRejected && this.auth.hasPermission('canApproveReject')) {
      const rejDocName = this.pendingFiles.find(f => true)?.name || '';
      this.openRejectionDialog(rejDocName, firstRejected);
    }

    this.isRunning.set(false);
    this.pipeline.isRunning.set(false);
  }

  // ── REJECTION DIALOG ─────────────────────────────────────────────────────

  openRejectionDialog(docName: string, result: PipelineResult): void {
    this.rejectionDocName = docName;
    this.rejectionDocNumber = result.metadata.find(m => m.field === 'Contract Number')?.extracted || docName;
    this.rejectionContractor = result.transmittal.fromOrg || 'Contractor';
    this.rejectionContractorEmail = '';
    this.rejectionFailedChecks = [
      ...result.preFlight.filter(c => c.status === 'fail').map(c => ({ field: c.check, note: c.detail })),
      ...result.metadata.filter(c => c.status === 'fail').map(c => ({ field: c.field, note: c.note })),
      ...result.quality.filter(c => c.status === 'fail').map(c => ({ field: c.check, note: c.detail })),
      ...result.submittalChecks.filter(c => c.status === 'fail').map(c => ({ field: c.check, note: c.detail })),
    ];
    this.rejectionDialogOpen = true;
  }

  onRejectionDialogClosed(): void {
    this.rejectionDialogOpen = false;
  }

  onDocumentRejected(record: any): void {
    this.pipeline.log('OK', `Rejection notification sent for ${record.documentNumber} — ${record.reasons.length} reason(s)`, 'ok');
    this.rejectionDialogOpen = false;
  }

  onDownloadErrorReport(record: AuditRecord): void {
    this.pipeline.downloadErrorReport(record.id);
  }

  onViewErrorDetails(record: AuditRecord): void {
    const details = this.pipeline.getPipelineIssueDetails(record.id);
    if (!details) {
      this.pipeline.log('WARN', `Unable to retrieve issue details for ${record.documentName}`, 'warn');
      return;
    }
    this.showcaseDocName = record.documentName;
    this.showcaseDetails = details;
    this.errorShowcaseOpen = true;
  }

  closeErrorShowcase(): void {
    this.errorShowcaseOpen = false;
    this.showcaseDetails = null;
    this.showcaseDocName = '';
  }

  openRejectionForRecord(record: AuditRecord): void {
    if (record.decision === 'reject' && this.auth.hasPermission('canApproveReject')) {
      this.rejectionDocName = record.documentName;
      this.rejectionDocNumber = record.documentName.replace(/\.[^.]+$/, '');
      this.rejectionContractor = 'Contractor';
      this.rejectionContractorEmail = '';
      this.rejectionFailedChecks = [];
      this.rejectionDialogOpen = true;
    }
  }

  // ── NAVIGATION ────────────────────────────────────────────────────────────

  async onLogout(): Promise<void> {
    if (this.isRunning()) return;
    this.pipeline.log('SYS', `User ${this.auth.currentUser()?.displayName} signing out…`, 'sys');
    await new Promise(r => setTimeout(r, 600));
    this.auth.logout();
  }

  get scenarios(): Scenario[] {
    return this.contractData.scenarios;
  }
}
