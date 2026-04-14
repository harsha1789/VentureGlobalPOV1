# VG CP2 LNG — Document Control Automation System

**Version:** 2.0.0
**Client:** Venture Global CP2 LNG
**Delivery Partner:** DP World Architecture Team
**Date:** April 2026

---

## Overview

An Angular 17 application that automates the HxGN SDx document control intake pipeline for Venture Global CP2 LNG. The system validates contractor-submitted documents through a four-tier pipeline — metadata extraction, document quality checks, transmittal auto-building, and decision routing — eliminating manual processing for compliant submissions.

**Target:** Reduce per-document processing from 13–23 minutes to under 2 minutes. Scale from 100 to 500+ documents/day with the same team of 10 Document Controllers.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start
# → http://localhost:4200

# Run Playwright E2E tests
npx playwright install
npm run e2e

# Build for production
npm run build:prod
```

**Demo credentials:** `harsha` / `test`

---

## Project Structure

```
vg-cp2-doc-control/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── login/           # Login screen — auth form + validation
│   │   │   ├── dashboard/       # Main shell — topbar + layout
│   │   │   ├── scenario-panel/  # Left sidebar — scenario selection + stats
│   │   │   ├── terminal/        # Live execution log terminal
│   │   │   └── audit-log/       # Audit table with export
│   │   ├── services/
│   │   │   ├── auth.service.ts          # Authentication + session management
│   │   │   ├── validation.service.ts    # Tier 1 + Tier 2 validation engine
│   │   │   ├── pipeline.service.ts      # Pipeline orchestration + audit log
│   │   │   └── contract-data.service.ts # Test contract data + scenarios
│   │   ├── models/
│   │   │   └── index.ts         # All TypeScript interfaces + constants
│   │   └── guards/
│   │       └── auth.guard.ts    # Route guard — redirects unauthenticated users
│   ├── styles.scss              # Global styles
│   └── index.html               # App shell
├── e2e/
│   └── demo.spec.ts             # Playwright E2E test suite (40+ tests)
├── docs/
│   ├── ARCHITECTURE.md          # System architecture + design decisions
│   ├── VALIDATION_RULES.md      # All validation rules documented
│   ├── AI_STRATEGY.md           # Where AI fits vs automation
│   └── DEPLOYMENT.md            # Azure deployment guide
└── playwright.config.ts         # Playwright configuration
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 17 (standalone components) |
| Language | TypeScript 5.2 |
| Styling | SCSS with CSS custom properties |
| State | Angular Signals |
| Routing | Angular Router with AuthGuard |
| Testing | Playwright (E2E) + Karma/Jasmine (unit) |
| Fonts | IBM Plex Mono · Syne · DM Sans |

---

## The Four-Tier Pipeline

```
Contractor submits document
         ↓
T1 — Metadata validation    (regex extraction, 15 field checks)
         ↓
T2 — Document quality       (structural + content checks, 12 checks)
         ↓
T3 — Transmittal builder    (auto-construct from extracted fields)
         ↓
T4 — Decision engine        (accept / review / reject)
         ↓
  ┌──────┼──────┐
ACCEPT  REVIEW  REJECT
```

See `docs/ARCHITECTURE.md` for full details.

---

## Test Scenarios

| Scenario | Documents | Expected Outcome |
|---|---|---|
| Valid Contract | 1 | ACCEPTED — score 80+ |
| Invalid Contract | 1 | REJECTED — multiple T1 failures |
| Bulk Processing | 8 | Mixed — 4 accepted, 3 rejected, 1 review |

---

## Playwright Tests

40+ automated tests covering:
- Authentication (valid/invalid credentials, session management, route guarding)
- All three scenarios end-to-end
- Audit log (clear, export CSV, record count)
- Full login → process → logout flow

```bash
# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test file
npx playwright test e2e/demo.spec.ts

# View HTML report
npx playwright show-report
```

---

## Key Design Decisions

**Why Angular Signals over NgRx?**
The state in this application is simple and synchronous. Signals provide reactive state without the overhead of a full Redux-style store. The pipeline service exposes `signal<AuditRecord[]>()` directly consumed by components.

**Why no AI in the current build?**
Tier 1 and Tier 2 checks are deterministic. Adding an LLM to binary field matching (document number present or not) adds latency, cost, and probabilistic uncertainty where none is needed. AI enters in Phase 2 — see `docs/AI_STRATEGY.md`.

**Why standalone components?**
Angular 17 standalone components are the current best practice. No NgModule boilerplate, cleaner dependency injection, better tree-shaking.

---

## Roadmap

| Phase | Scope | Timeline |
|---|---|---|
| Phase 1 (current) | Deterministic validation, demo UI | Weeks 1–4 |
| Phase 2 | Azure Document Intelligence integration | Weeks 5–7 |
| Phase 3 | SDx API write-back (Tier 3/4 live) | Weeks 8–10 |
| Phase 4 | Vision LLM for template-agnostic validation | Weeks 11–14 |

---

*Prepared by DP World Architecture Team · April 2026*
