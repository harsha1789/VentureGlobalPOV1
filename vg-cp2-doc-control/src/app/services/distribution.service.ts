import { Injectable, signal } from '@angular/core';
import { DistributionRule, DistributionRecipient } from '../models';

/**
 * Distribution Service
 *
 * Manages distribution matrices for transmittal routing.
 * Determines who receives a document based on project, discipline, document type, and issue purpose.
 * Production: load matrices from SDx API or backend configuration.
 */
@Injectable({ providedIn: 'root' })
export class DistributionService {

  distributionRules = signal<DistributionRule[]>(this.getDefaultRules());

  // ── LOOKUP RECIPIENTS ────────────────────────────────────────────────────

  getRecipients(project: string, discipline: string, documentType: string, issuePurpose: string): DistributionRecipient[] {
    const rules = this.distributionRules();
    const recipients = new Map<string, DistributionRecipient>();

    for (const rule of rules) {
      if (this.matchesRule(rule, project, discipline, documentType, issuePurpose)) {
        for (const r of rule.recipients) {
          if (!recipients.has(r.email)) {
            recipients.set(r.email, r);
          }
        }
      }
    }

    return Array.from(recipients.values());
  }

  getRecipientsForTransmittal(transmittal: { discipline: string; documentType: string; reasonForIssue: string }): DistributionRecipient[] {
    const issuePurpose = this.extractIssuePurposeCode(transmittal.reasonForIssue);
    const docType = this.extractDocTypeCode(transmittal.documentType);
    const disc = this.extractDisciplineCode(transmittal.discipline);
    return this.getRecipients('C2', disc, docType, issuePurpose);
  }

  // ── RULE MANAGEMENT ──────────────────────────────────────────────────────

  addRule(rule: DistributionRule): void {
    this.distributionRules.update(rules => [...rules, rule]);
  }

  removeRule(ruleId: string): void {
    this.distributionRules.update(rules => rules.filter(r => r.id !== ruleId));
  }

  updateRule(ruleId: string, updates: Partial<DistributionRule>): void {
    this.distributionRules.update(rules =>
      rules.map(r => r.id === ruleId ? { ...r, ...updates } : r)
    );
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────

  private matchesRule(rule: DistributionRule, project: string, discipline: string, documentType: string, issuePurpose: string): boolean {
    const projectMatch = rule.project === '*' || rule.project.toUpperCase() === project.toUpperCase();
    const disciplineMatch = rule.discipline === '*' || rule.discipline.toUpperCase() === discipline.toUpperCase();
    const docTypeMatch = rule.documentType === '*' || rule.documentType.toUpperCase() === documentType.toUpperCase();
    const purposeMatch = rule.issuePurpose === '*' || rule.issuePurpose.toUpperCase() === issuePurpose.toUpperCase();
    return projectMatch && disciplineMatch && docTypeMatch && purposeMatch;
  }

  private extractIssuePurposeCode(value: string): string {
    const match = value.match(/\b(IFU|IFI|IFC|IFR|IFT|AFC|AFD|IFA|PUR)\b/i);
    return match ? match[1].toUpperCase() : value.toUpperCase();
  }

  private extractDocTypeCode(value: string): string {
    const match = value.match(/\b(SOW|MDR|SDR|DWG|SPE|CAL|REP|PRO|MOM|ITP|PID|SLD|GA|FAT|HAZ|REQ)\b/i);
    return match ? match[1].toUpperCase() : value.toUpperCase();
  }

  private extractDisciplineCode(value: string): string {
    const match = value.match(/\b(CMS|CIV|CME|ELE|INS|MEC|PIP|STR|PRO|HSE|QA|PUR)\b/i);
    return match ? match[1].toUpperCase() : value.toUpperCase();
  }

  // ── DEFAULT DISTRIBUTION MATRIX ──────────────────────────────────────────

  private getDefaultRules(): DistributionRule[] {
    return [
      // Project-wide rules — all disciplines
      {
        id: 'DR-001', project: 'C2', discipline: '*', documentType: '*', issuePurpose: 'AFC',
        recipients: [
          { name: 'John Mitchell', email: 'j.mitchell@ventureglobal.com', organisation: 'VGL', role: 'Project Manager' },
          { name: 'Sarah Kim', email: 's.kim@ventureglobal.com', organisation: 'VGL', role: 'Engineering Manager' },
          { name: 'David Chen', email: 'd.chen@ventureglobal.com', organisation: 'VGL', role: 'Construction Manager' },
        ],
      },
      // Mechanical discipline
      {
        id: 'DR-002', project: 'C2', discipline: 'MEC', documentType: '*', issuePurpose: '*',
        recipients: [
          { name: 'James Wong', email: 'j.wong@ventureglobal.com', organisation: 'VGL', role: 'Mechanical Lead' },
          { name: 'Maria Garcia', email: 'm.garcia@ventureglobal.com', organisation: 'VGL', role: 'Mechanical Engineer' },
        ],
      },
      // Piping discipline
      {
        id: 'DR-003', project: 'C2', discipline: 'PIP', documentType: '*', issuePurpose: '*',
        recipients: [
          { name: 'Robert Taylor', email: 'r.taylor@ventureglobal.com', organisation: 'VGL', role: 'Piping Lead' },
          { name: 'Lisa Anderson', email: 'l.anderson@ventureglobal.com', organisation: 'VGL', role: 'Piping Engineer' },
        ],
      },
      // Electrical discipline
      {
        id: 'DR-004', project: 'C2', discipline: 'ELE', documentType: '*', issuePurpose: '*',
        recipients: [
          { name: 'Ahmed Hassan', email: 'a.hassan@ventureglobal.com', organisation: 'VGL', role: 'Electrical Lead' },
        ],
      },
      // HSE discipline
      {
        id: 'DR-005', project: 'C2', discipline: 'HSE', documentType: '*', issuePurpose: '*',
        recipients: [
          { name: 'Patricia Lee', email: 'p.lee@ventureglobal.com', organisation: 'VGL', role: 'HSE Manager' },
          { name: 'Michael Brown', email: 'm.brown@ventureglobal.com', organisation: 'VGL', role: 'HSE Coordinator' },
        ],
      },
      // Structural discipline
      {
        id: 'DR-006', project: 'C2', discipline: 'STR', documentType: '*', issuePurpose: '*',
        recipients: [
          { name: 'Thomas Wilson', email: 't.wilson@ventureglobal.com', organisation: 'VGL', role: 'Structural Lead' },
        ],
      },
      // QA discipline
      {
        id: 'DR-007', project: 'C2', discipline: 'QA', documentType: 'ITP', issuePurpose: '*',
        recipients: [
          { name: 'Jennifer Davis', email: 'j.davis@ventureglobal.com', organisation: 'VGL', role: 'QA/QC Manager' },
          { name: 'Kevin Martinez', email: 'k.martinez@ventureglobal.com', organisation: 'VGL', role: 'QA Engineer' },
        ],
      },
      // Document Control — always included
      {
        id: 'DR-008', project: 'C2', discipline: '*', documentType: '*', issuePurpose: '*',
        recipients: [
          { name: 'Autumn Hampton', email: 'a.hampton@ventureglobal.com', organisation: 'VGL', role: 'Document Control Lead' },
        ],
      },
      // IFR documents — include engineering review team
      {
        id: 'DR-009', project: 'C2', discipline: '*', documentType: '*', issuePurpose: 'IFR',
        recipients: [
          { name: 'Sarah Kim', email: 's.kim@ventureglobal.com', organisation: 'VGL', role: 'Engineering Manager' },
        ],
      },
      // CMS (Configuration Management)
      {
        id: 'DR-010', project: 'C2', discipline: 'CMS', documentType: '*', issuePurpose: '*',
        recipients: [
          { name: 'Autumn Hampton', email: 'a.hampton@ventureglobal.com', organisation: 'VGL', role: 'Document Control Lead' },
          { name: 'Kirk Reynolds', email: 'k.reynolds@ventureglobal.com', organisation: 'VGL', role: 'Systems Administrator' },
        ],
      },
    ];
  }
}
