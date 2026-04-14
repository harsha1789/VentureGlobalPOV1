import { Injectable, signal } from '@angular/core';
import {
  RejectionRecord, RejectionReason, NotificationRecord,
  REJECTION_REASONS, TransmittalPayload, DistributionRecipient
} from '../models';

/**
 * Notification Service
 *
 * Handles rejection emails, transmittal notifications, and status updates.
 * Currently generates email content locally.
 * Production: integrate with SMTP gateway or Azure Communication Services.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {

  rejectionHistory = signal<RejectionRecord[]>([]);
  notificationLog  = signal<NotificationRecord[]>([]);

  // ── REJECTION WORKFLOW ───────────────────────────────────────────────────

  getAvailableRejectionReasons(): RejectionReason[] {
    return REJECTION_REASONS;
  }

  getRejectionReasonsByCategory(category: string): RejectionReason[] {
    return REJECTION_REASONS.filter(r => r.category === category);
  }

  getRejectionCategories(): { key: string; label: string }[] {
    return [
      { key: 'metadata_missing', label: 'Missing Metadata' },
      { key: 'metadata_incorrect', label: 'Incorrect Metadata' },
      { key: 'naming_convention', label: 'Naming Convention' },
      { key: 'quality_issue', label: 'Quality Issues' },
      { key: 'wrong_contract', label: 'Wrong Contract' },
      { key: 'revision_conflict', label: 'Revision Conflicts' },
      { key: 'incomplete_submittal', label: 'Incomplete Submittal' },
      { key: 'other', label: 'Other' },
    ];
  }

  createRejection(params: {
    documentName: string;
    documentNumber: string;
    contractor: string;
    contractorEmail: string;
    rejectedBy: string;
    reasons: RejectionReason[];
    customMessage?: string;
  }): RejectionRecord {
    const emailBody = this.generateRejectionEmail(params);
    const record: RejectionRecord = {
      id: `REJ-${Date.now().toString(36).toUpperCase()}`,
      documentName: params.documentName,
      documentNumber: params.documentNumber,
      contractor: params.contractor,
      contractorEmail: params.contractorEmail,
      rejectedBy: params.rejectedBy,
      rejectedAt: new Date(),
      reasons: params.reasons,
      customMessage: params.customMessage || '',
      emailBody,
      notificationSent: false,
      resubmissionReceived: false,
    };

    this.rejectionHistory.update(history => [record, ...history]);
    return record;
  }

  async sendRejectionNotification(rejectionId: string): Promise<{ success: boolean; error?: string }> {
    const rejection = this.rejectionHistory().find(r => r.id === rejectionId);
    if (!rejection) {
      return { success: false, error: 'Rejection record not found' };
    }

    // Production: send via SMTP or Azure Communication Services
    // await this.http.post(`${this.apiUrl}/notifications/send`, { ... });
    await this.delay(100);

    // Log the notification
    const notification: NotificationRecord = {
      id: `NTF-${Date.now().toString(36).toUpperCase()}`,
      type: 'rejection',
      recipientEmail: rejection.contractorEmail,
      recipientName: rejection.contractor,
      subject: `Document Rejection: ${rejection.documentNumber} — Resubmission Required`,
      body: rejection.emailBody,
      sentAt: new Date(),
      status: 'sent',
      relatedDocumentId: rejection.documentNumber,
    };
    this.notificationLog.update(log => [notification, ...log]);

    // Update rejection record
    this.rejectionHistory.update(history =>
      history.map(r => r.id === rejectionId ? { ...r, notificationSent: true } : r)
    );

    return { success: true };
  }

  // ── TRANSMITTAL NOTIFICATIONS ────────────────────────────────────────────

  async sendTransmittalNotification(
    transmittal: TransmittalPayload,
    recipients: DistributionRecipient[]
  ): Promise<{ success: boolean; sentCount: number }> {
    // Production: send bulk email via SMTP or Azure Communication Services
    await this.delay(60);

    let sentCount = 0;
    for (const recipient of recipients) {
      const notification: NotificationRecord = {
        id: `NTF-${Date.now().toString(36).toUpperCase()}-${sentCount}`,
        type: 'transmittal',
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        subject: `Incoming Transmittal: ${transmittal.trnNumber} — ${transmittal.title}`,
        body: this.generateTransmittalEmail(transmittal, recipient),
        sentAt: new Date(),
        status: 'sent',
        relatedDocumentId: transmittal.trnNumber,
      };
      this.notificationLog.update(log => [notification, ...log]);
      sentCount++;
    }

    return { success: true, sentCount };
  }

  // ── STATUS UPDATE NOTIFICATIONS ──────────────────────────────────────────

  async sendStatusUpdateNotification(
    documentNumber: string,
    newStatus: string,
    recipientEmail: string,
    recipientName: string
  ): Promise<{ success: boolean }> {
    await this.delay(50);

    const notification: NotificationRecord = {
      id: `NTF-${Date.now().toString(36).toUpperCase()}`,
      type: 'status_update',
      recipientEmail,
      recipientName,
      subject: `Document Status Update: ${documentNumber} — ${newStatus}`,
      body: `Document ${documentNumber} status has been updated to "${newStatus}".`,
      sentAt: new Date(),
      status: 'sent',
      relatedDocumentId: documentNumber,
    };
    this.notificationLog.update(log => [notification, ...log]);

    return { success: true };
  }

  // ── EMAIL GENERATION ─────────────────────────────────────────────────────

  generateRejectionEmail(params: {
    documentName: string;
    documentNumber: string;
    contractor: string;
    reasons: RejectionReason[];
    customMessage?: string;
  }): string {
    const reasonsList = params.reasons.map((r, i) =>
      `${i + 1}. [${r.code}] ${r.label}\n   ${r.template}`
    ).join('\n\n');

    return `Dear ${params.contractor} Document Control Team,

This notification is to inform you that the following document submittal has been REJECTED and requires resubmission.

DOCUMENT DETAILS:
─────────────────────────────────
Document Number:  ${params.documentNumber}
File Name:        ${params.documentName}
Date Rejected:    ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}

REASON(S) FOR REJECTION:
─────────────────────────────────
${reasonsList}
${params.customMessage ? `\nADDITIONAL COMMENTS:\n─────────────────────────────────\n${params.customMessage}\n` : ''}
ACTION REQUIRED:
─────────────────────────────────
Please address the above issues and resubmit the corrected document(s) via the SDx portal.
Ensure the load sheet is updated to reflect the corrections before resubmission.

If you have questions regarding this rejection, please contact the VGL Document Control team.

Regards,
VGL Document Control
Venture Global CP2 LNG
──────────────────────────────────────────────────
This is an automated notification from the VG CP2 Document Control System.`;
  }

  private generateTransmittalEmail(
    transmittal: TransmittalPayload,
    recipient: DistributionRecipient
  ): string {
    return `Dear ${recipient.name},

You have received a new document transmittal.

TRANSMITTAL DETAILS:
─────────────────────────────────
Transmittal No:     ${transmittal.trnNumber}
From Organisation:  ${transmittal.fromOrg}
Contract:           ${transmittal.contract}
Document Title:     ${transmittal.title}
Document Type:      ${transmittal.documentType}
Discipline:         ${transmittal.discipline}
Revision:           ${transmittal.revision}
Reason for Issue:   ${transmittal.reasonForIssue}
Security Class:     ${transmittal.securityClass}
Date Issued:        ${transmittal.dateIssued}

Please log in to the SDx portal to view and download the document(s).

Regards,
VGL Document Control
Venture Global CP2 LNG`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
