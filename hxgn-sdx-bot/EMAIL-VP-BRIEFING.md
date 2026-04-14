**Subject:** Document Control Automation — Technical Workflow, Bot Demo Results & ROI Summary

---

Dear All,

I'd like to share an update on the Document Control Automation initiative we've been building for the VG CP2 LNG project. Below is a summary of what we've built, how it works, the validation coverage, and the projected return on investment.

---

### What We've Built

An automation bot that replicates what a human Document Controller does inside HxGN SDx — but in seconds, not hours. The bot processes incoming contractor submittals end-to-end: claiming documents from the work queue, validating metadata, checking document quality against real PDF content, cross-validating the loadsheet, generating transmittals, and setting the review status — all without manual intervention.

The system currently runs against a mimic of the SDx interface to demonstrate the workflow before connecting to the live environment.

---

### How It Works

**Step-by-step automation flow (per document):**

1. Bot logs into SDx and scans the work queue for new submittals
2. Claims the document and opens the submittal detail screen
3. Validates submittal fields — document number, revision, file type, originator, date
4. Opens the load datasheet and validates all 5 mandatory fields
5. Opens the attached PDF and runs **22 automated checks** (details below)
6. If all checks pass — creates an incoming transmittal and sets status to "Bot Reviewed"
7. If any check fails — logs the specific failure, captures a screenshot, and moves to the next document
8. After processing all documents — generates an HTML report with per-document results

**The bot processes all pending submittals in a single run.** In our current test, 5 documents are processed in under 20 seconds.

---

### Document Validation — What the Bot Checks

These checks run against **real PDF files** using text extraction (pdf-parse / Mozilla PDF.js), not hardcoded test data.

**Document Quality Checks (12):**

| Check | What It Validates |
|-------|-------------------|
| OCR / Text Searchability | PDF has a selectable text layer (not image-only scan) |
| Draft Watermark Detection | No "DRAFT" or "NOT FOR CONSTRUCTION" markers |
| Markup / Annotation Detection | No reviewer comments, highlights, or annotation objects |
| Page Orientation | No encoding anomalies suggesting rotated or garbled pages |
| Document Metadata on Each Page | Headers/footers with document identity present throughout |
| Security Classification | Valid classification found (Company Use / Confidential / Restricted / Public) |
| Revision History | Revision history section present in document |
| Document Structure | Numbered sections, signatures, and footer present |
| Contract Reference | Correct C2 EPC-BOP contract reference confirmed |
| Revision & Issue Purpose Alignment | Rev 0 cannot be AFC; alignment rules enforced |
| File Completeness | End-of-document marker present (not truncated) |
| Second Cover Page | Document Control Information block present |

**Loadsheet Cross-Validation (7):**

| Check | What It Compares |
|-------|------------------|
| Document Number Match | Document number inside the PDF vs loadsheet entry |
| Document Title Match | Title extracted from PDF vs loadsheet |
| Revision Match | Revision in PDF content vs loadsheet |
| Discipline Match | Discipline code in PDF vs loadsheet |
| File Type Match | Actual file format vs loadsheet |
| Security Classification Present | Extracted from document — must exist |
| Issue Purpose Present | Extracted from document — must exist |

**Transmittal Readiness (up to 9):**

Before generating a transmittal, the bot verifies all 8 required fields (contract number, title, revision, issue purpose, security class, document type, discipline, organisation) can be extracted from the PDF.

**Basic Integrity (3):**

File format is PDF, file is not corrupted, file size within 50 MB limit.

---

### Demo Results

We ran the bot against 5 test documents representing real-world scenarios:

| Document | Scenario | Result | Details |
|----------|----------|--------|---------|
| VG-CP2-MEC-DWG-0001 | Valid, all metadata present | **PASS** (22/22 checks) | Auto-approved, transmittal created |
| VG-CP2-ELE-SPC-0042 | Valid, Rev B with history | **PASS** (22/22 checks) | Auto-approved, transmittal created |
| VG-CP2-PIP-DWG-0112 | Scanned image, no text layer | **FAIL** (19 issues) | OCR failure detected — "image-only or scanned document" |
| VG-CP2-CIV-CAL-0037 | Contains reviewer markups | **FAIL** (1 issue) | "Annotation or markup indicators detected" |
| VG-CP2-PRO-PID-0044 | Wrong project, DRAFT, misaligned | **FAIL** (13 issues) | Wrong contract, DRAFT watermark, Rev 0 + AFC conflict, missing security class |

**Processing time:** All 5 documents completed in ~16 seconds.

---

### ROI Projection

**Current state (manual process):**

| Metric | Value |
|--------|-------|
| Average time per submittal (manual review) | 15–25 minutes |
| Submittals per week (CP2 peak) | 200–400 |
| DC team effort per week | 50–170 hours |
| Common rejection reasons | Missing metadata, wrong revision, naming errors, markups present |
| Rework cycle (reject + resubmit + re-review) | 2–5 days per document |

**With automation:**

| Metric | Value |
|--------|-------|
| Bot processing time per submittal | ~3 seconds |
| Checks per submittal | 22 automated (vs 5–8 manual spot checks) |
| Throughput | 400+ submittals in under 30 minutes |
| False positive rate | Configurable — flags for human review, does not auto-complete |
| Human involvement | Final "Complete" step still requires manual DC sign-off |

**Projected savings:**

| Area | Impact |
|------|--------|
| DC review time reduction | 70–85% (bot handles pre-screening, humans handle exceptions) |
| Rejection accuracy | Higher — bot checks 22 criteria consistently vs human spot-checks |
| Rework reduction | Catch issues at submission, not after multi-day review cycles |
| Consistency | Every document gets the same 22 checks, every time |
| Scalability | Bot handles volume spikes without additional headcount |
| Risk reduction | Wrong-contract submissions and missing security classifications caught immediately |

**Conservative estimate:** At 300 submittals/week with 20 minutes average manual time, automation saves approximately **80–100 DC hours per week** during peak construction phases. At current contractor rates, this translates to significant cost avoidance over the project lifecycle.

---

### What's Next

1. **UAT with real SDx environment** — Connect the bot to the live HxGN SDx instance (API integration points already mapped)
2. **Load sheet CSV/Excel ingestion** — Automate the loadsheet upload and row-level validation
3. **Azure Document Intelligence integration** — For scanned document OCR and advanced page analysis
4. **Rejection workflow automation** — Auto-generate rejection emails with specific failure reasons
5. **Dashboard and reporting** — Real-time view of bot throughput, pass/fail rates, and rejection trends

The bot is designed with a deliberate stop point — it sets status to "Bot Reviewed" but never "Complete." This ensures a human Document Controller always has final sign-off authority, maintaining the governance and accountability required for the project.

Happy to arrange a live demo or walkthrough at your convenience.

Best regards
