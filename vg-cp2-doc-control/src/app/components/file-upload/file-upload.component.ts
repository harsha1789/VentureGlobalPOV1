import { Component, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileIngestionService } from '../../services/file-ingestion.service';
import { FileUploadResult, LoadSheetRow, LoadSheetValidationResult } from '../../models';

@Component({
  selector: 'vg-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
})
export class FileUploadComponent {
  @Output() filesReady = new EventEmitter<{ files: FileUploadResult[]; loadSheet: LoadSheetRow[]; validation: LoadSheetValidationResult[] }>();
  @Output() processFiles = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('csvInput') csvInput!: ElementRef<HTMLInputElement>;

  isDragOver = false;
  loadSheetFile: File | null = null;
  loadSheetError: string = '';
  activeTab: 'files' | 'loadsheet' | 'validation' = 'files';

  constructor(public ingestion: FileIngestionService) {}

  // ── DRAG AND DROP ────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await this.handleFiles(files);
    }
  }

  // ── FILE INPUT ───────────────────────────────────────────────────────────

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(input.files);
    }
  }

  async onCsvSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.loadSheetFile = input.files[0];
      this.loadSheetError = '';
      try {
        await this.ingestion.parseLoadSheet(this.loadSheetFile);
        this.activeTab = 'loadsheet';
        this.runValidation();
      } catch (err: any) {
        this.loadSheetError = err.message;
      }
    }
  }

  private async handleFiles(fileList: FileList): Promise<void> {
    // Separate CSV load sheet from document files
    const docFiles: File[] = [];
    for (const file of Array.from(fileList)) {
      if (file.name.toLowerCase().endsWith('.csv') && !this.loadSheetFile) {
        this.loadSheetFile = file;
        try {
          await this.ingestion.parseLoadSheet(file);
        } catch (err: any) {
          this.loadSheetError = err.message;
        }
      } else {
        docFiles.push(file);
      }
    }

    if (docFiles.length > 0) {
      await this.ingestion.addFiles(docFiles);
    }

    this.runValidation();
  }

  // ── VALIDATION ───────────────────────────────────────────────────────────

  runValidation(): void {
    const rows = this.ingestion.loadSheetRows();
    const fileNames = this.ingestion.uploadedFiles().map(f => f.name);
    if (rows.length > 0) {
      this.ingestion.validateLoadSheet(rows, fileNames);
      this.activeTab = 'validation';
    }
    this.emitReady();
  }

  private emitReady(): void {
    this.filesReady.emit({
      files: this.ingestion.uploadedFiles(),
      loadSheet: this.ingestion.loadSheetRows(),
      validation: this.ingestion.loadSheetValidation(),
    });
  }

  // ── ACTIONS ──────────────────────────────────────────────────────────────

  openFileDialog(): void {
    this.fileInput.nativeElement.click();
  }

  openCsvDialog(): void {
    this.csvInput.nativeElement.click();
  }

  removeFile(fileName: string): void {
    this.ingestion.removeFile(fileName);
    this.runValidation();
  }

  clearAll(): void {
    this.ingestion.clearFiles();
    this.loadSheetFile = null;
    this.loadSheetError = '';
    this.activeTab = 'files';
  }

  onProcess(): void {
    this.processFiles.emit();
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────

  get canProcess(): boolean {
    const files = this.ingestion.uploadedFiles();
    const rows = this.ingestion.loadSheetRows();
    return files.length > 0 && rows.length > 0 && !this.ingestion.isProcessing();
  }

  get validationSummary(): { total: number; valid: number; errors: number; warnings: number } {
    const results = this.ingestion.loadSheetValidation();
    return {
      total: results.length,
      valid: results.filter(r => r.isValid && r.warnings.length === 0).length,
      errors: results.filter(r => !r.isValid).length,
      warnings: results.filter(r => r.isValid && r.warnings.length > 0).length,
    };
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  fileIcon(type: string): string {
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('word') || type.includes('doc')) return 'DOC';
    if (type.includes('excel') || type.includes('sheet')) return 'XLS';
    if (type.includes('dwg') || type.includes('acad')) return 'DWG';
    if (type.includes('csv')) return 'CSV';
    return 'TXT';
  }
}
