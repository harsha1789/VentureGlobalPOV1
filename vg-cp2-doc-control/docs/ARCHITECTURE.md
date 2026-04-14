# System Architecture

## Overview

The VG CP2 LNG Document Control Automation system is an Angular 17 SPA that simulates and will eventually drive the HxGN SDx intake pipeline. It is designed to be replaced incrementally — the simulation layer (client-side validation) is swapped for real service calls as each integration is confirmed.

---

## Component Architecture

```
AppComponent (router-outlet)
├── LoginComponent          → /login
│   └── AuthService
└── DashboardComponent      → /dashboard (AuthGuard protected)
    ├── ScenarioPanelComponent
    │   └── ContractDataService
    ├── TerminalComponent
    │   └── PipelineService (terminalLog signal)
    └── AuditLogComponent
        └── PipelineService (auditLog signal)

Services (singleton, providedIn: 'root'):
├── AuthService           — login, logout, session, currentUser signal
├── ValidationService     — Tier 1 + Tier 2 pure functions, no state
├── PipelineService       — orchestration, signals for UI state
└── ContractDataService   — test data, scenario definitions
```

---

## State Management

Angular Signals are used throughout. No external state library.

```typescript
// PipelineService signals consumed by components
auditLog    = signal<AuditRecord[]>([]);
terminalLog = signal<TerminalLog[]>([]);
stats       = signal<SessionStats>({ total: 0, pass: 0, fail: 0, review: 0 });
isRunning   = signal(false);

// AuthService
currentUser = signal<User | null>(null);
```

Components read signals directly via `()` syntax in templates:
```html
{{ pipeline.stats().total }}
{{ auth.currentUser()?.displayName }}
```

---

## Validation Engine

### Tier 1 — Metadata (ValidationService.extractMetadata)

15 field checks. All deterministic — regex and string matching only.

| Field | Method | Pass Condition |
|---|---|---|
| Contract Number | Multi-pattern regex | Matches [PROJ]-[CNTR]-[TYPE]-[SEQ], no special chars |
| Document Title | Keyword regex | Present and length > 8 chars |
| Revision Number | Regex enum | Rev A, Rev B, R01, 01, A, B formats |
| Issue Purpose | Enum check | IFU, IFI, IFC, IFR, IFT, AFC, AFD, IFA, PUR |
| Security Classification | Keyword match | Company Use, Confidential, Restricted, Public |
| Document Type | Enum check | SOW, MDR, SDR, DWG, SPE, CAL, REP, PRO, MOM, ITP, REQ |
| Discipline Code | Enum check | CMS, CIV, CME, ELE, INS, MEC, PIP, STR, PRO, HSE, QA |
| Document Date | Date pattern regex | Recognises dd-Mon-yyyy, dd/mm/yyyy, dd Month yyyy |
| Contractor / Org | Keyword + regex | Known contractor names or FROM ORGANISATION field |
| Project Reference | Keyword regex | CP2, VG CP2, Contract Reference |
| File Naming Convention | Regex | [PROJ]-[CNTR]-[TYPE]-[SEQ] pattern |
| Doc Number Matches File | String compare | Strip extension, compare to document number |
| Second Cover Page | Keyword scan | SECOND COVER PAGE, SDx Project Area, DC Information |
| Supplier Name | Null check | SUPPLIER NAME field populated |
| Purchase Order Number | Conditional null | PO NUMBER field populated for supplier docs |

### Tier 2 — Quality (ValidationService.runQualityChecks)

12 structural and content checks.

| Check | Method | Tool (production) |
|---|---|---|
| OCR / Text Searchability | Word count > 50 | PyMuPDF page.get_text() |
| Blank Page Detection | Word/page-marker ratio | PyMuPDF content density |
| Page Orientation | Non-ASCII character ratio | Azure Document Intelligence |
| Language Compliance | Non-English keyword frequency | langdetect library |
| English Translation | Section header scan | langdetect + section scan |
| No Draft Watermarks | DRAFT keyword pattern | PyMuPDF text + annotation scan |
| No Markups/Annotations | Annotation object pattern | PyMuPDF page.annots() |
| Document Structure | Section + signature pattern | python-docx structural parse |
| Metadata on Each Page | Footer/header scan | PyMuPDF per-page extraction |
| Second Cover Page | Keyword scan | Pattern matching |
| Revision/Issue Purpose Alignment | Rule table | Rule engine (Rev 0 ≠ AFC) |
| File Completeness | EOF marker | End-of-file pattern |

### Tier 3 — Transmittal Builder (ValidationService.buildTransmittal)

Constructs the full transmittal payload from extracted Tier 1 fields plus fixed project config. In production this calls the SDx REST API.

### Tier 4 — Decision Engine (ValidationService.determineDecision)

```typescript
if (totalFail === 0 && totalWarn <= 2) return 'accept';  // straight-through
if (totalFail === 0)                   return 'review';  // human queue
return 'reject';                                          // auto-reject
```

---

## Routing

| Route | Component | Guard |
|---|---|---|
| / | → /login | — |
| /login | LoginComponent | — |
| /dashboard | DashboardComponent | AuthGuard |
| /** | → /login | — |

AuthGuard checks `AuthService.isAuthenticated()` which reads the currentUser signal. Session is persisted to `sessionStorage` — cleared on logout.

---

## Production Integration Points

These are the four integration points that convert the demo into a live system:

**1. AuthService.login()**
Replace the hardcoded USERS object with an Azure AD B2C or VGL SSO call.

**2. ValidationService (Tier 1 + Tier 2)**
Replace regex extraction with Azure Document Intelligence API calls for arbitrary-layout documents. Keep regex as fallback for text-layer PDFs.

**3. PipelineService.runDocument() — Tier 3**
Replace `buildTransmittal()` mock with SDx REST API POST to create incoming transmittal.

**4. PipelineService.runDocument() — Tier 4**
Replace local decision with SDx REST API calls: approve submittal → issue transmittal → notify contractor.

---

## File Format Support

| Format | Current | Production |
|---|---|---|
| TXT | ✅ Full | ✅ Full |
| PDF (text layer) | ✅ Text extraction | ✅ PyMuPDF |
| PDF (scanned/image) | ⚠ No text | ✅ Azure Document Intelligence OCR |
| DOCX | ⚠ Partial (text via FileReader) | ✅ python-docx |
| XLSX (loadsheet) | ⚠ Partial | ✅ openpyxl |
| DWG (native drawing) | ❌ Not supported | ⚠ Presence check only (no content extraction) |

---
