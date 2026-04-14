# Validation Rules Reference

All rules implemented in `ValidationService`. This document is the source of truth for what is checked, why, and what the expected values are.

---

## Tier 1 — Loadsheet Metadata Checks

Based on the 8 QA checks observed in the live VG CP2 process 

### Check 1 — Contract / Document Number

**Rule:** Must be present. Must match pattern `[PROJ]-[CNTR]-[TYPE]-[SEQ]`. Must contain no special characters.

**Forbidden characters:** `~ / \ @ & % ! # $ ^ * ( ) + = { } [ ] | < > ?`

**Valid examples:**
- `C2-WOR-SOW-0042`
- `C2-000710-ELE-REQ-WOR-00006`
- `C2-WOR-MDR-0018`

**Invalid examples:**
- `C2/WOR/SOW/0042` — forward slashes
- `C2 WOR SOW 0042` — spaces
- `WOR-0042` — missing project segment

**Extraction patterns (in priority order):**
1. `CONTRACT NUMBER: <value>`
2. `Document No.: <value>`
3. Pattern match `[A-Z]{1,5}-[A-Z0-9]{2,6}-[A-Z]{2,4}-[0-9]{4,6}`

---

### Check 2 — File Name

**Rule:** File name must contain no special characters. Must follow VGL naming convention.

**Convention:** `[PROJECT]-[CONTRACTOR]-[DOCTYPE]-[DISCIPLINE]-[SEQNO]-[REV].[ext]`

**Forbidden characters:** Same as Check 1.

**Valid examples:**
- `C2-WOR-SOW-0042.pdf`
- `C2-000710-ELE-REQ-WOR-00006.docx`

---

### Check 3 — Document Number Matches File Name

**Rule:** Document number (extracted from content) must match file name exactly when extension is stripped. Case-insensitive comparison.

**Example:**
- Document number: `C2-WOR-SOW-0042`
- File name: `C2-WOR-SOW-0042.pdf`
- Result: PASS

**Failure example:**
- Document number: `C2-WOR-SOW-0042`
- File name: `C2-WOR-SOW-0043.pdf`
- Result: FAIL — mismatch

---

### Check 4 — No Mixed Disciplines

**Rule:** In a batch submission, all documents must have the same discipline code. Mixed disciplines indicate an incorrect grouping.

**Exception:** Superseding submissions may mix disciplines.

**Valid discipline codes:** `CMS, CIV, CME, ELE, INS, MEC, PIP, STR, PRO, HSE, QA, PUR`

---

### Check 5 — Issue Purpose Consistency

**Rule:** All documents in a batch must have the same issue purpose. Mixed issue purposes indicate an error.

**Exception:** Superseding documents may differ from the batch.

**Valid issue purpose codes:**

| Code | Full Name |
|---|---|
| IFU | Issued for Use |
| IFI | Issued for Information |
| IFC | Issued for Construction |
| IFR | Issued for Review |
| IFT | Issued for Tender |
| AFC | Approved for Construction |
| AFD | Approved for Design |
| IFA | Issued for Approval |
| PUR | Issued for Purchase |

---

### Check 6 — Security Classification

**Rule:** Must be present and must be one of the valid values.

**Valid values:** `Company Use` (most common), `Confidential`, `Restricted`, `Public`

**Extraction patterns:**
1. `SECURITY CLASSIFICATION: <value>`
2. `Classification: <value>`
3. Keyword match anywhere in document

---

### Check 7 — Supplier Name

**Rule:** For supplier documentation, the supplier name field must be populated.

**Extraction patterns:**
1. `SUPPLIER NAME: <value>`
2. `Vendor: <value>`
3. `Manufacturer: <value>`

---

### Check 8 — Purchase Order Number

**Rule:** For supplier documentation, the PO number must be populated and must match the PO referenced in the document body.

**Extraction patterns:**
1. `PURCHASE ORDER NUMBER: <value>`
2. `PO NUMBER: <value>`
3. `PO-<digits>`

---

## Tier 2 — Document Quality Checks


### OCR / Text Searchability

**Rule:** PDF must have a text layer — it must be searchable, not image-only.

**Detection:** Extract text from all pages. If total character count < 100, flag as image-only.

**Production tool:** `PyMuPDF — page.get_text()`

**AI needed for:** Scanned PDFs where OCR has not been applied. Azure Document Intelligence performs OCR and returns searchable text.

---

### Blank Page Detection

**Rule:** No pages should be blank (no content).

**Detection (text PDFs):** Character count per page < 50 = blank.

**Detection (scanned PDFs):** Ink coverage percentage < 2% = blank.

**Production tool:** PyMuPDF character count + PIL image analysis for scanned.

**AI needed for:** Distinguishing a blank page from a sparse-but-intentional page (single signature, sparse drawing title block).

---

### Page Orientation

**Rule:** All pages must be correctly oriented (portrait for documents, landscape permitted for drawings with landscape content).

**Detection (text PDFs):** Text bounding box direction via PyMuPDF.

**Detection (scanned PDFs):** Cannot determine from text — requires image analysis.

**Production tool:** PyMuPDF for text layer. **Azure Document Intelligence** for scanned — detects rotation from visual content analysis.

---

### Language Compliance

**Rule:** Primary language must be English. If non-English content is present, an inline English translation must also be present.

**Detection:** langdetect library on extracted text. Non-English confidence > 0.3 triggers translation check.

---

### No Draft Watermarks

**Rule:** Document must not contain DRAFT or preliminary markers.

**Detection patterns:** `DRAFT`, `FOR REVIEW ONLY`, `NOT FOR CONSTRUCTION`, `PRELIMINARY`, `WORK IN PROGRESS`

---

### No Markups or Annotations

**Rule:** Document must not contain redline markups, comments, or sticky note annotations.

**Detection (digital annotations):** `PyMuPDF — page.annots()` returns annotation objects.

**Detection (physical markups scanned in):** Image analysis only — requires vision model.

**AI needed for:** Hand-drawn redlines on scanned documents. These are pixels, not annotation objects.

---

### Document Structure

**Rule:** Document must have: numbered sections, a signature/approval block, a revision history.

**Detection:** Pattern matching for section headers `1. SCOPE`, signature blocks `Prepared by:`, `Reviewed by:`, `Approved by:`, revision history tables.

---

### Revision History Completeness

**Rule:** Revision history must be present, sequential, with dates in logical order and no blank description fields.

**Detection:** Extract revision table. Verify: (a) revisions are alphabetically/numerically sequential, (b) dates are non-decreasing, (c) description fields non-empty.

**AI needed for:** Arbitrary revision table formats. Different vendors use different table layouts, column orders, and revision naming schemes.

---

### Revision / Issue Purpose Alignment

**Rule:** The revision number and issue purpose must be logically consistent.

**Rules enforced:**
- Rev 0 + AFC = FAIL (cannot approve for construction without a review cycle)
- Rev 0 + IFU = WARN (unusual to issue for use on first revision)
- Any Rev + IFR = PASS (always valid to issue for review)
- Rev > A + IFR = WARN (multiple reviews unusual but not invalid)

---

### Prior Revision Availability

**Rule:** If a previous revision exists (Rev > A or Rev > 0), it must be present in SDx.

**Detection:** Requires SDx API call — cannot be determined from document content alone.

**Note:** This check is marked PENDING — requires SDx API read access.

---

### Correct Contract

**Rule:** The document discipline and type must match the contract under which it is being submitted.

**Example:** An ELE (Electrical) document submitted under a CIV (Civil) contract — invalid.

**Detection:** Cross-reference discipline code against contract configuration table.

---

## Decision Rules (Tier 4)

| Condition | Decision |
|---|---|
| All checks pass, ≤ 2 warnings | ACCEPT — straight-through processing |
| Zero failures, > 2 warnings | REVIEW — human queue with pre-populated summary |
| Any failures | REJECT — structured failure report to contractor |


