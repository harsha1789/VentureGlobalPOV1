// ─── USER & AUTH ─────────────────────────────────────────────────────────────

export type UserRole = 'document_controller' | 'admin' | 'viewer' | 'reviewer' | 'contractor_readonly';

export interface User {
  username: string;
  displayName: string;
  role: UserRole;
  initials: string;
  organisation?: string;
  contract?: string;
}

export interface RolePermissions {
  canUploadFiles: boolean;
  canClaimDocuments: boolean;
  canApproveReject: boolean;
  canViewAllProjects: boolean;
  canManageUsers: boolean;
  canExportAudit: boolean;
  canConfigureDistribution: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canUploadFiles: true, canClaimDocuments: true, canApproveReject: true,
    canViewAllProjects: true, canManageUsers: true, canExportAudit: true, canConfigureDistribution: true,
  },
  document_controller: {
    canUploadFiles: true, canClaimDocuments: true, canApproveReject: true,
    canViewAllProjects: false, canManageUsers: false, canExportAudit: true, canConfigureDistribution: false,
  },
  reviewer: {
    canUploadFiles: false, canClaimDocuments: false, canApproveReject: true,
    canViewAllProjects: false, canManageUsers: false, canExportAudit: true, canConfigureDistribution: false,
  },
  viewer: {
    canUploadFiles: false, canClaimDocuments: false, canApproveReject: false,
    canViewAllProjects: false, canManageUsers: false, canExportAudit: false, canConfigureDistribution: false,
  },
  contractor_readonly: {
    canUploadFiles: false, canClaimDocuments: false, canApproveReject: false,
    canViewAllProjects: false, canManageUsers: false, canExportAudit: false, canConfigureDistribution: false,
  },
};

export interface LoginCredentials {
  username: string;
  password: string;
}

// ─── DOCUMENT & VALIDATION ───────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'fail' | 'warn';
export type Decision    = 'accept' | 'reject' | 'review';
export type ScenarioType = 'valid' | 'invalid' | 'bulk' | 'pdf';
export type TierCode    = 'T0' | 'T1' | 'T2' | 'T2S' | 'T3' | 'T3V' | 'T4' | 'T5';

export interface MetadataCheck {
  field:     string;
  extracted: string | null;
  status:    CheckStatus;
  note:      string;
  tier:      TierCode;
}

export interface QualityCheck {
  check:   string;
  detail:  string;
  status:  CheckStatus;
  method:  string;
}

export interface PreFlightCheck {
  check:   string;
  detail:  string;
  status:  CheckStatus;
  tier:    'T0';
}

export interface SubmittalCheck {
  check:   string;
  detail:  string;
  status:  CheckStatus;
  tier:    'T2S';
}

export interface TransmittalValidation {
  check:   string;
  detail:  string;
  status:  CheckStatus;
  tier:    'T3V';
}

export interface FinalGateCheck {
  check:   string;
  detail:  string;
  status:  CheckStatus;
  tier:    'T5';
}

export interface ErrorShowcaseIssue {
  label:  string;
  status: CheckStatus;
  note:   string;
  tier?:  string;
}

export interface ErrorShowcaseDetails {
  docName:     string;
  ocrStatus:   CheckStatus;
  ocrDetail:   string;
  issues:      ErrorShowcaseIssue[];
  previewText: string;
}

export interface TransmittalPayload {
  trnNumber:       string;
  fromOrg:         string;
  contract:        string;
  toOrg:           string;
  fromRole:        string;
  title:           string;
  documentType:    string;
  discipline:      string;
  revision:        string;
  reasonForIssue:  string;
  securityClass:   string;
  issueState:      string;
  dateIssued:      string;
}

export interface ValidationScore {
  preFlightPass: number;
  preFlightFail: number;
  preFlightWarn: number;
  metaPass: number;
  metaFail: number;
  metaWarn: number;
  qualPass: number;
  qualFail: number;
  qualWarn: number;
  submittalPass: number;
  submittalFail: number;
  submittalWarn: number;
  transmittalPass: number;
  transmittalFail: number;
  transmittalWarn: number;
  finalGatePass: number;
  finalGateFail: number;
  finalGateWarn: number;
  overall:  number;
}

export interface PipelineResult {
  preFlight:             PreFlightCheck[];
  metadata:              MetadataCheck[];
  quality:               QualityCheck[];
  submittalChecks:       SubmittalCheck[];
  transmittal:           TransmittalPayload;
  transmittalValidation: TransmittalValidation[];
  score:                 ValidationScore;
  decision:              Decision;
  finalGate:             FinalGateCheck[];
  durationMs:            number;
  auditRef:              string;
  trnNumber:             string;
}

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

export interface AuditRecord {
  id:          number;
  documentName: string;
  scenario:    string;
  decision:    Decision;
  score:       number;
  trnNumber:   string;
  durationMs:  number;
  timestamp:   Date;
  operator:    string;
  checks: {
    totalPass: number;
    totalFail: number;
    totalWarn: number;
  };
  tiersRun: TierCode[];
}

// ─── SCENARIO ────────────────────────────────────────────────────────────────

export interface ContractDocument {
  name: string;
  text: string;
  type: 'valid' | 'invalid';
}

export interface Scenario {
  id:          ScenarioType;
  label:       string;
  description: string;
  badge:       string;
  docCount:    number;
  chips:       string[];
}

// ─── TERMINAL LOG ────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'ok' | 'warn' | 'err' | 'sys';

export interface TerminalLog {
  timestamp: string;
  tag:       string;
  message:   string;
  level:     LogLevel;
}

// ─── SESSION STATS ───────────────────────────────────────────────────────────

export interface SessionStats {
  total:  number;
  pass:   number;
  fail:   number;
  review: number;
}

// ─── PIPELINE STEP ───────────────────────────────────────────────────────────

export interface PipelineStep {
  id:     string;
  label:  string;
  tier:   string;
  state:  'idle' | 'active' | 'done' | 'error';
}

// ─── LOADSHEET QA CHECKS (from actual VG process) ────────────────────────────

export interface LoadsheetQACheck {
  number:      number;
  description: string;
  column:      string;
  automatable: boolean;
  method:      string;
}

export const LOADSHEET_QA_CHECKS: LoadsheetQACheck[] = [
  { number: 1, description: 'Check for spaces and special characters in document number', column: 'Document Number', automatable: true,  method: 'Regex: /[~,/,\\,@,&,%,!]/' },
  { number: 2, description: 'Check for spaces and special characters in file name',       column: 'File Name',       automatable: true,  method: 'Regex on filename string' },
  { number: 3, description: 'Confirm document number matches file name',                  column: 'Cross-field',     automatable: true,  method: 'Exact string comparison (strip extension)' },
  { number: 4, description: 'No mixed document disciplines and doc types',                column: 'Discipline/Type', automatable: true,  method: 'Group by discipline, assert uniqueness in batch' },
  { number: 5, description: 'No mixed issue purpose (superseding is an exception)',       column: 'Issue Purpose',   automatable: true,  method: 'Group by issue purpose, check batch consistency' },
  { number: 6, description: 'Correct security classification',                            column: 'Security Code',   automatable: true,  method: 'Enum lookup: Company Use | Confidential | Restricted' },
  { number: 7, description: 'Supplier name is populated',                                 column: 'Supplier Name',   automatable: true,  method: 'Null / empty string check' },
  { number: 8, description: 'Purchase order number populated and matches document',       column: 'PO Number',       automatable: true,  method: 'Conditional null check + cross-reference to document body' },
];

export const DOCUMENT_QA_CHECKS: string[] = [
  'Document Number',
  'Document Title',
  'Document Revision',
  'Security Classification',
  'Reason for Issue',
  'Prior revision availability and match',
  'Revision history is complete',
  'Document metadata on each page',
  'Text searchability (OCR)',
  'Page orientation',
  'Check for prior revisions still under review',
  'Confirm no markups are present on documents',
  'Confirm documents submitted under the correct contract',
  'Check revision and issue purpose alignment',
];

export const VALID_ISSUE_PURPOSES = ['IFU', 'IFI', 'IFC', 'IFR', 'IFT', 'AFC', 'AFD', 'IFA', 'PUR'];
export const VALID_SECURITY_CLASSES = ['Company Use', 'Confidential', 'Restricted', 'Public'];
export const VALID_DOC_TYPES = ['SOW', 'MDR', 'SDR', 'DWG', 'SPE', 'CAL', 'REP', 'PRO', 'MOM', 'ITP', 'PID', 'SLD', 'GA', 'FAT', 'HAZ', 'REQ'];
export const VALID_DISCIPLINES = ['CMS', 'CIV', 'CME', 'ELE', 'INS', 'MEC', 'PIP', 'STR', 'PRO', 'HSE', 'QA', 'PUR'];
export const SPECIAL_CHAR_PATTERN = /[~\/\\@&%!#$^*()+={}\[\]|<>?]/;

// ─── CSV LOAD SHEET ─────────────────────────────────────────────────────────

export interface LoadSheetRow {
  rowIndex: number;
  documentNumber: string;
  fileName: string;
  documentTitle: string;
  revision: string;
  issuePurpose: string;
  securityClassification: string;
  documentType: string;
  disciplineCode: string;
  contractNumber: string;
  supplierName: string;
  purchaseOrderNumber: string;
  documentDate: string;
  [key: string]: string | number;
}

export interface LoadSheetValidationResult {
  row: LoadSheetRow;
  errors: LoadSheetFieldError[];
  warnings: LoadSheetFieldError[];
  isValid: boolean;
}

export interface LoadSheetFieldError {
  field: string;
  message: string;
  value: string;
  rule: string;
}

export interface FileUploadResult {
  file: File;
  name: string;
  size: number;
  type: string;
  extractedText: string;
  status: 'pending' | 'extracted' | 'error';
  error?: string;
}

// ─── WORK QUEUE ─────────────────────────────────────────────────────────────

export type QueueItemStatus = 'pending' | 'claimed' | 'in_review' | 'completed' | 'rejected';
export type QueuePriority = 'high' | 'medium' | 'low';

export interface WorkQueueItem {
  id: string;
  submittalId: string;
  documentName: string;
  documentNumber: string;
  contractor: string;
  contract: string;
  discipline: string;
  documentType: string;
  issuePurpose: string;
  submittedDate: Date;
  targetDate: Date;
  status: QueueItemStatus;
  claimedBy: string | null;
  claimedAt: Date | null;
  priority: QueuePriority;
  documentCount: number;
  loadSheetRef: string;
  project: string;
}

export interface WorkQueueFilter {
  project?: string;
  discipline?: string;
  contractor?: string;
  status?: QueueItemStatus;
  claimedBy?: string;
  priority?: QueuePriority;
}

// ─── REJECTION WORKFLOW ─────────────────────────────────────────────────────

export type RejectionCategory =
  | 'metadata_missing'
  | 'metadata_incorrect'
  | 'naming_convention'
  | 'quality_issue'
  | 'wrong_contract'
  | 'revision_conflict'
  | 'incomplete_submittal'
  | 'other';

export interface RejectionReason {
  category: RejectionCategory;
  code: string;
  label: string;
  template: string;
}

export interface RejectionRecord {
  id: string;
  documentName: string;
  documentNumber: string;
  contractor: string;
  contractorEmail: string;
  rejectedBy: string;
  rejectedAt: Date;
  reasons: RejectionReason[];
  customMessage: string;
  emailBody: string;
  notificationSent: boolean;
  resubmissionReceived: boolean;
}

export const REJECTION_REASONS: RejectionReason[] = [
  { category: 'metadata_missing', code: 'RJ-M01', label: 'Missing Contract Number', template: 'The submitted document is missing the Contract Number field. Please ensure this mandatory field is populated per VGL-DC-NCP-001.' },
  { category: 'metadata_missing', code: 'RJ-M02', label: 'Missing Revision Number', template: 'The submitted document is missing the Revision Number. All documents must include a valid revision identifier.' },
  { category: 'metadata_missing', code: 'RJ-M03', label: 'Missing Issue Purpose', template: 'The Issue Purpose (Reason for Issue) field is not populated. Please specify the correct issue purpose code (IFR, IFC, AFC, etc.).' },
  { category: 'metadata_missing', code: 'RJ-M04', label: 'Missing Security Classification', template: 'The Security Classification is missing. All documents require a valid classification (Company Use, Confidential, Restricted, or Public).' },
  { category: 'metadata_missing', code: 'RJ-M05', label: 'Missing Document Date', template: 'The Document Date / Issue Date is not populated. Please include the correct date of issue.' },
  { category: 'metadata_incorrect', code: 'RJ-I01', label: 'Document Number Mismatch', template: 'The Document Number in the load sheet does not match the document number within the file. Please correct and resubmit.' },
  { category: 'metadata_incorrect', code: 'RJ-I02', label: 'Incorrect Revision Sequence', template: 'The revision sequence is incorrect. Prior revisions must be present in the system before issuing subsequent revisions.' },
  { category: 'metadata_incorrect', code: 'RJ-I03', label: 'Issue Purpose / Revision Misalignment', template: 'The Issue Purpose does not align with the Revision number (e.g., Rev 0 cannot be AFC). Please verify and correct.' },
  { category: 'naming_convention', code: 'RJ-N01', label: 'Invalid File Name', template: 'The file name does not comply with the VGL naming convention [PROJ]-[CNTR]-[TYPE]-[DISC]-[SEQ]. Please rename and resubmit.' },
  { category: 'naming_convention', code: 'RJ-N02', label: 'Special Characters in File Name', template: 'The file name contains prohibited special characters. Please remove all special characters (~, /, @, &, %, !, etc.) and resubmit.' },
  { category: 'naming_convention', code: 'RJ-N03', label: 'Spaces in Document Number', template: 'The Document Number contains spaces. Please remove all spaces from the document number field.' },
  { category: 'quality_issue', code: 'RJ-Q01', label: 'Document Not OCR Searchable', template: 'The submitted document is not text-searchable (OCR). All PDF documents must be OCR-processed before submission.' },
  { category: 'quality_issue', code: 'RJ-Q02', label: 'Blank Pages Detected', template: 'The document contains blank pages. Please remove all blank pages and resubmit.' },
  { category: 'quality_issue', code: 'RJ-Q03', label: 'Draft Watermark Present', template: 'The document contains a DRAFT watermark or "NOT FOR CONSTRUCTION" marker. Please submit the finalised version.' },
  { category: 'quality_issue', code: 'RJ-Q04', label: 'Markup / Annotations Present', template: 'The document contains review markups or annotations. Please submit a clean version without markup artifacts.' },
  { category: 'quality_issue', code: 'RJ-Q05', label: 'Incorrect Page Orientation', template: 'The document has incorrect page orientation. Please correct and resubmit.' },
  { category: 'wrong_contract', code: 'RJ-C01', label: 'Wrong Contract Submission', template: 'The document appears to be submitted under the wrong contract. Please verify the contract reference and resubmit to the correct contract.' },
  { category: 'revision_conflict', code: 'RJ-R01', label: 'Prior Revision Under Review', template: 'A prior revision of this document is currently under review. Please wait for that review to complete before submitting a new revision.' },
  { category: 'revision_conflict', code: 'RJ-R02', label: 'Missing Prior Revision', template: 'The prior revision of this document is not present in the system. All preceding revisions must exist before a new revision can be accepted.' },
  { category: 'incomplete_submittal', code: 'RJ-S01', label: 'Mixed Disciplines in Batch', template: 'The submittal batch contains documents from multiple disciplines. Please separate by discipline and resubmit.' },
  { category: 'incomplete_submittal', code: 'RJ-S02', label: 'Mixed Issue Purposes in Batch', template: 'The submittal batch contains documents with different issue purposes. Please group by issue purpose and resubmit.' },
  { category: 'incomplete_submittal', code: 'RJ-S03', label: 'Incomplete Revision History', template: 'The revision history section is missing or incomplete. All documents beyond Rev 0 must include a complete revision history.' },
  { category: 'other', code: 'RJ-O01', label: 'Other (Custom Reason)', template: '' },
];

// ─── DISTRIBUTION MATRIX ────────────────────────────────────────────────────

export interface DistributionRecipient {
  name: string;
  email: string;
  organisation: string;
  role: string;
}

export interface DistributionRule {
  id: string;
  project: string;
  discipline: string;
  documentType: string;
  issuePurpose: string;
  recipients: DistributionRecipient[];
}

// ─── SDx API ────────────────────────────────────────────────────────────────

export interface SdxSubmittal {
  id: string;
  correspondenceNo: string;
  fromOrg: string;
  fromRole: string;
  contract: string;
  discipline: string;
  submittalType: string;
  reasonForIssue: string;
  issueState: string;
  creationDate: Date;
  targetDate: Date;
  documentCount: number;
  documents: SdxDocument[];
}

export interface SdxDocument {
  id: string;
  documentNumber: string;
  title: string;
  revision: string;
  status: 'submitted' | 'current' | 'superseded' | 'rejected';
  securityClass: string;
  fileType: string;
  fileName: string;
}

export interface SdxTransmittalRequest {
  transmittal: TransmittalPayload;
  documents: string[];
  recipients: DistributionRecipient[];
}

export interface SdxRevisionHistory {
  documentNumber: string;
  revisions: {
    revision: string;
    status: string;
    dateIssued: string;
    issuePurpose: string;
  }[];
}

// ─── NOTIFICATION ───────────────────────────────────────────────────────────

export interface NotificationRecord {
  id: string;
  type: 'rejection' | 'transmittal' | 'status_update';
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  sentAt: Date;
  status: 'sent' | 'failed' | 'pending';
  relatedDocumentId: string;
}
