import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { RejectionReason, RejectionRecord, REJECTION_REASONS } from '../../models';

@Component({
  selector: 'vg-rejection-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rejection-dialog.component.html',
  styleUrls: ['./rejection-dialog.component.scss'],
})
export class RejectionDialogComponent {
  @Input() isOpen: boolean = false;
  @Input() documentName: string = '';
  @Input() documentNumber: string = '';
  @Input() contractor: string = '';
  @Input() contractorEmail: string = '';
  @Input() failedChecks: { field: string; note: string }[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() rejected = new EventEmitter<RejectionRecord>();

  selectedReasons: RejectionReason[] = [];
  customMessage = '';
  activeTab: 'reasons' | 'preview' | 'history' = 'reasons';
  isSending = signal(false);

  constructor(public notification: NotificationService) {}

  get categories() {
    return this.notification.getRejectionCategories();
  }

  getReasonsForCategory(category: string): RejectionReason[] {
    return this.notification.getRejectionReasonsByCategory(category);
  }

  isReasonSelected(reason: RejectionReason): boolean {
    return this.selectedReasons.some(r => r.code === reason.code);
  }

  toggleReason(reason: RejectionReason): void {
    if (this.isReasonSelected(reason)) {
      this.selectedReasons = this.selectedReasons.filter(r => r.code !== reason.code);
    } else {
      this.selectedReasons = [...this.selectedReasons, reason];
    }
  }

  autoSelectFromFailedChecks(): void {
    // Map failed validation checks to rejection reasons
    const autoReasons: RejectionReason[] = [];
    for (const check of this.failedChecks) {
      const field = check.field.toLowerCase();
      const note = check.note.toLowerCase();

      if (field.includes('contract number') || note.includes('contract number')) {
        this.addReasonByCode(autoReasons, 'RJ-M01');
      }
      if (field.includes('revision') && note.includes('missing')) {
        this.addReasonByCode(autoReasons, 'RJ-M02');
      }
      if (field.includes('issue purpose') && note.includes('not found')) {
        this.addReasonByCode(autoReasons, 'RJ-M03');
      }
      if (field.includes('security') && note.includes('missing')) {
        this.addReasonByCode(autoReasons, 'RJ-M04');
      }
      if (field.includes('doc number matches') && note.includes('does not match')) {
        this.addReasonByCode(autoReasons, 'RJ-I01');
      }
      if (field.includes('file naming') || note.includes('naming convention')) {
        this.addReasonByCode(autoReasons, 'RJ-N01');
      }
      if (field.includes('special character') && field.includes('filename')) {
        this.addReasonByCode(autoReasons, 'RJ-N02');
      }
      if (note.includes('ocr') || note.includes('not text-searchable')) {
        this.addReasonByCode(autoReasons, 'RJ-Q01');
      }
      if (note.includes('blank page')) {
        this.addReasonByCode(autoReasons, 'RJ-Q02');
      }
      if (note.includes('draft') || note.includes('watermark')) {
        this.addReasonByCode(autoReasons, 'RJ-Q03');
      }
      if (note.includes('markup') || note.includes('annotation')) {
        this.addReasonByCode(autoReasons, 'RJ-Q04');
      }
      if (note.includes('wrong contract')) {
        this.addReasonByCode(autoReasons, 'RJ-C01');
      }
      if (note.includes('under review')) {
        this.addReasonByCode(autoReasons, 'RJ-R01');
      }
      if (note.includes('prior revision') && note.includes('not present')) {
        this.addReasonByCode(autoReasons, 'RJ-R02');
      }
    }

    this.selectedReasons = autoReasons;
  }

  private addReasonByCode(list: RejectionReason[], code: string): void {
    const reason = REJECTION_REASONS.find(r => r.code === code);
    if (reason && !list.some(r => r.code === code)) {
      list.push(reason);
    }
  }

  get emailPreview(): string {
    return this.notification.generateRejectionEmail({
      documentName: this.documentName,
      documentNumber: this.documentNumber,
      contractor: this.contractor,
      reasons: this.selectedReasons,
      customMessage: this.customMessage,
    });
  }

  async onReject(): Promise<void> {
    if (this.selectedReasons.length === 0) return;

    this.isSending.set(true);

    const record = this.notification.createRejection({
      documentName: this.documentName,
      documentNumber: this.documentNumber,
      contractor: this.contractor,
      contractorEmail: this.contractorEmail || `doccontrol@${this.contractor.toLowerCase().replace(/\s+/g, '')}.com`,
      rejectedBy: 'current_user',
      reasons: this.selectedReasons,
      customMessage: this.customMessage,
    });

    await this.notification.sendRejectionNotification(record.id);

    this.isSending.set(false);
    this.rejected.emit(record);
    this.close();
  }

  close(): void {
    this.selectedReasons = [];
    this.customMessage = '';
    this.activeTab = 'reasons';
    this.closed.emit();
  }
}
