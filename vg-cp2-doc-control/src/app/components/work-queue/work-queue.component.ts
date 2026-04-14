import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkQueueItem, WorkQueueFilter, QueueItemStatus } from '../../models';

@Component({
  selector: 'vg-work-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './work-queue.component.html',
  styleUrls: ['./work-queue.component.scss'],
})
export class WorkQueueComponent {
  @Input() items: WorkQueueItem[] = [];
  @Input() currentUser: string = '';
  @Input() isLoading: boolean = false;

  @Output() claimItem     = new EventEmitter<string>();
  @Output() unclaimItem   = new EventEmitter<string>();
  @Output() processItem   = new EventEmitter<WorkQueueItem>();
  @Output() refreshQueue  = new EventEmitter<void>();

  filterProject    = '';
  filterDiscipline = '';
  filterContractor = '';
  filterStatus: QueueItemStatus | '' = '';

  get filteredItems(): WorkQueueItem[] {
    return this.items.filter(item => {
      if (this.filterProject && item.project !== this.filterProject) return false;
      if (this.filterDiscipline && item.discipline !== this.filterDiscipline) return false;
      if (this.filterContractor && !item.contractor.toLowerCase().includes(this.filterContractor.toLowerCase())) return false;
      if (this.filterStatus && item.status !== this.filterStatus) return false;
      return true;
    });
  }

  get pendingCount(): number {
    return this.items.filter(i => i.status === 'pending').length;
  }

  get claimedByMeCount(): number {
    return this.items.filter(i => i.claimedBy === this.currentUser).length;
  }

  get uniqueProjects(): string[] {
    return [...new Set(this.items.map(i => i.project))];
  }

  get uniqueDisciplines(): string[] {
    return [...new Set(this.items.map(i => i.discipline))];
  }

  get uniqueContractors(): string[] {
    return [...new Set(this.items.map(i => i.contractor))];
  }

  onClaim(itemId: string): void {
    this.claimItem.emit(itemId);
  }

  onUnclaim(itemId: string): void {
    this.unclaimItem.emit(itemId);
  }

  onProcess(item: WorkQueueItem): void {
    this.processItem.emit(item);
  }

  onRefresh(): void {
    this.refreshQueue.emit();
  }

  clearFilters(): void {
    this.filterProject = '';
    this.filterDiscipline = '';
    this.filterContractor = '';
    this.filterStatus = '';
  }

  priorityClass(priority: string): string {
    return `priority-${priority}`;
  }

  statusLabel(status: QueueItemStatus): string {
    const labels: Record<QueueItemStatus, string> = {
      pending: 'Pending', claimed: 'Claimed',
      in_review: 'In Review', completed: 'Completed', rejected: 'Rejected',
    };
    return labels[status] || status;
  }

  isOverdue(item: WorkQueueItem): boolean {
    return new Date() > new Date(item.targetDate) && item.status !== 'completed';
  }

  daysUntilTarget(item: WorkQueueItem): number {
    const diff = new Date(item.targetDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  trackById(_: number, item: WorkQueueItem): string {
    return item.id;
  }
}
