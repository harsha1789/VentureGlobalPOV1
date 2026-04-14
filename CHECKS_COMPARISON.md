# Playwright Bot vs AI Validation Checks

Comprehensive comparison of automated checks performed by the **Hexagon SDx Playwright Bot** (UI Automation) and the **Angular Validation Pipeline** (AI/Rules Engine).

---

## Quick Summary

| System | Type | Coverage | Speed |
|--------|------|----------|-------|
| **Playwright Bot** | UI Automation | Human-like workflow on Hexagon SDx portal | ~2-3 min per document |
| **Angular AI** | Rules Engine + NLP | Document content analysis + metadata extraction | ~1-2 sec per tier |

---

## Part 1: Playwright Bot Checks (Hexagon SDx UI Automation)

### **Step 1: Login**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| User authentication | Portal login form | Valid credentials accepted |
| Session established | Cookie/token check | Session active |

### **Step 2: Identify First Document**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Queue accessible | Page load | To Do List visible |
| Document list renders | DOM selector | First submittal found in grid |
| Document status visible | Text extraction | Status field populated |

### **Step 3: Claim Document**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Document claimable | Button click | Claim action succeeds |
| Status updated | Portal refresh | Status changes to "In Review" |
| Claimant recorded | API call | Operator name captured |

### **Step 4: Validate Submittal Detail Fields**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Document Number populated | Text extraction `[data-testid="detail-docnum"]` | Non-empty, valid format |
| Revision populated | Text extraction `[data-testid="detail-revision"]` | Non-empty |
| File Type populated | Text extraction `[data-testid="detail-filetype"]` | Equals "PDF" |
| Originator populated | Text extraction `[data-testid="detail-originator"]` | Non-empty |
| Submit Date populated | Text extraction `[data-testid="detail-date"]` | Valid date format |

### **Step 5: Open Load Datasheet**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Datasheet tab clickable | Button click | Datasheet screen loads |
| Datasheet visible | DOM selector | Table/form appears |
| Fields accessible | Page.locator() | All expected fields present |

### **Step 6: Validate Load Datasheet Fields**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Document Number validation | Text extraction + UI validator | Status = "PASS" at `[data-testid="ds-validation-status-documentNumber"]` |
| Title validation | Text extraction + UI validator | Status = "PASS" at `[data-testid="ds-validation-status-title"]` |
| Revision validation | Text extraction + UI validator | Status = "PASS" at `[data-testid="ds-validation-status-revision"]` |
| File Type validation | Text extraction + UI validator | Status = "PASS" at `[data-testid="ds-validation-status-fileType"]` |
| Discipline validation | Text extraction + UI validator | Status = "PASS" at `[data-testid="ds-validation-status-discipline"]` |

### **Step 7: Document Integrity**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Document viewer opens | Page click + wait | Viewer screen visible |
| File name displayed | Text extraction `[data-testid="docviewer-filename"]` | Non-empty filename |
| Basic integrity check 1 | UI validator at `[data-testid="integrity-status-0"]` | Status = "PASS" |
| Basic integrity check 2 | UI validator at `[data-testid="integrity-status-1"]` | Status = "PASS" |
| Basic integrity check 3 | UI validator at `[data-testid="integrity-status-2"]` | Status = "PASS" |
| Quality checks (API) | API fetch `/api/document/{submittalId}` | All quality checks pass |
| Cross-validation checks (API) | API fetch `/api/cross-validate/{submittalId}` | No blocking issues |

### **Step 8: Create Transmittal**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Transmittal screen loads | Page navigation | Form visible |
| Auto-generated TR Number | API call | TR-CP2-XXXX number assigned |
| TRN field populated | Verification | TRN visible in form |
| Transmittal can be submitted | Button click enabled | Submit button clickable |

### **Step 9: Approve Submittal**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Approval button clickable | DOM state check | Button enabled |
| Revision field accepts input | Input test | Revision number entered |
| Approval submits successfully | API response | HTTP 200/201 returned |
| Status changes | Portal refresh | Status updates on server |

### **Step 10: Set Status "Bot Reviewed"**
| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Bot Reviewed option visible | Dropdown check | Status option available |
| Status updated | API call | Status = "Bot Reviewed" set |
| Workflow paused | Portal state | Human intervention required for completion |

**Total Playwright Checks: ~33 UI + Business Logic Validations**

---

## Part 2: Angular AI Validation Pipeline Checks

### **Tier 0: Pre-Flight Checks (T0)**

| Check # | Check Name | Method | Pass Criteria | Data Source |
|---------|-----------|--------|---------------|------------|
| 1 | File Type Validation | Regex: `/\.(pdf\|doc\|docx\|xls\|xlsx\|dwg\|txt)$/i` | Extension in allowed list | File metadata |
| 2 | File Not Empty | Length check: `text.length > 0` | File has content, size >= 20 chars recommended | File content |
| 3 | Filename Validity | Trim/spaces check | No leading/trailing spaces, no double spaces | Filename |
| 4 | Filename Special Characters | Regex: `/[~\/\\@&%!#$^*()+={}\[\]\|<>?]/` | No prohibited special chars | Filename |
| 5 | Project Prefix Present | Regex: `/^(C2\|CP2\|VG)/i` | Starts with C2, CP2, or VG | Filename |

**T0 Total: 5 checks**

---

### **Tier 1: Metadata Extraction & Validation (T1)**

| Check # | Field | Extraction Method | Validation Logic | Pass Criteria |
|---------|-------|-------------------|------------------|---------------|
| 1 | Contract Number | Multi-pattern regex (3 patterns) | Must match /^C2[-\s]/i or /^(CP2\|VG)/i | Valid contract code found |
| 2 | Document Title | Regex: `/^(?:Title\|Subject\|Document\s+Title)\s*[:\-–]\s*(.+)/m` | Title length >= 5 chars | Title extracted |
| 3 | Revision Number | Regex: `/^(?:Revision\|Rev\.?)\s*[:\-–]\s*(\S+)/m` | Not a draft marker | Revision extracted |
| 4 | Issue Purpose | Enum lookup from VALID_ISSUE_PURPOSES | Matches one of: IFU, IFI, IFC, IFR, IFT, AFC, AFD, IFA, PUR | Valid issue purpose found |
| 5 | Security Classification | Enum lookup from VALID_SECURITY_CLASSES | Matches: Company Use, Confidential, Restricted, Public | Valid security class |
| 6 | Document Type | Enum lookup from VALID_DOC_TYPES | Matches: SOW, MDR, SDR, DWG, SPE, CAL, REP, PRO, MOM, ITP, PID, SLD, GA, FAT, HAZ, REQ | Valid doc type |
| 7 | Discipline Code | Enum lookup from VALID_DISCIPLINES | Matches: CMS, CIV, CME, ELE, INS, MEC, PIP, STR, PRO, HSE, QA, PUR | Valid discipline |
| 8 | Originator / Contractor | Regex: `/(?:From\|Originator\|Contractor|Prepared\s+by)\s*[:\-–]\s*([A-Z][A-Za-z\s]+)/i` | Non-empty, valid org name | Contractor extracted |
| 9 | Document Date | Regex: `/(?:Date\|Issue\s+Date\|Dated)\s*[:\-–]\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i` | Valid date format | Date extracted |
| 10 | Supplier Name | Regex: `/(?:Supplier\|Vendor)\s*[:\-–]\s*([A-Z][A-Za-z0-9\s&.,]+)/i` | Non-empty, valid name format | Supplier extracted |
| 11 | PO Number | Regex: `/(?:PO\|Purchase\s+Order)\s*#?[:\-–]\s*([A-Z0-9\-]+)/i` | Valid PO format, cross-ref to doc | PO number found |
| 12 | Doc Number Matches File Name | String comparison: `stripExtension(fileName) === docNumber` | Exact match after removing extension | Names match |
| 13 | Second Cover Page | Regex: `/DOCUMENT\s+CONTROL\|DC\s+Information/i` | Found in text | DC block present |
| 14 | Contract Reference Validation | Regex: `/^C2[-\s]/i` or `/^(CP2\|VG)/i` | Code matches C2 EPC-BOP | Contract valid |
| 15 | Correct Contract Submission | Regex: `/CP2\|VG\s*CP2\|Calcasieu\s+Pass\s+2\|C2/i` | Project = CP2 | Correct project |

**T1 Total: 15 checks**

---

### **Tier 2: Document Quality Checks (T2)**

| Check # | Check Name | Method | Pass Criteria | Failure Mode |
|---------|-----------|--------|---------------|--------------|
| 1 | OCR / Text Searchability | Text extraction: `text.length > 80 && wordCount > 10` | Readable text present, >= 10 words | Image-only / scanned (not OCR'd) |
| 2 | Blank Page Detection | Word density: `wordCount / pageMarkers < 15` | Low blank ratio | Multiple blank pages detected |
| 3 | Page Orientation | Character encoding: `(nonASCII / totalChars) > 0.1` | < 10% non-ASCII characters | Rotated/encoding issue |
| 4 | Language Compliance | Keyword frequency: `nonEnglishWords <= 5` | Primary language is English | Foreign language content |
| 5 | English Translation Present | Regex: `/english\s+translation/i` | Translation present OR English primary | Missing English version |
| 6 | No Draft Watermarks | Regex: `/DRAFT\|FOR\s+REVIEW\|NOT\s+FOR\s+CONSTRUCTION\|PRELIMINARY/i` | No draft markers present | Document is draft |
| 7 | No Markup Annotations | Regex: `/\[COMMENT\]\|\[MARKUP\]\|<annotation\|\/Annots/i` | No markup annotations found | Markups present |
| 8 | Proper Document Structure | Regex: `/^[0-9]+\.\s+[A-Z]/m` | Numbered sections detected | Malformed structure |
| 9 | Metadata on Each Page | Regex: `/Company\s+Use\|Confidential\|VGL\|Venture\s+Global/i` | Footer/header info found | Missing metadata |
| 10 | Clean Document End | Regex: `/END\s+OF\s+DOCUMENT\|={5,}$/i` | Document ends cleanly | Corrupted end |
| 11 | Complete Revision Info | Regex: `/REVISION\s+HISTORY\|Rev\s+History/i` | Revision history block present | Missing history |
| 12 | Management Sign-offs | Regex: `/Prepared\s+by\|Reviewed\s+by\|Approved\s+by/i` | Sign-off block present | Missing signatures |

**T2 Total: 12 checks**

---

### **Tier 2S: Submittal Checks (T2S)**

| Check # | Check Name | Method | Pass Criteria | Failure Trigger |
|---------|-----------|--------|---------------|-----------------|
| 1 | Prior Revision Exists | API lookup: `sdxApi.checkPriorRevisionExists()` | Prior revision found in SDx OR first issue | Orphaned revision |
| 2 | Prior Rev Not Under Review | API check: `!revisionUnderReview` | Prior revision not locked | Blocking issue |
| 3 | Revision History Complete | Regex: `/Rev [A-Z0-9]\s*[-–]\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/` | History chain present | Incomplete history |
| 4 | Same Discipline in Batch | Set comparison: `new Set(batch.disciplines).size === 1` | All docs same discipline | Mixed disciplines in batch |
| 5 | Same Issue Purpose in Batch | Set comparison: `new Set(batch.issuePurposes).size <= 2` | All docs same purpose (except superseding) | Mixed purposes |
| 6 | Package Completeness | Count check: `docCount === expectedCount` | All required docs present | Missing docs |

**T2S Total: 6 checks**

---

### **Tier 3: Transmittal Builder & Validation (T3 + T3V)**

| Check # | Check Name | Method | Pass Criteria | Failure Trigger |
|---------|-----------|--------|---------------|-----------------|
| 1 | TRN Format Valid | Regex: `/^TR-CP2-\d{6}$/` | Format matches TR-CP2-XXXXXX | Invalid format |
| 2 | From Organization Valid | Enum check | Matches known contractors (WOR, etc.) | Unknown org |
| 3 | To Organization Valid | Enum check | Matches VGL (Venture Global) | Wrong recipient |
| 4 | Document Type in TRN | String check | Document type matches transmittal | Mismatch |
| 5 | Discipline in TRN | Enum check | Discipline valid | Invalid discipline |
| 6 | Security Classification in TRN | Enum check | Matches valid classes | Invalid class |
| 7 | Revision in TRN | String check | Non-empty revision | Missing revision |
| 8 | Issue Purpose in TRN | Enum check | Matches VALID_ISSUE_PURPOSES | Invalid purpose |
| 9 | All Required Fields Populated | Null check | No null/empty required fields | Incomplete transmittal |

**T3/T3V Total: 9 checks**

---

### **Tier 4: Decision Engine (Scoring)**

| Metric | Calculation | Result |
|--------|-------------|--------|
| Pre-Flight Score | (passPF / totalPF) × 100 | % pass |
| Metadata Score | (passMeta / totalMeta) × 100 | % pass |
| Quality Score | (passQual / totalQual) × 100 | % pass |
| Submittal Score | (passSubm / totalSubm) × 100 | % pass |
| Transmittal Score | (passTrn / totalTrn) × 100 | % pass |
| **Overall Score** | `(totalPass / totalChecks) × 100` | 0–100% |

**Decision Logic:**
```
IF totalFail > 0:
  Decision = REJECT
ELSE IF totalWarn > 3:
  Decision = REVIEW
ELSE:
  Decision = ACCEPT
```

**T4 Total: 1 decision (based on 5 tiers)**

---

### **Tier 5: Final Gate Checks (T5)**

| Check # | Check Name | Method | Pass Criteria |
|---------|-----------|--------|---------------|
| 1 | All Stages Complete | Status check | All prior tiers finished |
| 2 | Compliance Score Acceptable | Threshold: score >= 80 | Score in acceptable range |
| 3 | Transmittal Ready for SDx | Validation check | All TRN fields valid |
| 4 | Audit Trail Complete | Log check | All decisions recorded |
| 5 | No Blocking Issues | Array check | No showstopper errors |

**T5 Total: 5 checks**

---

## Part 3: Coverage Comparison Matrix

### **PreFlight & Metadata (File & Document Level)**

| Category | Playwright Bot | AI Validation | Coverage |
|----------|---|---|---|
| File extension validation | ✓ (Step 4: fileType check) | ✓ (T0-1) | 100% |
| File size check | ✗ | ✓ (T0-2: length check) | AI only |
| Filename validity | ✓ (Step 4: implicit) | ✓ (T0-3,4) | Both |
| Document number extraction | ✓ (Step 4: detail-docnum) | ✓ (T1-1) | Both |
| Revision extraction | ✓ (Step 4: detail-revision) | ✓ (T1-3) | Both |
| Title extraction | ✗ | ✓ (T1-2) | AI only |
| Contractor/Originator | ✓ (Step 4: detail-originator) | ✓ (T1-8) | Both |
| Date validation | ✓ (Step 4: detail-date) | ✓ (T1-9) | Both |

### **Content Quality (OCR, Structure)**

| Category | Playwright Bot | AI Validation | Coverage |
|----------|---|---|---|
| Text searchability (OCR) | ✓ (Step 7: basic integrity) | ✓ (T2-1) | Both |
| Blank page detection | ✗ | ✓ (T2-2) | AI only |
| No markups/annotations | ✗ | ✓ (T2-7) | AI only |
| Document structure | ✗ | ✓ (T2-8,11,12) | AI only |
| Language validation | ✗ | ✓ (T2-4,5) | AI only |
| Draft watermark check | ✗ | ✓ (T2-6) | AI only |

### **Batch/Submittal Validations (T2S)**

| Category | Playwright Bot | AI Validation | Coverage |
|----------|---|---|---|
| Prior revision check | ✗ | ✓ (T2S-1,2) | AI only |
| Batch discipline consistency | ✗ | ✓ (T2S-4) | AI only |
| Batch issue purpose consistency | ✗ | ✓ (T2S-5) | AI only |

### **Transmittal & Compliance**

| Category | Playwright Bot | AI Validation | Coverage |
|----------|---|---|---|
| Auto-generate TRN | ✓ (Step 8: TR-CP2-XXXX) | ✓ (T3-1) | Both |
| TRN format validation | ✓ (Step 8: implicit) | ✓ (T3-1) | Both |
| Org validation | ✓ (Step 8: form population) | ✓ (T3-2,3) | Both |
| Final compliance score | ✗ | ✓ (T4) | AI only |

---

## Summary: Total Check Counts

| System | Tier 0–2 | Tier 2S | Tier 3–4 | Tier 5 | **Total** |
|--------|----------|---------|----------|--------|-----------|
| **Playwright Bot** | ~10 checks (UI extraction) | — | ~8 checks (workflow) | — | **~33 checks** |
| **AI Validation** | 5 + 15 + 12 = 32 | 6 | 9 + 1 | 5 | **~53 checks + scoring** |
| **Combined Coverage** | UI + content analysis | Batch rules | Both | Final gate | **100% document lifecycle** |

---

## When to Use Each System

### Use **Playwright Bot** when:
- ✅ Testing Hexagon SDx portal workflows
- ✅ Simulating real user behavior
- ✅ Automating multi-step approvals
- ✅ Need visual verification screenshots/videos
- ✅ Testing UI state transitions

### Use **AI Validation** when:
- ✅ Batch processing documents offline
- ✅ Need fast automated validation (1–2 sec/doc)
- ✅ Detailed quality/compliance metrics
- ✅ Scoring and decision logic
- ✅ No SDx portal access needed

### Use **Both Together** for:
- ✅ Full end-to-end testing (bot + AI validation)
- ✅ Complete audit trail + compliance proof
- ✅ Quality gates before manual approval
- ✅ continuous compliance monitoring

---

*Created by Harsha Toshniwal April 13, 2026 — Venture Global CP2 Document Control Automation*
