import { Injectable, signal } from '@angular/core';
import {
  SdxSubmittal, SdxDocument, SdxTransmittalRequest, SdxRevisionHistory,
  TransmittalPayload, DistributionRecipient, WorkQueueItem, QueuePriority
} from '../models';

/**
 * SDx API Integration Service
 *
 * Abstracts all communication with the Hexagon SDx REST API.
 * Currently uses simulated data for demo/development.
 * Production: replace simulate* methods with real HTTP calls.
 *
 * Integration points:
 *   GET  /api/sdx/submittals          — Fetch pending submittals (work queue)
 *   GET  /api/sdx/submittals/:id      — Fetch submittal details
 *   POST /api/sdx/transmittals        — Create incoming transmittal
 *   PUT  /api/sdx/documents/:id/status — Update document status
 *   GET  /api/sdx/documents/:docNum/revisions — Get revision history
 *   GET  /api/sdx/distribution/:project/:discipline — Get distribution matrix
 */
@Injectable({ providedIn: 'root' })
export class SdxApiService {

  isConnected = signal(false);
  lastSyncTime = signal<Date | null>(null);

  // ── Configuration (will come from environment in production) ──────────

  private baseUrl = ''; // Set from environment.sdxApiBaseUrl
  private apiKey  = ''; // Set from environment.sdxApiKey

  // ── SUBMITTAL ENDPOINTS ──────────────────────────────────────────────────

  async fetchPendingSubmittals(project?: string): Promise<WorkQueueItem[]> {
    // Production: return this.http.get<WorkQueueItem[]>(`${this.baseUrl}/submittals?project=${project}&status=pending`);
    return this.simulatePendingSubmittals(project);
  }

  async fetchSubmittalDetails(submittalId: string): Promise<SdxSubmittal | null> {
    // Production: return this.http.get<SdxSubmittal>(`${this.baseUrl}/submittals/${submittalId}`);
    return this.simulateSubmittalDetails(submittalId);
  }

  // ── TRANSMITTAL ENDPOINTS ────────────────────────────────────────────────

  async createTransmittal(request: SdxTransmittalRequest): Promise<{ success: boolean; trnNumber: string; error?: string }> {
    // Production: return this.http.post(`${this.baseUrl}/transmittals`, request);
    return this.simulateCreateTransmittal(request);
  }

  // ── DOCUMENT STATUS ENDPOINTS ────────────────────────────────────────────

  async updateDocumentStatus(documentId: string, status: 'current' | 'superseded' | 'rejected'): Promise<{ success: boolean }> {
    // Production: return this.http.put(`${this.baseUrl}/documents/${documentId}/status`, { status });
    return this.simulateStatusUpdate(documentId, status);
  }

  // ── REVISION HISTORY ENDPOINTS ───────────────────────────────────────────

  async fetchRevisionHistory(documentNumber: string): Promise<SdxRevisionHistory | null> {
    // Production: return this.http.get<SdxRevisionHistory>(`${this.baseUrl}/documents/${documentNumber}/revisions`);
    return this.simulateRevisionHistory(documentNumber);
  }

  async checkPriorRevisionExists(documentNumber: string, currentRevision: string): Promise<{ exists: boolean; priorRevision: string | null; underReview: boolean }> {
    const history = await this.fetchRevisionHistory(documentNumber);
    if (!history || history.revisions.length === 0) {
      return { exists: false, priorRevision: null, underReview: false };
    }

    const revOrder = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const cleanRev = currentRevision.replace(/^Rev\s*/i, '').toUpperCase();
    const currentIdx = revOrder.indexOf(cleanRev);

    if (currentIdx <= 0) {
      // Rev A or Rev 0 — no prior revision expected
      return { exists: true, priorRevision: null, underReview: false };
    }

    const expectedPrior = revOrder[currentIdx - 1];
    const priorRev = history.revisions.find(r =>
      r.revision.replace(/^Rev\s*/i, '').toUpperCase() === expectedPrior
    );

    if (!priorRev) {
      return { exists: false, priorRevision: `Rev ${expectedPrior}`, underReview: false };
    }

    return {
      exists: true,
      priorRevision: priorRev.revision,
      underReview: priorRev.status === 'submitted' || priorRev.status === 'under_review',
    };
  }

  // ── CLAIM / UNCLAIM ──────────────────────────────────────────────────────

  async claimSubmittal(submittalId: string, username: string): Promise<{ success: boolean }> {
    // Production: return this.http.put(`${this.baseUrl}/submittals/${submittalId}/claim`, { username });
    return { success: true };
  }

  async unclaimSubmittal(submittalId: string): Promise<{ success: boolean }> {
    // Production: return this.http.put(`${this.baseUrl}/submittals/${submittalId}/unclaim`, {});
    return { success: true };
  }

  // ── HEALTH CHECK ─────────────────────────────────────────────────────────

  async checkConnection(): Promise<boolean> {
    // Production: return this.http.get(`${this.baseUrl}/health`).pipe(map(() => true), catchError(() => of(false)));
    this.isConnected.set(true);
    this.lastSyncTime.set(new Date());
    return true;
  }

  // ── SIMULATED DATA ───────────────────────────────────────────────────────

  private async simulatePendingSubmittals(project?: string): Promise<WorkQueueItem[]> {
    await this.delay(50);
    const items: WorkQueueItem[] = [
      {
        id: 'WQ-001', submittalId: 'SUB-2026-0421', documentName: 'C2-WOR-SOW-0042.pdf',
        documentNumber: 'C2-WOR-SOW-0042', contractor: 'Worley Group', contract: 'C2 EPC-BOP',
        discipline: 'MEC', documentType: 'SOW', issuePurpose: 'IFR',
        submittedDate: new Date('2026-04-05'), targetDate: new Date('2026-04-10'),
        status: 'pending', claimedBy: null, claimedAt: null, priority: 'high',
        documentCount: 3, loadSheetRef: 'LS-2026-0421-001', project: 'C2',
      },
      {
        id: 'WQ-002', submittalId: 'SUB-2026-0422', documentName: 'C2-WOR-MDR-0018.pdf',
        documentNumber: 'C2-WOR-MDR-0018', contractor: 'Worley Group', contract: 'C2 EPC-BOP',
        discipline: 'CMS', documentType: 'MDR', issuePurpose: 'IFU',
        submittedDate: new Date('2026-04-04'), targetDate: new Date('2026-04-09'),
        status: 'pending', claimedBy: null, claimedAt: null, priority: 'medium',
        documentCount: 1, loadSheetRef: 'LS-2026-0422-001', project: 'C2',
      },
      {
        id: 'WQ-003', submittalId: 'SUB-2026-0423', documentName: 'C2-WOR-SPE-0031.pdf',
        documentNumber: 'C2-WOR-SPE-0031', contractor: 'Worley Group', contract: 'C2 EPC-BOP',
        discipline: 'MEC', documentType: 'SPE', issuePurpose: 'AFC',
        submittedDate: new Date('2026-04-03'), targetDate: new Date('2026-04-08'),
        status: 'pending', claimedBy: null, claimedAt: null, priority: 'high',
        documentCount: 2, loadSheetRef: 'LS-2026-0423-001', project: 'C2',
      },
      {
        id: 'WQ-004', submittalId: 'SUB-2026-0424', documentName: 'C2-WOR-DWG-0099.pdf',
        documentNumber: 'C2-WOR-DWG-0099', contractor: 'Worley Group', contract: 'C2 EPC-BOP',
        discipline: 'PIP', documentType: 'DWG', issuePurpose: 'IFR',
        submittedDate: new Date('2026-04-06'), targetDate: new Date('2026-04-11'),
        status: 'pending', claimedBy: null, claimedAt: null, priority: 'low',
        documentCount: 5, loadSheetRef: 'LS-2026-0424-001', project: 'C2',
      },
      {
        id: 'WQ-005', submittalId: 'SUB-2026-0425', documentName: 'C2-WOR-PRO-HSE-001.pdf',
        documentNumber: 'C2-WOR-PRO-HSE-001', contractor: 'Worley Group', contract: 'C2 EPC-BOP',
        discipline: 'HSE', documentType: 'PRO', issuePurpose: 'IFI',
        submittedDate: new Date('2026-04-02'), targetDate: new Date('2026-04-07'),
        status: 'pending', claimedBy: null, claimedAt: null, priority: 'medium',
        documentCount: 1, loadSheetRef: 'LS-2026-0425-001', project: 'C2',
      },
      {
        id: 'WQ-006', submittalId: 'SUB-2026-0426', documentName: 'C2-BEC-CAL-0015.pdf',
        documentNumber: 'C2-BEC-CAL-0015', contractor: 'Bechtel', contract: 'C2 EPC-LNG',
        discipline: 'STR', documentType: 'CAL', issuePurpose: 'IFC',
        submittedDate: new Date('2026-04-01'), targetDate: new Date('2026-04-06'),
        status: 'pending', claimedBy: null, claimedAt: null, priority: 'high',
        documentCount: 4, loadSheetRef: 'LS-2026-0426-001', project: 'C2',
      },
      {
        id: 'WQ-007', submittalId: 'SUB-2026-0427', documentName: 'C2-FLU-ITP-0008.pdf',
        documentNumber: 'C2-FLU-ITP-0008', contractor: 'Fluor', contract: 'C2 EPC-BOP',
        discipline: 'QA', documentType: 'ITP', issuePurpose: 'IFR',
        submittedDate: new Date('2026-04-06'), targetDate: new Date('2026-04-12'),
        status: 'pending', claimedBy: null, claimedAt: null, priority: 'low',
        documentCount: 2, loadSheetRef: 'LS-2026-0427-001', project: 'C2',
      },
    ];

    if (project) {
      return items.filter(i => i.project === project);
    }
    return items;
  }

  private async simulateSubmittalDetails(submittalId: string): Promise<SdxSubmittal | null> {
    await this.delay(30);
    return {
      id: submittalId,
      correspondenceNo: `COR-${submittalId}`,
      fromOrg: 'WOR — Worley Group Pty Ltd',
      fromRole: 'Contractor Document Control',
      contract: 'C2 EPC-BOP',
      discipline: 'MEC',
      submittalType: 'Technical',
      reasonForIssue: 'IFR — Issued for Review',
      issueState: 'Submitted',
      creationDate: new Date('2026-04-05'),
      targetDate: new Date('2026-04-10'),
      documentCount: 3,
      documents: [
        { id: 'DOC-001', documentNumber: 'C2-WOR-SOW-0042', title: 'Statement of Work', revision: 'Rev A', status: 'submitted', securityClass: 'Company Use', fileType: 'pdf', fileName: 'C2-WOR-SOW-0042.pdf' },
      ],
    };
  }

  private async simulateCreateTransmittal(request: SdxTransmittalRequest): Promise<{ success: boolean; trnNumber: string }> {
    await this.delay(50);
    return { success: true, trnNumber: request.transmittal.trnNumber };
  }

  private async simulateStatusUpdate(documentId: string, status: string): Promise<{ success: boolean }> {
    await this.delay(30);
    return { success: true };
  }

  private async simulateRevisionHistory(documentNumber: string): Promise<SdxRevisionHistory> {
    await this.delay(30);
    // Return simulated revision history
    return {
      documentNumber,
      revisions: [
        { revision: 'Rev A', status: 'current', dateIssued: '01-Apr-2026', issuePurpose: 'IFR' },
      ],
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
