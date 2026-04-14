import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditRecord, Decision } from '../../models';

@Component({
  selector: 'vg-audit-log',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.scss'],
})
export class AuditLogComponent {
  @Input() records:          AuditRecord[] = [];
  @Input() isRunning:        boolean       = false;
  @Input() showRejectAction: boolean       = false;

  @Output() clearClicked       = new EventEmitter<void>();
  @Output() exportClicked     = new EventEmitter<void>();
  @Output() rejectClicked     = new EventEmitter<AuditRecord>();
  @Output() errorReportClicked = new EventEmitter<AuditRecord>();
  @Output() viewDetailsClicked = new EventEmitter<AuditRecord>();

  get recordCount(): string {
    const n = this.records.length;
    return `${n} record${n !== 1 ? 's' : ''}`;
  }

  isProcessing(record: AuditRecord): boolean {
    return record.durationMs === 0;
  }

  scoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  decisionClass(decision: Decision): string {
    return decision;
  }

  decisionLabel(decision: Decision): string {
    return { accept: 'ACCEPTED', reject: 'REJECTED', review: 'REVIEW' }[decision];
  }

  formatDuration(ms: number): string {
    if (ms === 0) return '—';
    return `${ms}ms`;
  }

  formatTime(date: Date): string {
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
  }

  formatDate(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  trackById(_: number, record: AuditRecord): number {
    return record.id;
  }
}
