import { Injectable, signal } from '@angular/core';
import {
  LoadSheetRow, LoadSheetValidationResult, LoadSheetFieldError,
  FileUploadResult, VALID_ISSUE_PURPOSES, VALID_SECURITY_CLASSES,
  VALID_DOC_TYPES, VALID_DISCIPLINES, SPECIAL_CHAR_PATTERN
} from '../models';

@Injectable({ providedIn: 'root' })
export class FileIngestionService {

  uploadedFiles = signal<FileUploadResult[]>([]);
  loadSheetRows = signal<LoadSheetRow[]>([]);
  loadSheetValidation = signal<LoadSheetValidationResult[]>([]);
  isProcessing = signal(false);

  // ── CSV LOAD SHEET COLUMNS (expected headers) ────────────────────────────

  private readonly REQUIRED_COLUMNS = [
    'Document Number', 'File Name', 'Document Title', 'Revision',
    'Issue Purpose', 'Security Classification', 'Document Type',
    'Discipline Code', 'Contract Number'
  ];

  private readonly COLUMN_MAP: Record<string, keyof LoadSheetRow> = {
    'document number': 'documentNumber',
    'doc number': 'documentNumber',
    'doc no': 'documentNumber',
    'file name': 'fileName',
    'filename': 'fileName',
    'document title': 'documentTitle',
    'title': 'documentTitle',
    'revision': 'revision',
    'rev': 'revision',
    'revision number': 'revision',
    'issue purpose': 'issuePurpose',
    'reason for issue': 'issuePurpose',
    'security classification': 'securityClassification',
    'security class': 'securityClassification',
    'security code': 'securityClassification',
    'document type': 'documentType',
    'doc type': 'documentType',
    'discipline code': 'disciplineCode',
    'discipline': 'disciplineCode',
    'contract number': 'contractNumber',
    'contract no': 'contractNumber',
    'contract': 'contractNumber',
    'supplier name': 'supplierName',
    'supplier': 'supplierName',
    'vendor': 'supplierName',
    'purchase order number': 'purchaseOrderNumber',
    'po number': 'purchaseOrderNumber',
    'po no': 'purchaseOrderNumber',
    'document date': 'documentDate',
    'date': 'documentDate',
    'issue date': 'documentDate',
  };

  // ── FILE UPLOAD HANDLING ─────────────────────────────────────────────────

  async addFiles(files: FileList | File[]): Promise<FileUploadResult[]> {
    this.isProcessing.set(true);
    const results: FileUploadResult[] = [];

    for (const file of Array.from(files)) {
      const result: FileUploadResult = {
        file,
        name: file.name,
        size: file.size,
        type: file.type || this.inferFileType(file.name),
        extractedText: '',
        status: 'pending',
      };

      try {
        result.extractedText = await this.extractText(file);
        result.status = 'extracted';
      } catch (err: any) {
        result.status = 'error';
        result.error = err.message || 'Failed to extract text';
      }

      results.push(result);
    }

    this.uploadedFiles.update(existing => [...existing, ...results]);
    this.isProcessing.set(false);
    return results;
  }

  removeFile(fileName: string): void {
    this.uploadedFiles.update(files => files.filter(f => f.name !== fileName));
  }

  clearFiles(): void {
    this.uploadedFiles.set([]);
    this.loadSheetRows.set([]);
    this.loadSheetValidation.set([]);
  }

  // ── CSV LOAD SHEET PARSING ───────────────────────────────────────────────

  async parseLoadSheet(file: File): Promise<LoadSheetRow[]> {
    const text = await this.readFileAsText(file);
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error('Load sheet must contain at least a header row and one data row');
    }

    // Parse header row
    const headers = this.parseCSVLine(lines[0]);
    const columnMapping = this.mapColumns(headers);

    // Validate required columns are present
    const missingColumns = this.REQUIRED_COLUMNS.filter(col => {
      const key = col.toLowerCase();
      return !Object.keys(columnMapping).some(mapped => mapped === this.COLUMN_MAP[key]);
    });

    if (missingColumns.length > 0) {
      throw new Error(`Load sheet is missing required columns: ${missingColumns.join(', ')}`);
    }

    // Parse data rows
    const rows: LoadSheetRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: LoadSheetRow = { rowIndex: i } as LoadSheetRow;

      headers.forEach((header, idx) => {
        const mappedField = this.COLUMN_MAP[header.toLowerCase().trim()];
        if (mappedField && idx < values.length) {
          (row as any)[mappedField] = values[idx].trim();
        }
      });

      // Only add rows with at least a document number or file name
      if (row.documentNumber || row.fileName) {
        rows.push(row);
      }
    }

    this.loadSheetRows.set(rows);
    return rows;
  }

  // ── LOAD SHEET VALIDATION ────────────────────────────────────────────────

  validateLoadSheet(rows: LoadSheetRow[], uploadedFileNames: string[]): LoadSheetValidationResult[] {
    const results: LoadSheetValidationResult[] = [];

    for (const row of rows) {
      const errors: LoadSheetFieldError[] = [];
      const warnings: LoadSheetFieldError[] = [];

      // Check 1: Spaces and special characters in document number
      if (!row.documentNumber) {
        errors.push({ field: 'documentNumber', message: 'Document number is required', value: '', rule: 'QA-1' });
      } else {
        if (/\s/.test(row.documentNumber)) {
          errors.push({ field: 'documentNumber', message: 'Document number contains spaces', value: row.documentNumber, rule: 'QA-1' });
        }
        if (SPECIAL_CHAR_PATTERN.test(row.documentNumber)) {
          errors.push({ field: 'documentNumber', message: 'Document number contains special characters', value: row.documentNumber, rule: 'QA-1' });
        }
      }

      // Check 2: Spaces and special characters in file name
      if (!row.fileName) {
        errors.push({ field: 'fileName', message: 'File name is required', value: '', rule: 'QA-2' });
      } else {
        if (/^\s|\s$/.test(row.fileName)) {
          errors.push({ field: 'fileName', message: 'File name has leading/trailing spaces', value: row.fileName, rule: 'QA-2' });
        }
        if (/\s{2,}/.test(row.fileName.replace(/\.[^.]+$/, ''))) {
          errors.push({ field: 'fileName', message: 'File name contains double spaces', value: row.fileName, rule: 'QA-2' });
        }
        const nameWithoutExt = row.fileName.replace(/\.[^.]+$/, '');
        if (SPECIAL_CHAR_PATTERN.test(nameWithoutExt)) {
          errors.push({ field: 'fileName', message: 'File name contains special characters', value: row.fileName, rule: 'QA-2' });
        }
      }

      // Check 3: Document number matches file name
      if (row.documentNumber && row.fileName) {
        const fileBase = row.fileName.replace(/\.[^.]+$/, '');
        if (row.documentNumber.toLowerCase() !== fileBase.toLowerCase()) {
          errors.push({
            field: 'crossRef', message: `Document number "${row.documentNumber}" does not match file name "${fileBase}"`,
            value: `${row.documentNumber} vs ${fileBase}`, rule: 'QA-3'
          });
        }
      }

      // Check 6: Security classification
      if (!row.securityClassification) {
        warnings.push({ field: 'securityClassification', message: 'Security classification not provided', value: '', rule: 'QA-6' });
      } else if (!VALID_SECURITY_CLASSES.some(c => row.securityClassification.toLowerCase().includes(c.toLowerCase()))) {
        errors.push({ field: 'securityClassification', message: `Invalid security classification: "${row.securityClassification}"`, value: row.securityClassification, rule: 'QA-6' });
      }

      // Check: Issue purpose
      if (!row.issuePurpose) {
        errors.push({ field: 'issuePurpose', message: 'Issue purpose is required', value: '', rule: 'QA-IP' });
      } else {
        const purposeCode = row.issuePurpose.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase();
        if (!VALID_ISSUE_PURPOSES.includes(purposeCode)) {
          errors.push({ field: 'issuePurpose', message: `Invalid issue purpose code: "${row.issuePurpose}"`, value: row.issuePurpose, rule: 'QA-IP' });
        }
      }

      // Check: Document type
      if (row.documentType) {
        const typeCode = row.documentType.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase();
        if (!VALID_DOC_TYPES.includes(typeCode)) {
          warnings.push({ field: 'documentType', message: `Unrecognised document type: "${row.documentType}"`, value: row.documentType, rule: 'QA-DT' });
        }
      }

      // Check: Discipline code
      if (row.disciplineCode) {
        const discCode = row.disciplineCode.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase();
        if (!VALID_DISCIPLINES.includes(discCode)) {
          warnings.push({ field: 'disciplineCode', message: `Unrecognised discipline code: "${row.disciplineCode}"`, value: row.disciplineCode, rule: 'QA-DC' });
        }
      }

      // Check 7: Supplier name populated
      if (!row.supplierName || row.supplierName.trim() === '') {
        warnings.push({ field: 'supplierName', message: 'Supplier name is not populated', value: '', rule: 'QA-7' });
      }

      // Check 8: Purchase order number
      if (!row.purchaseOrderNumber || row.purchaseOrderNumber.trim() === '') {
        warnings.push({ field: 'purchaseOrderNumber', message: 'Purchase order number is not populated', value: '', rule: 'QA-8' });
      }

      // Check: File exists in uploaded files
      if (row.fileName && uploadedFileNames.length > 0) {
        if (!uploadedFileNames.some(f => f.toLowerCase() === row.fileName.toLowerCase())) {
          errors.push({
            field: 'fileName', message: `File "${row.fileName}" referenced in load sheet but not uploaded`,
            value: row.fileName, rule: 'QA-FILE'
          });
        }
      }

      // Check: Document title
      if (!row.documentTitle || row.documentTitle.trim().length < 5) {
        warnings.push({ field: 'documentTitle', message: 'Document title is missing or too short', value: row.documentTitle || '', rule: 'QA-TITLE' });
      }

      // Check: Revision
      if (!row.revision) {
        errors.push({ field: 'revision', message: 'Revision is required', value: '', rule: 'QA-REV' });
      }

      results.push({
        row,
        errors,
        warnings,
        isValid: errors.length === 0,
      });
    }

    // Batch-level checks (loadsheet checks 4 & 5)
    if (rows.length > 1) {
      const disciplines = new Set(rows.map(r => r.disciplineCode?.toUpperCase()).filter(Boolean));
      const purposes = new Set(rows.map(r => r.issuePurpose?.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase()).filter(Boolean));

      if (disciplines.size > 1) {
        for (const result of results) {
          result.warnings.push({
            field: 'batch', message: `Mixed disciplines in batch: ${Array.from(disciplines).join(', ')}`,
            value: Array.from(disciplines).join(', '), rule: 'QA-4'
          });
        }
      }
      if (purposes.size > 1) {
        for (const result of results) {
          result.warnings.push({
            field: 'batch', message: `Mixed issue purposes in batch: ${Array.from(purposes).join(', ')}`,
            value: Array.from(purposes).join(', '), rule: 'QA-5'
          });
        }
      }
    }

    this.loadSheetValidation.set(results);
    return results;
  }

  // ── TEXT EXTRACTION ──────────────────────────────────────────────────────

  private async extractText(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'txt':
        return this.readFileAsText(file);

      case 'csv':
        return this.readFileAsText(file);

      case 'pdf':
        // In production: integrate Azure Document Intelligence or pdf.js
        // For now: attempt FileReader text extraction
        return this.extractPdfText(file);

      case 'doc':
      case 'docx':
        // In production: use server-side extraction or Azure Document Intelligence
        return this.readFileAsText(file).catch(() =>
          `[Binary file — requires server-side text extraction: ${file.name}]`
        );

      case 'xls':
      case 'xlsx':
        return `[Spreadsheet file — requires server-side processing: ${file.name}]`;

      case 'dwg':
        return `[CAD file — requires server-side processing: ${file.name}]`;

      default:
        return this.readFileAsText(file);
    }
  }

  private async extractPdfText(file: File): Promise<string> {
    // Attempt basic text extraction from PDF
    // In production, this should use pdf.js or Azure Document Intelligence
    try {
      const text = await this.readFileAsText(file);
      // Check if we got meaningful text (PDF text extraction can return binary garbage)
      const printableRatio = (text.match(/[\x20-\x7E]/g) || []).length / text.length;
      if (printableRatio > 0.5 && text.length > 50) {
        return text;
      }
      return `[PDF requires OCR processing — Azure Document Intelligence integration needed: ${file.name}]`;
    } catch {
      return `[PDF requires OCR processing — Azure Document Intelligence integration needed: ${file.name}]`;
    }
  }

  // ── CSV HELPERS ──────────────────────────────────────────────────────────

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private mapColumns(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const header of headers) {
      const key = header.toLowerCase().trim();
      if (this.COLUMN_MAP[key]) {
        mapping[this.COLUMN_MAP[key]] = header;
      }
    }
    return mapping;
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsText(file);
    });
  }

  private inferFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      pdf: 'application/pdf', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dwg: 'application/acad', txt: 'text/plain', csv: 'text/csv',
    };
    return typeMap[ext || ''] || 'application/octet-stream';
  }
}
