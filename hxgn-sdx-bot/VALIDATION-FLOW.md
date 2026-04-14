# Document Control Validation Flow — Technical Specification

## Overview

This document describes the complete validation pipeline that runs against every contractor submittal in the VG CP2 LNG document control system. The flow is divided into 6 stages, executed sequentially. A document must pass each stage to proceed to the next.

---

## Flow Diagram

```
 CONTRACTOR SUBMITS DOCUMENT
            │
            ▼
┌───────────────────────────────────────┐
│  STAGE 1: INTAKE & CLAIM              │
│                                       │
│  Document appears in SDx work queue   │
│  with status "Review Submittal"       │
│                                       │
│  Bot claims document                  │
│  Status → "In Review"                 │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  STAGE 2: SUBMITTAL DETAIL VALIDATION │
│                                       │
│  ┌─ Check 1: Document Number present  │
│  ├─ Check 2: Revision populated       │
│  ├─ Check 3: File Type = PDF          │
│  ├─ Check 4: Originator populated     │
│  └─ Check 5: Submission Date present  │
│                                       │
│  Source: SDx submittal detail screen   │
│  Method: Read UI fields, assert       │
│          non-empty and valid           │
│                                       │
│  FAIL → Log + Screenshot + Next Doc   │
└───────────────┬───────────────────────┘
                │ PASS
                ▼
┌───────────────────────────────────────┐
│  STAGE 3: LOAD DATASHEET VALIDATION   │
│                                       │
│  ┌─ Check 1: Document Number valid    │
│  ├─ Check 2: Title populated          │
│  ├─ Check 3: Revision populated       │
│  ├─ Check 4: File Type populated      │
│  └─ Check 5: Discipline populated     │
│                                       │
│  Source: SDx load datasheet screen     │
│  Method: Read 5 fields from UI,       │
│          validate no empty values,     │
│          no leading/trailing spaces    │
│                                       │
│  FAIL → Log + Screenshot + Next Doc   │
└───────────────┬───────────────────────┘
                │ PASS
                ▼
┌───────────────────────────────────────────────────────────────────┐
│  STAGE 4: DOCUMENT QUALITY & INTEGRITY CHECKS                     │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  STEP 4A: BASIC INTEGRITY (from UI)                         │  │
│  │                                                              │  │
│  │  ┌─ Check 1: File format valid (PDF)                        │  │
│  │  ├─ Check 2: File not corrupted                             │  │
│  │  └─ Check 3: File size within limit (< 50 MB)              │  │
│  │                                                              │  │
│  │  Source: SDx document viewer screen                          │  │
│  │  Method: Server checks file metadata                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                         │ PASS                                     │
│                         ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  STEP 4B: PDF TEXT EXTRACTION (real)                        │  │
│  │                                                              │  │
│  │  Server reads actual PDF file from disk                      │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  pdf-parse (Mozilla PDF.js)                           │   │  │
│  │  │  ↓                                                    │   │  │
│  │  │  Reads PDF binary                                     │   │  │
│  │  │  Parses XRef table + page tree                        │   │  │
│  │  │  Extracts text operators (BT/ET blocks) per page      │   │  │
│  │  │  Joins all text into single string                    │   │  │
│  │  │  ↓                                                    │   │  │
│  │  │  Returns: { text, numpages, info }                    │   │  │
│  │  │                                                       │   │  │
│  │  │  If PDF has no text layer (image-only/scanned):       │   │  │
│  │  │  → Parser throws error                                │   │  │
│  │  │  → text = "" (empty)                                  │   │  │
│  │  │  → OCR check FAILS                                    │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  Post-processing:                                            │  │
│  │  - Rejoin hyphenated line breaks (e.g. "MEC-\nDWG" → "MEC-DWG") │
│  │  - Collapse multiple spaces to single space                  │  │
│  │  - Preserve newlines for multiline regex matching            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                         │                                          │
│                         ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  STEP 4C: DOCUMENT QUALITY CHECKS (12 checks)              │  │
│  │                                                              │  │
│  │  All checks run against the extracted text via regex:        │  │
│  │                                                              │  │
│  │  1. OCR / Text Searchability                                 │  │
│  │     Test: text.length > 80 characters                        │  │
│  │     Pass: "Readable text extracted — N words, N chars"       │  │
│  │     Fail: "No text content — image-only or scanned document" │  │
│  │                                                              │  │
│  │  2. No Draft Watermarks                                      │  │
│  │     Regex: /DRAFT|FOR REVIEW ONLY|NOT FOR CONSTRUCTION|      │  │
│  │            PRELIMINARY/i                                     │  │
│  │     Pass: No draft indicators found                          │  │
│  │     Fail: DRAFT or NOT FOR CONSTRUCTION marker detected      │  │
│  │                                                              │  │
│  │  3. No Markups or Annotations                                │  │
│  │     Regex: /\[COMMENT\]|\[MARKUP\]|<annotation|\/Annots/i   │  │
│  │     Pass: No markup artifacts found                          │  │
│  │     Fail: Annotation or markup indicators detected           │  │
│  │                                                              │  │
│  │  4. Page Orientation                                         │  │
│  │     Test: Count non-ASCII chars. If > 10% of total → garbled │  │
│  │     Pass: No orientation anomalies detected                  │  │
│  │     Fail: Non-ASCII ratio suggests encoding/orientation issue│  │
│  │                                                              │  │
│  │  5. Document Metadata on Each Page                           │  │
│  │     Test: Footer text (Company Use/VGL) AND signature block  │  │
│  │           (Prepared by/Reviewed by/Approved by) both present │  │
│  │     Pass: Document identity and security class present       │  │
│  │     Fail: Metadata may not appear on all pages               │  │
│  │                                                              │  │
│  │  6. Security Classification Present                          │  │
│  │     Regex: /SECURITY CLASSIFICATION/ present in text AND     │  │
│  │            one of: Company Use, Confidential, Restricted,    │  │
│  │            Public found anywhere in document                 │  │
│  │     Pass: Valid security classification found                │  │
│  │     Fail: Security classification missing or invalid         │  │
│  │                                                              │  │
│  │  7. Revision History Complete                                │  │
│  │     Regex: /REVISION HISTORY|Rev History|                    │  │
│  │            HISTORY OF REVISION/i                             │  │
│  │     Pass: Revision history section present                   │  │
│  │     Fail: Revision history missing                           │  │
│  │                                                              │  │
│  │  8. Document Structure                                       │  │
│  │     Test: Numbered sections (/^[0-9]+\.\s+[A-Z]/m) AND      │  │
│  │           Signature block (Prepared by/Reviewed by) present  │  │
│  │     Pass: Sections: Yes | Signatures: Yes                    │  │
│  │     Fail: Missing sections or signatures                     │  │
│  │                                                              │  │
│  │  9. Correct Contract Reference                               │  │
│  │     Test: /C2 EPC|CP2/i present AND                          │  │
│  │           /Cameron|Sabine|Plaquemines/i NOT present           │  │
│  │     Pass: C2 EPC-BOP contract reference confirmed            │  │
│  │     Fail: Wrong contract/project detected                    │  │
│  │                                                              │  │
│  │  10. Revision & Issue Purpose Alignment                      │  │
│  │      Extract: Revision (Rev X) and Issue Purpose (IFR/AFC/..)│  │
│  │      Rule: Rev 0 cannot be AFC (Approved for Construction)   │  │
│  │      Pass: Revision and issue purpose are aligned            │  │
│  │      Fail: Rev 0 cannot be AFC                               │  │
│  │                                                              │  │
│  │  11. File Completeness                                       │  │
│  │      Regex: /END OF DOCUMENT|={5,}$/i at end of text         │  │
│  │      Pass: Clean end-of-document marker found                │  │
│  │      Fail: No end marker — file may be truncated             │  │
│  │                                                              │  │
│  │  12. Second Cover Page                                       │  │
│  │      Regex: /SECOND COVER|DOCUMENT CONTROL INFORMATION|      │  │
│  │             SDx Project Area/i                               │  │
│  │      Pass: Document Control Information block present        │  │
│  │      Fail: Second cover page not detected                    │  │
│  │                                                              │  │
│  │  Source: API /api/document/:id                               │  │
│  │  Method: pdf-parse text extraction + regex pattern matching  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ANY QUALITY CHECK FAILS → Log + Screenshot + Skip to Next Doc    │
└───────────────────────┬───────────────────────────────────────────┘
                        │ ALL PASS
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│  STAGE 5: CROSS-VALIDATION                                        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  STEP 5A: METADATA EXTRACTION FROM PDF                      │  │
│  │                                                              │  │
│  │  Using regex on the extracted PDF text, extract:             │  │
│  │                                                              │  │
│  │  contractNumber  ← /CONTRACT NUMBER:\s*([A-Z0-9-\/\.]+)/i   │  │
│  │  title           ← /DOCUMENT TITLE:\s*(.{8,})/i             │  │
│  │  revision        ← /REVISION NUMBER:\s*(Rev\s*[A-Z0-9]+)/i  │  │
│  │  issuePurpose    ← /ISSUE PURPOSE:\s*([A-Z]{2,3})/i         │  │
│  │  securityClass   ← /SECURITY CLASSIFICATION:\s*([^\n]+)/i   │  │
│  │  discipline      ← /DISCIPLINE CODE:\s*([A-Z]{2,4})/i       │  │
│  │  documentType    ← /DOCUMENT TYPE:\s*([A-Z]{2,4})/i         │  │
│  │  fromOrg         ← /FROM ORGANISATION:\s*([A-Z]{2,5})/i     │  │
│  │  project         ← /PROJECT:\s*([^\n]+)/i                    │  │
│  │                                                              │  │
│  │  Source: API /api/cross-validate/:id                         │  │
│  │  Method: pdf-parse text → regex extraction                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                         │                                          │
│                         ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  STEP 5B: LOADSHEET vs DOCUMENT (7 checks)                 │  │
│  │                                                              │  │
│  │  Compare extracted PDF metadata against loadsheet fields:    │  │
│  │                                                              │  │
│  │  ┌──────────────────────┬──────────────┬──────────────────┐ │  │
│  │  │ Check                │ PDF Value     │ Loadsheet Value  │ │  │
│  │  ├──────────────────────┼──────────────┼──────────────────┤ │  │
│  │  │ Document Number Match│ contractNum  │ ds.documentNumber│ │  │
│  │  │ Document Title Match │ title        │ ds.title         │ │  │
│  │  │ Revision Match       │ revision     │ ds.revision      │ │  │
│  │  │ Discipline Match     │ discipline   │ ds.discipline    │ │  │
│  │  │ File Type Match      │ fileFormat   │ ds.fileType      │ │  │
│  │  │ Security Class       │ secClass     │ (must exist)     │ │  │
│  │  │ Issue Purpose        │ issuePurpose │ (must exist)     │ │  │
│  │  └──────────────────────┴──────────────┴──────────────────┘ │  │
│  │                                                              │  │
│  │  Matching logic:                                             │  │
│  │  - Document Number: exact case-insensitive match             │  │
│  │  - Title: fuzzy match on first 20 characters                 │  │
│  │  - Revision: contains match ("Rev A" contains "A")           │  │
│  │  - Discipline: first 3 chars uppercase match                 │  │
│  │  - File Type: exact uppercase match                          │  │
│  │  - Security/Issue: presence check (must be extractable)      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                         │                                          │
│                         ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  STEP 5C: TRANSMITTAL READINESS (1-9 checks)               │  │
│  │                                                              │  │
│  │  Before generating a transmittal, verify all 8 required      │  │
│  │  fields can be extracted from the PDF:                       │  │
│  │                                                              │  │
│  │  Required: contractNumber, title, revision, issuePurpose,    │  │
│  │           securityClassification, documentType, discipline,  │  │
│  │           fromOrganisation                                   │  │
│  │                                                              │  │
│  │  Pass: "All required transmittal fields can be extracted"    │  │
│  │  Fail: "Missing fields: [list]" + individual warnings        │  │
│  │                                                              │  │
│  │  Post-transmittal (if TRN already exists):                   │  │
│  │  - From Organisation matches submittal fromOrg               │  │
│  │  - Project reference is CP2 (not Cameron/Sabine/etc.)        │  │
│  │  - Document type extractable for transmittal                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ANY CROSS-VALIDATION CHECK FAILS → Log + Screenshot + Next Doc   │
└───────────────────────┬───────────────────────────────────────────┘
                        │ ALL PASS
                        ▼
┌───────────────────────────────────────┐
│  STAGE 6: TRANSMITTAL & APPROVAL      │
│                                       │
│  Step 6A: Create Incoming Transmittal │
│  ├─ Navigate to transmittal screen    │
│  ├─ Click "Generate Transmittal"      │
│  ├─ Server creates TRN number         │
│  └─ Verify TRN number displayed       │
│                                       │
│  Step 6B: Approve Submittal           │
│  ├─ Navigate to approval screen       │
│  ├─ Enter revision number             │
│  ├─ Click "Approve"                   │
│  └─ Verify success message            │
│                                       │
│  Step 6C: Set Bot Reviewed            │
│  ├─ Navigate to final status screen   │
│  ├─ Click "Bot Reviewed"              │
│  ├─ Status → "Bot Reviewed"           │
│  └─ STOP (do NOT click Complete)      │
│       ↑                               │
│       └── Human DC must review and    │
│           click Complete manually      │
│                                       │
│  FAIL at any sub-step → Log + Next    │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  STAGE 7: REPORTING                   │
│                                       │
│  After ALL documents processed:       │
│                                       │
│  HTML Report includes:                │
│  ├─ Document summary table            │
│  │   (doc number, file, outcome,      │
│  │    pass/fail counts)               │
│  ├─ Per-document detail (collapsible) │
│  │   ├─ Document Quality Checks       │
│  │   ├─ Loadsheet vs Document         │
│  │   └─ Transmittal Readiness         │
│  ├─ Workflow step log                 │
│  └─ Final status + next actions       │
│                                       │
│  Also saved:                          │
│  ├─ Screenshots per step              │
│  ├─ Playwright video recording        │
│  └─ JSON execution log                │
└───────────────────────────────────────┘
```

---

## Complete Check Matrix

### Stage 2: Submittal Detail (5 checks)

| # | Check | Source | Validation |
|---|-------|--------|------------|
| 1 | Document Number | UI field | Non-empty |
| 2 | Revision | UI field | Non-empty |
| 3 | File Type | UI field | Must be "PDF" |
| 4 | Originator | UI field | Non-empty |
| 5 | Submission Date | UI field | Non-empty |

### Stage 3: Load Datasheet (5 checks)

| # | Check | Source | Validation |
|---|-------|--------|------------|
| 1 | Document Number | Datasheet field | Non-empty, no leading/trailing spaces |
| 2 | Title | Datasheet field | Non-empty, no leading/trailing spaces |
| 3 | Revision | Datasheet field | Non-empty, no leading/trailing spaces |
| 4 | File Type | Datasheet field | Non-empty, no leading/trailing spaces |
| 5 | Discipline | Datasheet field | Non-empty, no leading/trailing spaces |

### Stage 4: Document Quality (3 + 12 = 15 checks)

| # | Check | Method | Pass Condition |
|---|-------|--------|----------------|
| 1 | File format valid | File metadata | fileFormat === "PDF" |
| 2 | File not corrupted | File metadata | corrupted === false |
| 3 | File size within limit | File metadata | fileSizeKB < 51200 |
| 4 | OCR / Text Searchability | pdf-parse text length | chars > 80 |
| 5 | No Draft Watermarks | Regex on text | No DRAFT/PRELIMINARY/NOT FOR CONSTRUCTION |
| 6 | No Markups or Annotations | Regex on text | No [COMMENT]/[MARKUP]/Annots markers |
| 7 | Page Orientation | Non-ASCII ratio | Non-ASCII chars < 10% of total |
| 8 | Metadata on Each Page | Regex on text | Footer text + signature block present |
| 9 | Security Classification | Regex on text | SECURITY CLASSIFICATION + valid value |
| 10 | Revision History | Regex on text | REVISION HISTORY section header present |
| 11 | Document Structure | Regex on text | Numbered sections + signatures present |
| 12 | Contract Reference | Regex on text | C2 EPC/CP2 present, no wrong projects |
| 13 | Rev/Issue Alignment | Regex extraction | Rev 0 + AFC combination rejected |
| 14 | File Completeness | Regex on text | END OF DOCUMENT marker at end |
| 15 | Second Cover Page | Regex on text | DOCUMENT CONTROL INFORMATION block |

### Stage 5: Cross-Validation (7 + up to 9 = up to 16 checks)

| # | Check | Comparison | Match Logic |
|---|-------|-----------|-------------|
| 1 | Document Number Match | PDF extracted vs loadsheet | Exact, case-insensitive |
| 2 | Document Title Match | PDF extracted vs loadsheet | Fuzzy, first 20 chars |
| 3 | Revision Match | PDF extracted vs loadsheet | Contains match |
| 4 | Discipline Match | PDF extracted vs loadsheet | First 3 chars uppercase |
| 5 | File Type Match | File format vs loadsheet | Exact uppercase |
| 6 | Security Classification | PDF extracted | Must be present |
| 7 | Issue Purpose | PDF extracted | Must be present |
| 8 | Transmittal Field Readiness | All 8 fields extractable | All present = pass |
| 9-16 | Individual missing fields | Per field | Each missing field = fail |

---

## Status Transitions

```
Review Submittal  ──(bot claims)──▶  In Review  ──(bot approves)──▶  Bot Reviewed  ──(human)──▶  Complete
                                          │
                                          ├──(quality fail)──▶  [logged, bot moves to next doc]
                                          └──(cross-val fail)──▶  [logged, bot moves to next doc]
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Mimic Frontend | HTML + CSS + Vanilla JS | SDx-like UI |
| Mimic Backend | Express.js (Node.js) | REST API + validation engine |
| PDF Text Extraction | pdf-parse 1.1.1 (Mozilla PDF.js) | Read text layer from real PDFs |
| PDF Generation | pdfkit | Create test PDF files |
| Bot Automation | Playwright (Chromium) | Browser automation |
| Reporting | Custom HTML generator | Per-document check report |
| Screenshots | Playwright page.screenshot() | Evidence capture per step |
| Video | Playwright recordVideo | Full session recording |

---

## Error Handling

| Scenario | Bot Behavior |
|----------|-------------|
| Submittal detail field empty | Log failure, screenshot, skip to next document |
| Datasheet field empty | Log failure, screenshot, skip to next document |
| PDF has no text layer (image-only) | pdf-parse throws → text = "" → OCR check fails → logged |
| PDF contains DRAFT watermark | Quality check fails → logged, screenshot, skip |
| PDF has reviewer markups | Quality check fails → logged, screenshot, skip |
| PDF metadata doesn't match loadsheet | Cross-validation fails → logged, screenshot, skip |
| Cannot extract fields for transmittal | Transmittal readiness fails → logged, screenshot, skip |
| Page navigation timeout | Playwright timeout → caught → bot re-logins and moves to next |
| Server not running | Fatal error → bot exits with error code |

---

## Validation Decision Matrix

```
All 15 quality checks PASS
  AND all 7 loadsheet checks PASS
  AND transmittal readiness PASS
  ───────────────────────────────────▶  CREATE TRANSMITTAL → APPROVE → BOT REVIEWED

ANY quality check FAIL
  OR any loadsheet check FAIL
  OR transmittal readiness FAIL
  ───────────────────────────────────▶  LOG FAILURE → SCREENSHOT → NEXT DOCUMENT
                                         (document stays "In Review" for manual handling)
```
