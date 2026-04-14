# AI Strategy — Where Automation Ends and AI Begins

## The Core Problem

Document Control at VG CP2 receives submissions from multiple contractors, each using their own company template, their own terminology, and their own document layout. A fixed-template validator works for known vendors. The challenge is handling any vendor, any template, from day one — exactly the way a human Document Controller does.

This document defines precisely where deterministic automation is sufficient, where AI adds genuine value, and where humans must stay in the loop.

---

## Zone 1 — Pure Automation (No AI Required)

These checks have a binary correct answer. A script is more reliable than AI here because AI introduces probabilistic uncertainty where none is needed.

### Loadsheet QA (8 checks from live VG process)
1. Special characters in document number `(~, /, \, @, &, %, !, etc.)`
2. Special characters in file name
3. Document number matches file name (strip extension, exact compare)
4. No mixed disciplines in a batch submission
5. No mixed issue purpose in a batch (superseding exception applies)
6. Security classification is valid enum value
7. Supplier name populated
8. Purchase Order number populated and matches document (supplier docs)

### Document QA — Deterministic Checks
- OCR text layer present → PyMuPDF `page.get_text()` character count
- File format valid → MIME type check, not just extension
- Page count > 0 → not an empty file
- Revision number format valid → regex enum
- Issue purpose code valid → enum: IFU, IFI, IFC, IFR, IFT, AFC, AFD, IFA, PUR
- Document number on cover matches footer → string comparison across pages
- No DRAFT watermark → keyword scan
- Annotation/markup objects → PyMuPDF `page.annots()`
- Revision/issue purpose alignment → rule table (Rev 0 ≠ AFC)
- File naming convention → regex

**Cost:** Zero licence cost. Runs in milliseconds. 100% explainable. No hallucination risk.

---

## Zone 2 — AI Adds Genuine Value

These are the checks that break when a new vendor submits in an unknown template layout.

### 2a. Field Extraction from Arbitrary Layouts
**Problem:** A script needs to know the contract number is in cell B3 or the top-right corner. A new vendor puts it somewhere else — script fails.

**Solution:** Azure Document Intelligence key-value extraction reads the document the way a human does — it understands that a number like `C2-000710-ELE-REQ-WOR-00006` next to the words "Document No.", "Ref:", "Agreement Reference:", or even isolated in a header block — is the document number. Layout-independent.

**Accuracy:** Azure Document Intelligence achieves 95%+ key-value extraction accuracy on EPC-style title blocks across arbitrary layouts.

**Cost:** ~$1.50 per 1,000 pages. At 100 docs/day × 14 pages = 1,400 pages/day = ~$2.10/day. Trivially defensible.

### 2b. Page Orientation (Scanned Documents)
**Problem:** A text-layer PDF — orientation is trivial (measure text bounding boxes). A scanned PDF photographed sideways — no text to measure.

**Solution:** Vision model (Azure Document Intelligence or GPT-4o vision) detects rotation from image content. A script cannot do this without a trained image classifier.

**When it matters:** Any contractor submitting scanned legacy drawings or hand-stamped documents.

### 2c. Blank Page Detection (Image PDFs)
**Problem:** For text PDFs, character count per page works. For scanned PDFs, a page with low ink density could be blank — or it could be a sparse diagram, a signature page, or a page with a single large drawing.

**Solution:** Vision model distinguishes blank from sparse-but-intentional content. A pixel density threshold makes too many mistakes on drawing pages.

### 2d. Handwritten Annotations or Fields
**Problem:** Some older drawing title blocks have handwritten revision marks or signatures. PyMuPDF sees nothing — they're pixels, not text.

**Solution:** Azure Document Intelligence handwriting model reads printed and handwritten text. Tesseract handles printed but fails on cursive handwriting.

### 2e. Document Validity — The Template Problem
**Problem:** A new vendor, never seen before, submits their own template. No rule can tell you if it looks like a legitimate contract.

**Solution:** Send pages 1–3 as images to a vision LLM with a structured prompt assessing:
- Identity block present (number, title, date, revision)
- Authorship evident (name, company, role)
- Approval evidence (signature, stamp, DocuSign, approval block)
- Completeness (body present, not just a cover page)
- Professional quality (no DRAFT watermarks, no `[INSERT DATE HERE]` placeholders)
- Correct type (does a document claiming to be a Requisition look like one)

This works for any template from any vendor from day one. No configuration needed.

### 2f. Revision History Completeness
**Problem:** Reading the revision table and verifying sequential logic — Rev A before Rev B, dates progressive, no gaps — requires understanding table structure across arbitrary layouts.

**Solution:** Azure Document Intelligence table extraction, or LLM with structured output prompt. A regex handles one table format; AI handles any format.

---

## Zone 3 — Keep Humans In The Loop

These require human judgement. AI should not make the final call.

| Situation | Why Human Needed |
|---|---|
| AI confidence score below threshold | The model itself signals uncertainty |
| New vendor template flagged as ambiguous | First submission from unknown org |
| Prior revision still open in SDx | Requires cross-system knowledge |
| Revision history suggests process violation | Legal/contractual implications |
| Document appears to be wrong type for contract | Engineering judgement required |
| Conflicting metadata between cover and body | Needs investigation, not just flagging |
| Legal execution questions | Out of Document Control scope entirely |

---

## The Incremental Delivery Map

### Stage 1 — Deterministic Automation (Phase 1, current)
Pure regex and pattern matching. Covers ~70% of daily submissions (compliant, text-layer PDFs from known contractors).

**Value delivered:** Eliminates transmittal re-entry, metadata comparison, basic QA checks. Saves 8–12 minutes per compliant document. Zero AI cost.

### Stage 2 — Document Intelligence for Extraction (Phase 2)
Azure Document Intelligence replaces regex for field extraction. System now works for new vendor templates without configuration.

**Value delivered:** System works on day one for every vendor, not just known ones. Scanned PDF orientation and blank page detection resolved. Cost: ~$2/day.

### Stage 3 — Vision LLM for Template Validity (Phase 3)
Vision model assesses any document as a whole — does it look like a legitimate contract regardless of template.

**Value delivered:** The "any vendor, any template" problem is solved. Human review queue reduces from ~20% to ~5% of volume. Cost: ~$0.01–0.05 per document assessed.

### Stage 4 — SDx API Live Integration (Phase 4)
Replace simulation layer with real SDx REST API calls. Tier 3 creates transmittals live. Tier 4 approves submittals and triggers SDx workflow.

**Value delivered:** Straight-through processing becomes real, not simulated. Full elimination of manual intake for compliant documents.

---

## Licence Position

| Tool | Licence Type | Cost |
|---|---|---|
| PyMuPDF | Open source (AGPL) | Free |
| python-docx | Open source (MIT) | Free |
| openpyxl | Open source (MIT) | Free |
| langdetect | Open source (Apache 2.0) | Free |
| Tesseract OCR | Open source (Apache 2.0) | Free |
| Azure Document Intelligence | Azure consumption | ~$1.50/1K pages |
| Azure OpenAI (GPT-4o) | Azure consumption | ~$0.01–0.05/doc |

No seat licences. No upfront costs. Consumption-based billing only — paid when used, zero when not. This is the strongest possible position for internal cost justification.

---

