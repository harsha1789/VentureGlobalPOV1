import { Pipe, PipeTransform } from '@angular/core';
import { WorkQueueItem, QueueItemStatus } from '../models';

@Pipe({
  name: 'filterByStatus',
  standalone: true,
})
export class FilterByStatusPipe implements PipeTransform {
  transform(items: WorkQueueItem[], status: QueueItemStatus): number {
    return items.filter(i => i.status === status).length;
  }
}
