# VG CP2 Document Control - Validation Service Documentation

## Overview

The **Validation Service** (`src/app/services/validation.service.ts`) is the core engine of the VG CP2 Document Control Automation System. It performs **51 automated checks** across **8 tiers** to validate contractor-submitted documents before they are accepted into the SDx document management system.

The service is orchestrated by the **Pipeline Service** (`src/app/services/pipeline.service.ts`), which runs each tier sequentially, logs progress to the terminal, and records results in the audit log.

All TypeScript interfaces and constants are defined in **`src/app/models/index.ts`**.

---

## Pipeline Flow Diagram

```
Document Submitted
        |
        v
  +-----------+     +-----------+     +-----------+     +-----------+
  |   T0      |     |   T1      |     |   T2      |     |   T2S     |
  | Pre-flight| --> | Metadata  | --> | Quality   | --> | Submittal |
  | (BEGIN)   |     | +Contract |     | Checks    |     | Checks    |
  +-----------+     +-----------+     +-----------+     +-----------+
                                                              |
        +-----------------------------------------------------+
        |
        v
  +-----------+     +-----------+     +-----------+     +-----------+
  |   T3      |     |   T3V     |     |   T4      |     |   T5      |
  | Transmittal| --> | Transmittal| --> | Decision | --> | Final Gate|
  | Builder   |     | Validation|     | Engine    |     |   (END)   |
  +-----------+     +-----------+     +-----------+     +-----------+
                                            |
                                            v
                                   ACCEPT / REVIEW / REJECT
```

---

## Tier-by-Tier Breakdown

---

### TIER 0 - Pre-Flight Checks (BEGINNING)

**Method:** `runPreFlightChecks(text, filename)`
**Purpose:** Gate-check before any processing begins. Validates that the file itself is suitable for the pipeline.
**Location:** `validation.service.ts` lines 15-71

| # | Check | What It Does | Pass | Fail | Warn |
|---|-------|-------------|------|------|------|
| 1 | **File Type Validation** | Checks file extension against accepted types: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.dwg`, `.txt` | Extension is accepted | Extension not recognised or missing | - |
| 2 | **File Not Empty** | Verifies the document has content (character count > 0) | Content >= 20 chars | Empty file (0 chars) | Content between 1-19 chars |
| 3 | **Filename Validity** | Checks filename for leading/trailing spaces and double spaces | Clean filename | Empty filename | Has extra spaces |
| 4 | **Filename Special Characters** | Scans filename for prohibited characters: `~ / \ @ & % ! # $ ^ * ( ) + = { } [ ] | < > ?` | No special chars | Special chars detected | - |
| 5 | **Project Prefix Present** | Verifies filename starts with a recognised project prefix (`C2`, `CP2`, or `VG`) | Prefix found | - | No prefix found |

**How it works:**
```typescript
// Example: Checking for special characters
const hasSpecialChars = SPECIAL_CHAR_PATTERN.test(filename.replace(/\.[^.]+$/, ''));
// SPECIAL_CHAR_PATTERN = /[~\/\\@&%!#$^*()+={}\[\]|<>?]/
```

**Decision impact:** Pre-flight failures are **hard stops** - any T0 failure automatically results in a `REJECT` decision regardless of other tiers.

---

### TIER 1 - Metadata Extraction & Contract Validation

**Method:** `extractMetadata(text, filename)`
**Purpose:** Extracts 15 metadata fields from the document text using regex patterns and validates each field. Also includes 2 contract-specific checks.
**Location:** `validation.service.ts` lines 75-304

#### Metadata Fields (15 checks)

| # | Field | Extraction Method | Pass Condition | Fail Condition |
|---|-------|-------------------|----------------|----------------|
| 1 | **Contract Number** | Multi-pattern regex: `CONTRACT NUMBER:`, `Doc No:`, or pattern `[A-Z]-[A-Z0-9]-[A-Z]` | Matches `[PROJ]-[CNTR]-[TYPE]` pattern, no special chars | Not found or has special characters |
| 2 | **Document Title** | Keywords: `DOCUMENT TITLE:`, `TITLE:`, `Subject:` | Present and length > 8 characters | Not found |
| 3 | **Revision Number** | Keywords: `REVISION NUMBER:`, `Rev`, `R01` format | Valid format: `Rev A`, `R01`, `01` etc. | Not found |
| 4 | **Issue Purpose** | Keywords: `ISSUE PURPOSE:`, or code match `IFU/IFI/IFC/IFR/IFT/AFC/AFD/IFA/PUR` | Valid issue purpose code found | Not found |
| 5 | **Security Classification** | Keywords: `SECURITY CLASSIFICATION:`, or value match | One of: `Company Use`, `Confidential`, `Restricted`, `Public` | Not found |
| 6 | **Document Type** | Keywords: `DOCUMENT TYPE:`, or code match | One of: `SOW`, `MDR`, `SDR`, `DWG`, `SPE`, `CAL`, `REP`, `PRO`, `MOM`, `ITP`, `PID`, `SLD`, `GA`, `FAT`, `HAZ`, `REQ` | Not found |
| 7 | **Discipline Code** | Keywords: `DISCIPLINE CODE:`, or code match | One of: `CMS`, `CIV`, `CME`, `ELE`, `INS`, `MEC`, `PIP`, `STR`, `PRO`, `HSE`, `QA`, `PUR` | Not found |
| 8 | **Document Date** | Date format patterns: `dd-Mon-yyyy`, `dd/mm/yyyy` | Date extracted | Not found (warn) |
| 9 | **Contractor / Organisation** | Keywords: `FROM ORGANISATION:`, `Contractor:`, or known names (Worley, AECOM, Bechtel, etc.) | Organisation identified | Not found (warn) |
| 10 | **Project Reference** | Keywords: `PROJECT NAME:`, or known refs (`CP2`, `VG CP2`, etc.) | Project reference found | Not found (warn) |
| 11 | **File Naming Convention** | Regex: `^[A-Z0-9]{1,6}-[A-Z]{2,5}-[A-Z]{2,4}[-_]` | Follows `[PROJ]-[CNTR]-[TYPE]` pattern | Special characters in filename |
| 12 | **Doc Number Matches File Name** | Strips extension, case-insensitive comparison of doc number vs filename | Match confirmed | Mismatch detected |
| 13 | **Second Cover Page** | Keywords: `SECOND COVER`, `DOCUMENT CONTROL INFORMATION`, `SDx Project Area` | DC info block found | Not found (warn) |
| 14 | **Supplier Name** | Keywords: `SUPPLIER NAME:`, `Vendor:`, `Manufacturer:` | Populated | Not found (warn) |
| 15 | **Purchase Order Number** | Keywords: `PURCHASE ORDER NUMBER:`, `PO NUMBER:`, or pattern `PO-NNNNN` | PO number found | Not found (warn) |

#### Contract-Specific Checks (2 checks)

| # | Field | What It Does | Pass | Fail |
|---|-------|-------------|------|------|
| 16 | **Contract Reference Validation** | Validates document number starts with `C2-` or recognised project prefix | Starts with `C2-`, `CP2`, or `VG` | Not found |
| 17 | **Correct Contract Submission** | Cross-checks project reference against CP2 project | Project matches `CP2`, `VG CP2`, `Calcasieu Pass 2`, or `C2` | Project reference doesn't match CP2 |

**How extraction works:**
```typescript
// The extract() helper tries multiple regex patterns in order,
// returns the first match found:
private extract(text: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return (match[1] || match[0]).trim();
    }
    return null;
}
```

---

### TIER 2 - Document Quality Checks

**Method:** `runQualityChecks(text)`
**Purpose:** Validates the structural quality and content integrity of the document.
**Location:** `validation.service.ts` lines 309-402

| # | Check | Detection Method | Pass | Fail | Warn |
|---|-------|-----------------|------|------|------|
| 1 | **OCR / Text Searchability** | Character count > 80 | Text is readable and extractable | No text content (image-only or empty) | - |
| 2 | **Blank Page Detection** | Word count / page-marker ratio < 15 | Content density adequate | - | Low word density suggests blank pages |
| 3 | **Page Orientation** | Non-ASCII character ratio > 10% of total chars | No anomalies | - | Encoding or orientation issues |
| 4 | **Language Compliance** | Count of non-English common words (de, la, le, el, etc.) > 5 | English throughout | - | Non-English words detected |
| 5 | **English Translation Present** | If non-English content found, checks for "english translation" header | English confirmed or translation present | Non-English content without translation | - |
| 6 | **No Draft Watermarks** | Keyword scan: `DRAFT`, `FOR REVIEW ONLY`, `NOT FOR CONSTRUCTION`, `PRELIMINARY` | No draft indicators | Draft marker detected | - |
| 7 | **No Markups or Annotations** | Pattern scan: `[COMMENT]`, `[MARKUP]`, `<annotation`, `/Annots` | No markup artifacts | Annotation indicators detected | - |
| 8 | **Document Structure** | Checks for numbered sections, signature blocks, revision history, footer | Sections AND signatures present | Neither found | Only one found |
| 9 | **Metadata on Each Page** | Checks for footer (VGL/security class) AND signature blocks | Both present | - | Missing on some pages |
| 10 | **Contractor Second Cover Page** | Keywords: `SECOND COVER`, `DOCUMENT CONTROL INFORMATION`, `SDx Project Area` | DC info block present | - | Not detected |
| 11 | **Revision & Issue Purpose Alignment** | Rule engine (see below) | Revision and issue purpose aligned | Rev 0 + AFC combination | Cannot verify |
| 12 | **File Completeness** | Pattern: `END OF DOCUMENT` or `=====` at end of file | Clean termination marker | - | No end marker |

**Revision & Issue Purpose Alignment Rule:**
```
Rev 0 + AFC = FAIL  (cannot approve without review cycle)
Rev 0 + other      = PASS
Missing either     = WARN
All other combos   = PASS
```

---

### TIER 2S - Submittal Checks

**Method:** `runSubmittalChecks(text, metadata, batchDocuments?)`
**Purpose:** Validates submittal-level requirements including revision history, prior revision status, and batch consistency.
**Location:** `validation.service.ts` lines 406-483

| # | Check | What It Does | Pass | Fail | Warn |
|---|-------|-------------|------|------|------|
| 1 | **Prior Revision Availability** | For Rev 1+, checks if document references a prior/superseded revision | Rev 0 (no prior expected) or prior ref found | - | Rev 1+ with no prior revision reference |
| 2 | **Prior Revisions Not Under Review** | Scans for "Under Review", "Pending Review", "In Review" keywords | No review conflicts | - | References revision still under review |
| 3 | **Revision History Completeness** | Checks for presence of revision history section (required for Rev 1+) | Rev history present, or Rev 0 | Rev 1+ with no revision history section | - |
| 4 | **No Mixed Disciplines in Batch** | For bulk submittals: groups all docs by discipline, checks uniqueness | Single doc or all same discipline | - | Multiple disciplines in batch |
| 5 | **No Mixed Issue Purpose in Batch** | For bulk submittals: groups all docs by issue purpose, checks uniqueness | Single doc or all same purpose | - | Multiple issue purposes in batch |
| 6 | **Submittal Package Completeness** | Verifies discipline, issue purpose, AND document type are all populated | All three fields present | Any field missing | - |

**Batch consistency logic (loadsheet checks 4 & 5):**
```typescript
// For each document in the batch, extract metadata and collect unique values
const disciplines = new Set<string>();
const purposes = new Set<string>();
for (const doc of batchDocuments) {
    const dMeta = this.extractMetadata(doc.text, doc.name);
    // ... collect discipline and issue purpose
}
mixedDiscipline = disciplines.size > 1;   // Multiple = warn
mixedIssuePurpose = purposes.size > 1;    // Multiple = warn
```

---

### TIER 3 - Transmittal Builder

**Method:** `buildTransmittal(metadata, filename)`
**Purpose:** Constructs a transmittal payload from extracted metadata, ready for SDx submission.
**Location:** `validation.service.ts` lines 487-509

This tier does not perform validation checks - it assembles data. The transmittal payload contains:

| Field | Source |
|-------|--------|
| `trnNumber` | Auto-generated: `TRN-C2-WOR-XXXX` (random 4-digit suffix) |
| `fromOrg` | From T1 `Contractor / Organisation` field |
| `contract` | Fixed: `C2 EPC-BOP` |
| `toOrg` | Fixed: `VGL - Venture Global` |
| `fromRole` | Fixed: `Contractor Document Control` |
| `title` | From T1 `Document Title` field |
| `documentType` | From T1 `Document Type` field |
| `discipline` | From T1 `Discipline Code` field |
| `revision` | From T1 `Revision Number` field |
| `reasonForIssue` | From T1 `Issue Purpose` field |
| `securityClass` | From T1 `Security Classification` field |
| `issueState` | Fixed: `Submitted` |
| `dateIssued` | Current date in `dd Mon yyyy` format |

---

### TIER 3V - Transmittal Validation

**Method:** `validateTransmittal(transmittal)`
**Purpose:** Validates the transmittal payload built in T3 to ensure it is complete and correctly formatted before SDx submission.
**Location:** `validation.service.ts` lines 513-576

| # | Check | What It Does | Pass | Fail | Warn |
|---|-------|-------------|------|------|------|
| 1 | **TRN Number Format** | Validates format matches `TRN-C2-XXX-NNNN` | Correct format | Invalid format | - |
| 2 | **Transmittal From/To Organisations** | Both from and to organisations must be populated (not `--`) | Both populated | Either missing | - |
| 3 | **Transmittal Document Type Valid** | Document type must be a recognised VGL type code | Valid type code | - | Missing or unrecognised |
| 4 | **Transmittal Discipline Valid** | Discipline must be a recognised VGL discipline code | Valid discipline | - | Missing or unrecognised |
| 5 | **Transmittal Reason for Issue** | Reason for issue must be a valid issue purpose code | Valid code | Missing or invalid | - |
| 6 | **Transmittal Completeness** | Counts how many of 9 required fields are populated | 9/9 populated | < 6/9 populated | 6-8/9 populated |

---

### TIER 4 - Decision Engine

**Methods:** `calculateScore(...)` and `determineDecision(score)`
**Purpose:** Aggregates all check results into a score and makes an automated accept/review/reject decision.
**Location:** `validation.service.ts` lines 580-629

#### Score Calculation

The score is calculated as a percentage:
```
Overall Score = (Total Pass / Total Checks) * 100
```

Where `Total Checks = Pass + Fail + Warn` across ALL tiers (T0, T1, T2, T2S, T3V, T5).

#### Decision Logic

```typescript
determineDecision(score: ValidationScore): Decision {
    const totalFail = preFlightFail + metaFail + qualFail + submittalFail + transmittalFail;
    const totalWarn = preFlightWarn + metaWarn + qualWarn + submittalWarn + transmittalWarn;

    if (preFlightFail > 0)                  return 'reject';   // Hard stop
    if (totalFail === 0 && totalWarn <= 3)   return 'accept';   // Straight-through
    if (totalFail === 0)                     return 'review';   // Human review queue
    return 'reject';                                            // Auto-reject
}
```

| Decision | Condition | What Happens |
|----------|-----------|-------------|
| **ACCEPT** | 0 failures AND 3 or fewer warnings | Automatic straight-through processing to SDx |
| **REVIEW** | 0 failures BUT more than 3 warnings | Queued for human document controller review |
| **REJECT** | Any failures OR pre-flight failures | Rejected with structured failure details; must be resubmitted |

---

### TIER 5 - Final Gate Checks (END)

**Method:** `runFinalGateChecks(preFlight, metadata, quality, submittal, transmittalVal, decision)`
**Purpose:** End-of-pipeline compliance gate. Summarises results across all tiers and determines readiness for SDx upload.
**Location:** `validation.service.ts` lines 633-700

| # | Check | What It Does | Pass | Fail | Warn |
|---|-------|-------------|------|------|------|
| 1 | **All Pipeline Stages Completed** | Verifies no failures exist in any tier: Pre-flight, Metadata, Quality, Submittal, Transmittal | All stages failure-free | Any stage has failures | - |
| 2 | **Compliance Score** | Overall compliance percentage across all checks | >= 85% | < 60% | 60-84% |
| 3 | **SDx Upload Readiness** | Maps decision to upload eligibility | Decision = ACCEPT | Decision = REJECT | Decision = REVIEW |
| 4 | **No Critical Failures Remaining** | Counts total failures across all tiers | 0 failures | Any failures remain | - |
| 5 | **Audit Trail Complete** | Confirms all validation results are captured with timestamps | Always pass | - | - |

---

## Pipeline Orchestration

The **Pipeline Service** (`pipeline.service.ts`) runs each tier sequentially:

```
T0 (80-140ms) --> T1 (180-300ms) --> T2 (150-250ms) --> T2S (100-180ms)
    --> T3 (100-180ms) --> T3V (80-140ms) --> T4 (100-180ms) --> T5 (60-100ms)
```

For each tier, the pipeline:
1. Logs a start message to the terminal
2. Adds a simulated processing delay
3. Calls the validation method
4. Counts pass/fail/warn results
5. Logs a summary with colour-coded status

After all tiers complete, the pipeline:
- Creates an `AuditRecord` with all results, check counts, and decision
- Updates session statistics (total/pass/fail/review)
- Returns the complete `PipelineResult`

### Bulk Processing

When processing multiple documents (`runBulk`), the pipeline:
- Processes each document sequentially with 200ms pre-delay and 300ms post-delay
- Passes the full batch array so T2S can perform batch consistency checks (mixed disciplines/issue purposes)

---

## 14 Document QA Checks - Traceability Matrix

These are the 14 QA checks required by the VG document control process:

| # | QA Check | Tier | Method | Line |
|---|----------|------|--------|------|
| 1 | Document Number | T1 | `extractMetadata()` - Contract Number field | 157 |
| 2 | Document Title | T1 | `extractMetadata()` - Document Title field | 169 |
| 3 | Document Revision | T1 | `extractMetadata()` - Revision Number field | 176 |
| 4 | Security Classification | T1 | `extractMetadata()` - Security Classification field | 194 |
| 5 | Reason for Issue | T1 | `extractMetadata()` - Issue Purpose field | 185 |
| 6 | Prior revision availability and match | T2S | `runSubmittalChecks()` - Prior Revision Availability | 435 |
| 7 | Revision history is complete | T2S | `runSubmittalChecks()` - Revision History Completeness | 451 |
| 8 | Document metadata on each page | T2 | `runQualityChecks()` - Metadata on Each Page | 378 |
| 9 | Text searchability (OCR) | T2 | `runQualityChecks()` - OCR / Text Searchability | 330 |
| 10 | Page orientation | T2 | `runQualityChecks()` - Page Orientation | 342 |
| 11 | Check for prior revisions still under review | T2S | `runSubmittalChecks()` - Prior Revisions Not Under Review | 443 |
| 12 | Confirm no markups are present on document | T2 | `runQualityChecks()` - No Markups or Annotations | 366 |
| 13 | Confirm documents submitted under the correct contract | T1 | `extractMetadata()` - Correct Contract Submission | 294 |
| 14 | Check revision and issue purpose alignment | T2 | `runQualityChecks()` - Revision & Issue Purpose Alignment | 390 |

---

## 8 Loadsheet QA Checks - Traceability Matrix

These are the 8 loadsheet QA checks from the VG process:

| # | Loadsheet Check | Tier | Method | Line |
|---|----------------|------|--------|------|
| 1 | Special characters in document number | T1 | `extractMetadata()` - Contract Number (special char check) | 157 |
| 2 | Special characters in file name | T0/T1 | `runPreFlightChecks()` - Filename Special Characters / `extractMetadata()` - File Naming Convention | 55 / 242 |
| 3 | Document number matches file name | T1 | `extractMetadata()` - Doc Number Matches File Name | 251 |
| 4 | No mixed disciplines | T2S | `runSubmittalChecks()` - No Mixed Disciplines in Batch | 459 |
| 5 | No mixed issue purpose | T2S | `runSubmittalChecks()` - No Mixed Issue Purpose in Batch | 467 |
| 6 | Correct security classification | T1 | `extractMetadata()` - Security Classification | 194 |
| 7 | Supplier name populated | T1 | `extractMetadata()` - Supplier Name | 267 |
| 8 | PO number populated | T1 | `extractMetadata()` - Purchase Order Number | 274 |

---

## Data Types & Interfaces

All defined in `src/app/models/index.ts`:

| Interface | Purpose | Used By |
|-----------|---------|---------|
| `PreFlightCheck` | T0 check result (check, detail, status, tier) | `runPreFlightChecks()` |
| `MetadataCheck` | T1 field result (field, extracted, status, note, tier) | `extractMetadata()` |
| `QualityCheck` | T2 check result (check, detail, status, method) | `runQualityChecks()` |
| `SubmittalCheck` | T2S check result (check, detail, status, tier) | `runSubmittalChecks()` |
| `TransmittalPayload` | T3 built payload (13 fields) | `buildTransmittal()` |
| `TransmittalValidation` | T3V check result (check, detail, status, tier) | `validateTransmittal()` |
| `FinalGateCheck` | T5 check result (check, detail, status, tier) | `runFinalGateChecks()` |
| `ValidationScore` | Aggregated pass/fail/warn counts per tier + overall % | `calculateScore()` |
| `PipelineResult` | Complete pipeline output (all tier results + decision) | `runDocument()` |
| `AuditRecord` | Audit log entry with decision, score, timestamps | Pipeline audit log |

### Check Status Values

| Status | Meaning | Colour |
|--------|---------|--------|
| `pass` | Check passed successfully | Green |
| `fail` | Critical failure - must be resolved | Red |
| `warn` | Warning - may need human review | Orange/Amber |

### Decision Values

| Decision | Meaning |
|----------|---------|
| `accept` | Automatic straight-through to SDx |
| `review` | Queued for human document controller |
| `reject` | Rejected - resubmission required |

---

## Valid Constants

```typescript
VALID_ISSUE_PURPOSES  = ['IFU', 'IFI', 'IFC', 'IFR', 'IFT', 'AFC', 'AFD', 'IFA', 'PUR']
VALID_SECURITY_CLASSES = ['Company Use', 'Confidential', 'Restricted', 'Public']
VALID_DOC_TYPES       = ['SOW', 'MDR', 'SDR', 'DWG', 'SPE', 'CAL', 'REP', 'PRO', 'MOM',
                          'ITP', 'PID', 'SLD', 'GA', 'FAT', 'HAZ', 'REQ']
VALID_DISCIPLINES     = ['CMS', 'CIV', 'CME', 'ELE', 'INS', 'MEC', 'PIP', 'STR',
                          'PRO', 'HSE', 'QA', 'PUR']
SPECIAL_CHAR_PATTERN  = /[~\/\\@&%!#$^*()+={}\[\]|<>?]/
```

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total tiers | 8 (T0, T1, T2, T2S, T3, T3V, T4, T5) |
| Total automated checks | 51 |
| Pre-flight checks (T0) | 5 |
| Metadata + Contract checks (T1) | 17 |
| Quality checks (T2) | 12 |
| Submittal checks (T2S) | 6 |
| Transmittal validation checks (T3V) | 6 |
| Final gate checks (T5) | 5 |
| VG Document QA checks covered | 14/14 |
| VG Loadsheet QA checks covered | 8/8 |
