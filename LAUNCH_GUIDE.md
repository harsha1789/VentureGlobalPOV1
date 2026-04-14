# VG CP2 Document Control - Launch & Run Guide

---

## Prerequisites

- **Node.js 18+** installed
- Terminal / Command Prompt open
- All dependencies installed (run `npm install` in each folder if first time)

---

## Part 1: Launch the Hexagon SDx Dashboard

### Step 1 — Start the Mimic Server

Open **Terminal 1** and run:

```bash
cd hxgn-sdx-bot/mimic-app/backend
npm install        # only needed first time
npm start
```

You should see:
```
HxGN SDx Mimic App running at http://localhost:3000
```

### Step 2 — Open the Dashboard

Open your browser and go to:

```
http://localhost:3000
```

### Step 3 — Login

| Field    | Value         |
|----------|---------------|
| Username | `dc_bot`      |
| Password | `BotPass2026!`|

You will see the **To Do List** with 15 submittals in the Hexagon SDx-style interface.

---

## Part 2: Run the Bot (SDx Automation)

The bot automates the Hexagon SDx portal — it logs in, claims a document, validates it, creates a transmittal, and approves it.

### Step 1 — Open a New Terminal

Open **Terminal 2** (keep Terminal 1 running the server).

### Step 2 — Run the Bot

```bash
cd hxgn-sdx-bot/bot
npm install                  # only needed first time
npx playwright install chromium   # only needed first time
node bot.js
```

### Run Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **Headless** | `node bot.js` | Fast run, no browser visible |
| **Headed** | `HEADLESS=false node bot.js` | See the browser in action |
| **Slow (for demo/recording)** | `HEADLESS=false SLOW_MO=500 STEP_DELAY=3000 node bot.js` | Slow enough to follow and record |

### What the Bot Does (11 Steps)

```
Step 1   Login as dc_bot
Step 2   Find first "Submitted" document in the queue
Step 3   Claim the document (status -> "In Review")
Step 4   Validate submittal detail fields (doc number, revision, file type, originator, date)
Step 5   Open the Load Datasheet
Step 6   Validate all datasheet fields (doc number, title, revision, file type, discipline)
Step 7   Check document integrity (format valid, not corrupted, size within limit)
Step 8   Create Incoming Transmittal (auto-generates TR-CP2-XXXX number)
Step 8b  Download Document & Run Validation (22 quality checks, OCR, error showcase)
         - Downloads PDF document locally to `downloads/` folder
         - Runs 22 comprehensive quality checks including OCR analysis
         - Validates contract numbers, document titles, and metadata
         - Demonstrates error capture with intentional test failures
         - Shows non-OCR document detection and contract mismatches
Step 9   Approve the submittal with revision number
Step 10  Set status to "Bot Reviewed" — STOPS here (human must click Complete)
```

### Bot Output

After each run, the bot generates:

| Output | Location |
|--------|----------|
| HTML Report | `hxgn-sdx-bot/bot/reports/report-{timestamp}.html` |
| JSON Log | `hxgn-sdx-bot/bot/reports/last-run-log.json` |
| Screenshots | `hxgn-sdx-bot/bot/screenshots/step01.png` to `step11.png` |
| Downloaded Documents | `hxgn-sdx-bot/bot/downloads/` (.pdf files) |
| Validation Results | `hxgn-sdx-bot/bot/reports/last-run-log.json` (includes validation checks) |
| Video Recording | `hxgn-sdx-bot/bot/videos/` (.webm file) |

### Re-running the Bot

The bot resets the database on every run, so it is fully re-runnable. Just run the same command again.

---

## Part 3: Launch the Document Validation Dashboard

The validation dashboard runs the 5-tier pipeline that checks document quality, metadata, and compliance.

### Step 1 — Start the Angular App

Open **Terminal 3** and run:

```bash
cd vg-cp2-doc-control
npm install        # only needed first time
npm start
```

You should see:
```
Angular Live Development Server is listening on localhost:4200
```

### Step 2 — Open the Dashboard

Open your browser and go to:

```
http://localhost:4200
```

### Step 3 — Login

| Field    | Value    |
|----------|----------|
| Username | `harsha` |
| Password | `test`   |

### Step 4 — Run Validation

There are **3 ways** to trigger document validation:

#### Option A: Run a Demo Scenario

1. Click the **Scenarios** tab
2. Choose a scenario:

| Scenario | Documents | Expected Result |
|----------|-----------|----------------|
| Valid Contract | 1 compliant doc | ACCEPT |
| Invalid Contract | 1 non-compliant doc | REJECT |
| Bulk Processing | 8 mixed docs | Mixed results |

3. Click **Run**
4. Watch the real-time terminal log with color-coded results

#### Option B: Upload Your Own Documents

1. Click the **Upload** tab
2. Drag and drop document files (PDF, DOCX, XLSX, TXT)
3. Upload a CSV loadsheet with document metadata
4. Click **Process**
5. The pipeline validates each document through all 5 tiers

#### Option C: Process from SDx Queue

1. Click the **Queue** tab
2. Click **Load** to fetch pending submittals from SDx
3. Click **Claim** on a submittal
4. Click **Process** to run the validation pipeline

### What the Validation Pipeline Checks (5 Tiers)

```
Tier 0 — Pre-flight (5 checks)
   File type, not empty, clean filename, no special chars, project prefix

Tier 1 — Metadata Extraction (15 checks)
   Contract number, title, revision, issue purpose, security class,
   document type, discipline, date, contractor, file naming convention

Tier 2 — Document Quality (12 checks)
   Text searchable, no blank pages, orientation, language, no drafts,
   no markups, proper structure, metadata on pages, rev/purpose alignment

Tier 2S — Submittal Checks (6 checks)
   Prior revision exists, not under review, revision history,
   same discipline in batch, same issue purpose, package completeness

Tier 3 — Transmittal Builder + Validation (9 checks)
   Auto-builds transmittal, validates TRN format, orgs, fields

Tier 4 — Decision Engine
   Score = (Pass / Total) x 100
   ACCEPT: 0 failures, warnings <= 3
   REVIEW: 0 failures, warnings > 3
   REJECT: any failure

Tier 5 — Final Gate (5 checks)
   All stages complete, compliance score, SDx readiness, audit trail
```

### Validation Dashboard Output

| Feature | Description |
|---------|-------------|
| Terminal Log | Real-time color-coded progress ([OK] green, [WARN] yellow, [ERR] red) |
| Audit Log | Table with decision, score, TRN, duration, pass/fail/warn counts |
| CSV Export | Click "Export CSV" to download the full audit trail |

---

## Quick Reference — All Three Systems

| System | URL | Terminal Command | Login |
|--------|-----|-----------------|-------|
| Hexagon SDx Dashboard | http://localhost:3000 | `cd hxgn-sdx-bot/mimic-app/backend && npm start` | dc_bot / BotPass2026! |
| SDx Automation Bot | (runs in terminal) | `cd hxgn-sdx-bot/bot && node bot.js` | (auto-login) |
| Validation Dashboard | http://localhost:4200 | `cd vg-cp2-doc-control && npm start` | harsha / test |

---

## Full Demo Sequence (Recommended Order)

1. **Start the Hexagon server** (Terminal 1)
   ```bash
   cd hxgn-sdx-bot/mimic-app/backend && npm start
   ```

2. **Start the validation dashboard** (Terminal 2)
   ```bash
   cd vg-cp2-doc-control && npm start
   ```

3. **Open both dashboards** in your browser
   - Tab 1: http://localhost:3000 (Hexagon SDx)
   - Tab 2: http://localhost:4200 (Validation Dashboard)

4. **Run the bot** (Terminal 3)
   ```bash
   cd hxgn-sdx-bot/bot && HEADLESS=false SLOW_MO=500 STEP_DELAY=3000 node bot.js
   ```
   Watch the bot automate the Hexagon portal in real time.

5. **Run a validation scenario** on the Validation Dashboard
   - Login as harsha/test
   - Go to Scenarios tab
   - Run "Valid Contract" or "Bulk Processing"
   - Watch the 5-tier pipeline in the terminal log

6. **Export results**
   - Bot: Open the HTML report from `hxgn-sdx-bot/bot/reports/`
   - Validation: Click "Export CSV" in the audit log

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 3000 already in use | Kill the old process: find PID with `netstat -ano \| grep :3000` then `taskkill /F /PID <pid>` |
| Port 4200 already in use | Same as above but for port 4200 |
| Bot fails at Step 1 | Make sure the mimic server is running at localhost:3000 |
| "chromium not found" | Run `npx playwright install chromium` in the bot folder |
| Angular won't start | Run `npm install` in the vg-cp2-doc-control folder |
| Bot runs too fast to see | Use `HEADLESS=false SLOW_MO=500 STEP_DELAY=3000` |

---

*VG CP2 Document Control Automation — Venture Global*
