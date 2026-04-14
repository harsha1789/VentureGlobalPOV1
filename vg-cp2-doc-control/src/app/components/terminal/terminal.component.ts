import { Component, Input, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TerminalLog } from '../../models';

@Component({
  selector: 'vg-terminal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
})
export class TerminalComponent implements AfterViewChecked {
  @Input() logs:      TerminalLog[] = [];
  @Input() isRunning: boolean       = false;

  activeTab: 'details' | 'structure' | 'history' = 'details';

  @ViewChild('termBody') termBody!: ElementRef<HTMLDivElement>;

  ngAfterViewChecked(): void {
    if (this.termBody) {
      this.termBody.nativeElement.scrollTop = this.termBody.nativeElement.scrollHeight;
    }
  }
}
