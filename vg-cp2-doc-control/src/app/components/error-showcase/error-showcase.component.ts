import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorShowcaseDetails } from '../../models';

@Component({
  selector: 'vg-error-showcase',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-showcase.component.html',
  styleUrls: ['./error-showcase.component.scss'],
})
export class ErrorShowcaseComponent {
  @Input() isOpen = false;
  @Input() details: ErrorShowcaseDetails | null = null;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  issueLabel(issue: { status: string }): string {
    return issue.status === 'fail'
      ? 'FAIL'
      : issue.status === 'warn'
      ? 'WARN'
      : 'PASS';
  }
}
