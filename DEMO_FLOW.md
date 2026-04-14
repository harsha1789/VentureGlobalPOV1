# VG CP2 Document Control Bot - Demo Flow

## What Does the Bot Do?

The bot **automates document intake** for Venture Global CP2 LNG. When contractors submit technical documents, a Document Controller normally spends **13-23 minutes per document** manually checking metadata, quality, and compliance. The bot does this in **under 2 minutes** -- enabling the team to scale from 100 to 500+ documents/day.

---

## How It Works - The Simple View

```
  Contractor submits a document
              |
              v
  +-------------------------+
  |   BOT PICKS IT UP       |  <-- Claims from SDx work queue
  +-------------------------+
              |
              v
  +-------------------------+
  |   CHECKS THE BASICS     |  <-- Is it a valid file? Right format?
  |   (Pre-flight - T0)     |
  +-------------------------+
              |
              v
  +-------------------------+
  |   READS THE DOCUMENT    |  <-- Extracts contract no., title,
  |   (Metadata - T1)       |      revision, discipline, etc.
  +-------------------------+
              |
              v
  +-------------------------+
  |   CHECKS QUALITY        |  <-- Is it searchable? No drafts?
  |   (Quality - T2)        |      No blank pages? Proper structure?
  +-------------------------+
              |
              v
  +-------------------------+
  |   CHECKS THE BATCH      |  <-- All docs same discipline?
  |   (Submittal - T2S)     |      Prior revisions exist?
  +-------------------------+
              |
              v
  +-------------------------+
  |   BUILDS TRANSMITTAL    |  <-- Auto-creates the SDx transmittal
  |   (Transmittal - T3)    |      with all extracted metadata
  +-------------------------+
              |
              v
  +-------------------------+
  |   MAKES A DECISION      |  <-- Score all checks, decide outcome
  |   (Decision - T4)       |
  +---+----------+-----+----+
      |          |     |
      v          v     v
   ACCEPT     REVIEW  REJECT
   (auto)    (human)  (return)
```

---

## The 5-Tier Pipeline - Step by Step

### Tier 0 - Pre-flight Checks (5 checks)

> *"Is this file even worth opening?"*

| Check | What It Does |
|-------|-------------|
| File type valid | Only accepts PDF, DOCX, XLSX, TXT, DWG |
| File not empty | Must have at least 20 characters of content |
| Filename clean | No extra spaces in filename |
| No special characters | No `~ / \ @ & % ! # $ ^ *` etc. in filename |
| Project prefix present | Filename must start with C2, CP2, or VG |

**If any pre-flight check fails -> HARD STOP, document is rejected immediately.**

---

### Tier 1 - Metadata Extraction (15 checks)

> *"Can I find all the required information in this document?"*

The bot reads the document and extracts:

| Field | Example | Required? |
|-------|---------|-----------|
| Contract Number | `C2-WOR-SOW-0042` | Yes |
| Document Title | `Electrical Design Basis` | Yes |
| Revision Number | `Rev 0`, `01`, `A` | Yes |
| Issue Purpose | IFC, IFR, IFU, AFC... | Yes |
| Security Class | Company Use, Confidential... | Yes |
| Document Type | SOW, MDR, DWG, SPE... | Yes |
| Discipline Code | ELE, MEC, PIP, CIV... | Yes |
| Document Date | Any standard format | No |
| Contractor Name | Worley, Samsung... | No |
| File Naming Convention | `[PROJ]-[CNTR]-[TYPE]-[SEQ]` | Yes |
| Doc Number = Filename | Must match exactly | Yes |

The bot also calls the **SDx API** to verify prior revisions exist (for Rev 1+).

---

### Tier 2 - Document Quality (12 checks)

> *"Is this a proper, production-ready document?"*

| Check | What It Looks For |
|-------|------------------|
| Text searchable | Not a scanned image with no text layer |
| No blank pages | Every page has meaningful content |
| Correct orientation | Pages are not sideways or upside down |
| English language | Document is in English |
| No DRAFT watermarks | No "DRAFT" or "PRELIMINARY" stamps |
| No markups/annotations | No review comments left in |
| Proper structure | Has sections, signatures, revision history |
| Metadata on each page | Headers/footers present |
| Rev/Purpose alignment | Rev 0 cannot be "Approved for Construction" |
| File completeness | Document is not corrupted or truncated |

---

### Tier 2S - Submittal Checks (6 checks)

> *"Does this batch of documents make sense together?"*

| Check | What It Looks For |
|-------|------------------|
| Prior revision exists | If Rev 1+, Rev 0 must be in SDx |
| Prior rev not under review | Can't submit new rev while old is pending |
| Revision history complete | Rev 1+ must include revision history |
| Same discipline in batch | Can't mix Electrical and Mechanical |
| Same issue purpose in batch | Can't mix IFC and IFR |
| Package completeness | All required fields present |

---

### Tier 3 - Transmittal Builder

> *"Let me prepare the SDx transmittal automatically."*

The bot auto-generates a transmittal with:
- **TRN Number:** `TRN-C2-WOR-0001` (auto-generated)
- **From/To:** Contractor org -> VG CP2
- **All metadata:** Type, discipline, revision, date, security class
- **Distribution list:** Looked up from discipline/type matrix

Then it validates the transmittal (9 checks) to ensure it's complete and correct.

---

### Tier 4 - Decision Engine

> *"What should we do with this document?"*

```
Score = (Passed Checks / Total Checks) x 100
```

| Condition | Decision | What Happens |
|-----------|----------|-------------|
| Any pre-flight failure | REJECT | Hard stop, return to contractor |
| 0 failures, warnings <= 3 | ACCEPT | Straight-through approval |
| 0 failures, warnings > 3 | REVIEW | Queued for human DC review |
| Any failure | REJECT | Return with list of failed checks |

---

### Tier 5 - Final Gate (5 checks)

> *"One last look before we close this out."*

| Check | Threshold |
|-------|-----------|
| All pipeline stages completed | No skipped tiers |
| Compliance score | >= 85% pass, >= 60% warn, < 60% fail |
| SDx upload readiness | Status properly set |
| No critical failures remaining | Zero blockers |
| Audit trail complete | Full record logged |

---

## What the User Sees

### 1. Login
```
Username: harsha
Password: test
-> Dashboard loads
```

### 2. Dashboard - Three Ways to Process

| Tab | What It Does |
|-----|-------------|
| **Queue** | Load pending submittals from SDx, claim & process |
| **Upload** | Drag-drop documents + CSV loadsheet, batch process |
| **Scenarios** | Run pre-built demo scenarios |

### 3. Demo Scenarios

| Scenario | Documents | Expected Result |
|----------|-----------|----------------|
| Valid Contract | 1 compliant doc | ACCEPT |
| Invalid Contract | 1 non-compliant doc | REJECT |
| Bulk Processing | 8 mixed docs | Mixed results |

### 4. Real-Time Terminal

The terminal shows live progress with color-coded logs:
- **[SYS]** System events (gray)
- **[OK]** Passed checks (green)
- **[WARN]** Warnings (yellow)
- **[ERR]** Failed checks (red)
- **[INFO]** Progress updates (blue)

### 5. Audit Log

Every processed document gets a record:

| Field | Example |
|-------|---------|
| Document | `C2-WOR-SOW-0042.pdf` |
| Decision | ACCEPT / REJECT / REVIEW |
| Score | 95.2% |
| TRN | TRN-C2-WOR-0001 |
| Duration | 1.8s |
| Pass/Fail/Warn | 42 / 0 / 2 |
| Operator | harsha |
| Timestamp | 2026-04-08 10:30:00 |

Export to CSV with one click.

---

## The Bot in HxGN SDx (Playwright Automation)

The Playwright bot mimics a human Document Controller in SDx:

```
Step 1   Reset app state
Step 2   Login as bot (dc_bot / BotPass2026!)
Step 3   Navigate to work queue
Step 4   Find pending submittal
Step 5   Claim it
Step 6   Open document details
Step 7   Validate all metadata fields
Step 8   Check the loadsheet
Step 9   Run document integrity checks
Step 10  Create transmittal in SDx
Step 11  Approve submittal
Step 12  Set status "Bot Reviewed"
Step 13  Generate HTML report with screenshots
```

---

## Key Numbers

| Metric | Manual | With Bot |
|--------|--------|----------|
| Time per document | 13-23 min | < 2 min |
| Documents per day | ~100 | 500+ |
| Human errors | Frequent | Zero (deterministic) |
| Audit trail | Manual logging | Automatic |
| Cost | DC staff time | $0 (Phase 1) |

---

## Phased Rollout

| Phase | What | Status |
|-------|------|--------|
| **Phase 1** | Deterministic rule-based validation (no AI) | Current |
| **Phase 2** | Azure Document Intelligence for OCR + field extraction | Planned |
| **Phase 3** | Vision LLM for template-agnostic validation | Planned |
| **Phase 4** | Live SDx API integration | Planned |

---

*Document Control Automation - Venture Global CP2 LNG*
