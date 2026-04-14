import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PipelineResult, MetadataCheck, QualityCheck,
  PreFlightCheck, SubmittalCheck, TransmittalValidation, FinalGateCheck
} from '../models';

@Injectable({ providedIn: 'root' })
export class ErrorReportService {

  generateErrorReport(docName: string, result: PipelineResult): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // ── HEADER BAND ──
    doc.setFillColor(26, 58, 92); // VG navy
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(200, 30, 40); // Red accent stripe
    doc.rect(0, 28, pageWidth, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('VENTURE GLOBAL CP2 LNG', margin, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Document Validation Error Report', margin, 20);
    doc.text(`Generated: ${new Date().toISOString().split('T')[0]}`, pageWidth - margin, 20, { align: 'right' });

    y = 38;

    // ── DOCUMENT SUMMARY BOX ──
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 32, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const col1 = margin + 4;
    const col2 = pageWidth / 2 + 4;

    doc.text('Document:', col1, y + 7);
    doc.text('Transmittal:', col1, y + 14);
    doc.text('Decision:', col1, y + 21);
    doc.text('Audit Ref:', col1, y + 28);

    doc.text('Score:', col2, y + 7);
    doc.text('Duration:', col2, y + 14);
    doc.text('Contractor:', col2, y + 21);
    doc.text('Discipline:', col2, y + 28);

    doc.setFont('helvetica', 'normal');
    doc.text(docName, col1 + 28, y + 7);
    doc.text(result.trnNumber || '—', col1 + 28, y + 14);

    // Decision with color
    const decisionLabel = result.decision.toUpperCase();
    if (result.decision === 'reject') doc.setTextColor(220, 38, 38);
    else if (result.decision === 'review') doc.setTextColor(217, 119, 6);
    else doc.setTextColor(22, 163, 74);
    doc.setFont('helvetica', 'bold');
    doc.text(decisionLabel, col1 + 28, y + 21);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.text(result.auditRef || '—', col1 + 28, y + 28);
    doc.text(`${result.score.overall}/100`, col2 + 22, y + 7);
    doc.text(`${result.durationMs}ms`, col2 + 22, y + 14);
    doc.text(result.transmittal?.fromOrg || '—', col2 + 22, y + 21);
    doc.text(result.transmittal?.discipline || '—', col2 + 22, y + 28);

    y += 38;

    // ── SCORE BREAKDOWN ──
    y = this.addSectionTitle(doc, 'Score Breakdown', margin, y, pageWidth);
    const scoreData = [
      ['Pre-Flight (T0)', result.score.preFlightPass, result.score.preFlightFail, result.score.preFlightWarn],
      ['Metadata (T1)', result.score.metaPass, result.score.metaFail, result.score.metaWarn],
      ['Quality (T2)', result.score.qualPass, result.score.qualFail, result.score.qualWarn],
      ['Submittal (T2S)', result.score.submittalPass, result.score.submittalFail, result.score.submittalWarn],
      ['Transmittal (T3V)', result.score.transmittalPass, result.score.transmittalFail, result.score.transmittalWarn],
      ['Final Gate (T5)', result.score.finalGatePass, result.score.finalGateFail, result.score.finalGateWarn],
    ];
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Tier', 'Pass', 'Fail', 'Warn']],
      body: scoreData.map(r => [r[0], String(r[1]), String(r[2]), String(r[3])]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [33, 33, 33] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const val = parseInt(data.cell.raw as string, 10);
          if (data.column.index === 2 && val > 0) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 3 && val > 0) {
            data.cell.styles.textColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ── FAILED & WARNING CHECKS — PRE-FLIGHT ──
    const pfErrors = result.preFlight.filter(c => c.status !== 'pass');
    if (pfErrors.length > 0) {
      y = this.checkPage(doc, y, 30);
      y = this.addSectionTitle(doc, 'Pre-Flight Errors (T0)', margin, y, pageWidth);
      y = this.addCheckTable(doc, y, margin,
        ['Check', 'Detail', 'Status'],
        pfErrors.map(c => [c.check, c.detail, c.status.toUpperCase()])
      );
    }

    // ── METADATA ERRORS ──
    const metaErrors = result.metadata.filter(c => c.status !== 'pass');
    if (metaErrors.length > 0) {
      y = this.checkPage(doc, y, 30);
      y = this.addSectionTitle(doc, 'Metadata Errors & Warnings (T1)', margin, y, pageWidth);
      y = this.addCheckTable(doc, y, margin,
        ['Field', 'Extracted Value', 'Note', 'Status'],
        metaErrors.map(c => [c.field, c.extracted || '(not found)', c.note, c.status.toUpperCase()])
      );
    }

    // ── QUALITY ERRORS ──
    const qualErrors = result.quality.filter(c => c.status !== 'pass');
    if (qualErrors.length > 0) {
      y = this.checkPage(doc, y, 30);
      y = this.addSectionTitle(doc, 'Quality Issues (T2)', margin, y, pageWidth);
      y = this.addCheckTable(doc, y, margin,
        ['Check', 'Detail', 'Status'],
        qualErrors.map(c => [c.check, c.detail, c.status.toUpperCase()])
      );
    }

    // ── SUBMITTAL ERRORS ──
    const subErrors = result.submittalChecks.filter(c => c.status !== 'pass');
    if (subErrors.length > 0) {
      y = this.checkPage(doc, y, 30);
      y = this.addSectionTitle(doc, 'Submittal Issues (T2S)', margin, y, pageWidth);
      y = this.addCheckTable(doc, y, margin,
        ['Check', 'Detail', 'Status'],
        subErrors.map(c => [c.check, c.detail, c.status.toUpperCase()])
      );
    }

    // ── TRANSMITTAL VALIDATION ERRORS ──
    const trnErrors = result.transmittalValidation.filter(c => c.status !== 'pass');
    if (trnErrors.length > 0) {
      y = this.checkPage(doc, y, 30);
      y = this.addSectionTitle(doc, 'Transmittal Validation Issues (T3V)', margin, y, pageWidth);
      y = this.addCheckTable(doc, y, margin,
        ['Check', 'Detail', 'Status'],
        trnErrors.map(c => [c.check, c.detail, c.status.toUpperCase()])
      );
    }

    // ── FINAL GATE ERRORS ──
    const fgErrors = result.finalGate.filter(c => c.status !== 'pass');
    if (fgErrors.length > 0) {
      y = this.checkPage(doc, y, 30);
      y = this.addSectionTitle(doc, 'Final Gate Issues (T5)', margin, y, pageWidth);
      y = this.addCheckTable(doc, y, margin,
        ['Check', 'Detail', 'Status'],
        fgErrors.map(c => [c.check, c.detail, c.status.toUpperCase()])
      );
    }

    // ── FULL METADATA COMPARISON TABLE ──
    y = this.checkPage(doc, y, 40);
    y = this.addSectionTitle(doc, 'Full Metadata Comparison', margin, y, pageWidth);
    y = this.addCheckTable(doc, y, margin,
      ['Field', 'Extracted Value', 'Note', 'Status'],
      result.metadata.map(c => [c.field, c.extracted || '(not found)', c.note, c.status.toUpperCase()]),
      true // highlight errors
    );

    // ── TRANSMITTAL PAYLOAD ──
    if (result.transmittal) {
      y = this.checkPage(doc, y, 40);
      y = this.addSectionTitle(doc, 'Transmittal Payload', margin, y, pageWidth);
      const trn = result.transmittal;
      const trnData: string[][] = [
        ['TRN Number', trn.trnNumber],
        ['From Organisation', trn.fromOrg],
        ['Contract', trn.contract],
        ['To Organisation', trn.toOrg],
        ['Document Type', trn.documentType],
        ['Discipline', trn.discipline],
        ['Revision', trn.revision],
        ['Reason For Issue', trn.reasonForIssue],
        ['Security Classification', trn.securityClass],
        ['Issue State', trn.issueState],
        ['Date Issued', trn.dateIssued],
      ];
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Field', 'Value']],
        body: trnData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { textColor: [33, 33, 33] },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) {
            const val = data.cell.raw as string;
            if (!val || val === 'Unknown' || val === '—') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── FOOTER ON EACH PAGE ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFillColor(248, 249, 250);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('VG CP2 LNG — Document Control Automation — Error Report', margin, pageHeight - 5);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    }

    // ── SAVE ──
    const safeName = docName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    doc.save(`VG_CP2_ErrorReport_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  private addSectionTitle(doc: jsPDF, title: string, margin: number, y: number, pageWidth: number): number {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text(title, margin, y + 4);
    doc.setDrawColor(26, 58, 92);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 6, pageWidth - margin, y + 6);
    doc.setTextColor(0, 0, 0);
    return y + 10;
  }

  private addCheckTable(doc: jsPDF, y: number, margin: number, headers: string[], rows: string[][], highlightErrors = false): number {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [headers],
      body: rows,
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: [33, 33, 33] },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const statusColIdx = headers.length - 1;
        if (data.column.index === statusColIdx) {
          const status = (data.cell.raw as string || '').toLowerCase();
          if (status === 'fail') {
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fillColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'warn') {
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fillColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'pass') {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
        // Highlight entire row for fail/warn in full comparison table
        if (highlightErrors && data.column.index !== statusColIdx) {
          const rowData = data.row.raw as string[];
          const rowStatus = (rowData[rowData.length - 1] || '').toLowerCase();
          if (rowStatus === 'fail') {
            data.cell.styles.fillColor = [254, 226, 226]; // red-100
          } else if (rowStatus === 'warn') {
            data.cell.styles.fillColor = [254, 243, 199]; // yellow-100
          }
        }
      },
    });
    return (doc as any).lastAutoTable.finalY + 6;
  }

  private checkPage(doc: jsPDF, y: number, requiredSpace: number): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + requiredSpace > pageHeight - 20) {
      doc.addPage();
      return 15;
    }
    return y;
  }
}
