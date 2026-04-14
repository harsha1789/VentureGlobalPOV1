import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Scenario, SessionStats } from '../../models';

@Component({
  selector: 'vg-scenario-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scenario-panel.component.html',
  styleUrls: ['./scenario-panel.component.scss'],
})
export class ScenarioPanelComponent {
  @Input() scenarios:        Scenario[]    = [];
  @Input() selectedScenario: string | null = null;
  @Input() isRunning:        boolean       = false;
  @Input() stats:            SessionStats  = { total: 0, pass: 0, fail: 0, review: 0 };

  @Output() scenarioSelected = new EventEmitter<string>();
  @Output() runClicked       = new EventEmitter<void>();

  get runBtnLabel(): string {
    if (this.isRunning) return 'Running…';
    if (!this.selectedScenario) return 'Select a scenario';
    const s = this.scenarios.find(sc => sc.id === this.selectedScenario);
    if (!s) return 'Run';
    return s.id === 'bulk' ? `Run Bulk (${s.docCount} docs)` : `Run ${s.label}`;
  }

  onSelect(id: string): void {
    if (!this.isRunning) this.scenarioSelected.emit(id);
  }

  onRun(): void {
    if (!this.isRunning && this.selectedScenario) this.runClicked.emit();
  }
}
