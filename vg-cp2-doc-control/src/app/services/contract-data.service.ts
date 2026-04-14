import { Injectable } from '@angular/core';
import { ContractDocument, Scenario } from '../models';

@Injectable({ providedIn: 'root' })
export class ContractDataService {

  readonly scenarios: Scenario[] = [
    {
      id: 'valid',
      label: 'Valid Contract',
      description: 'Well-formed SOW with all mandatory fields. Expects auto-approve outcome.',
      badge: 'VALID',
      docCount: 1,
      chips: ['1 doc', 'C2-WOR-SOW', 'T1+T2+T3+T4'],
    },
    {
      id: 'invalid',
      label: 'Invalid Contract',
      description: 'Missing contract number, revision, issue purpose, security class. Expects auto-reject.',
      badge: 'INVALID',
      docCount: 1,
      chips: ['1 doc', 'No metadata', 'T1 FAIL'],
    },
    {
      id: 'bulk',
      label: 'Bulk Processing',
      description: '8 mixed contracts processed sequentially — valid, invalid, and edge-case variants.',
      badge: 'BULK',
      docCount: 8,
      chips: ['8 docs', 'Mixed', 'Sequential'],
    },
    {
      id: 'pdf',
      label: 'PDF Document Checks',
      description: '5 PDF documents — valid, invalid, image-only (OCR fail), markup, and orientation issues.',
      badge: 'PDF',
      docCount: 5,
      chips: ['5 docs', 'PDF checks', 'OCR test'],
    },
  ];

  readonly validContract: ContractDocument = {
    name: 'C2-WOR-SOW-0042.txt',
    type: 'valid',
    text: `================================================================================
VENTURE GLOBAL CP2 LNG
CONTRACT DOCUMENT
================================================================================
CONTRACT NUMBER:        C2-WOR-SOW-0042
DOCUMENT TITLE:         Statement of Work — Piping and Mechanical Installation for C2 EPC-BOP Package
REVISION NUMBER:        Rev A
ISSUE PURPOSE:          IFR — Issued for Review
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE:          SOW — Statement of Work
DISCIPLINE CODE:        MEC — Mechanical
DOCUMENT DATE:          01 April 2026
EFFECTIVE DATE:         01 April 2026
FROM ORGANISATION:      WOR — Worley Group Pty Ltd
TO ORGANISATION:        VGL — Venture Global LNG Inc.
FROM ROLE:              Contractor Document Control
SUBMITTED BY:           James R. Harrington, Lead Document Controller
PROJECT:                Venture Global CP2 LNG — C2 EPC-BOP

================================================================================
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
================================================================================
SDx Project Area:       C2
Contract Reference:     C2 EPC-BOP
Transmittal Reference:  TRN-C2-WOR-2026-0042
Previous Revision:      — (First Issue)
Page Count:             14 pages
Native File Format:     Microsoft Word (.docx)
Language:               English

Prepared by:    James R. Harrington          Date: 01-Apr-2026
Reviewed by:    Sarah K. Okonkwo             Date: 02-Apr-2026
Approved by:    Michael T. Brennan           Date: 03-Apr-2026

================================================================================
REVISION HISTORY
================================================================================
Rev    Date           Description                          Author
----   ----------     --------------------------------     -------------------
A      01-Apr-2026    First Issue — Issued for Review      J. Harrington

================================================================================
1. SCOPE OF WORK
================================================================================
This Statement of Work defines the scope of piping and mechanical installation
services to be performed by Worley Group Pty Ltd under Contract C2 EPC-BOP.

The Contractor shall supply all labour, supervision, tools, equipment, and
temporary works required to complete the mechanical and piping installation
activities in accordance with project engineering documents and applicable codes.

================================================================================
2. DELIVERABLES
================================================================================
All documents must comply with Naming Convention Procedure VGL-DC-NCP-001, Rev 4.

================================================================================
3. HEALTH, SAFETY AND ENVIRONMENT
================================================================================
All workers shall comply with VGL HSE Management System requirements.

================================================================================
END OF DOCUMENT
================================================================================
Document: C2-WOR-SOW-0042 | Revision: A | Date: 01 April 2026 | Company Use
`,
  };

  readonly invalidContract: ContractDocument = {
    name: 'WOR_doc_final_v3_SEND.txt',
    type: 'invalid',
    text: `WORLEY GROUP
INTERNAL DOCUMENT

Title: Piping Work Scope

Prepared by: Dave
Date: sometime in March

This document describes the scope of piping work to be carried out at the
LNG facility. Workers should follow standard procedures at all times.

The work includes installing pipes of various sizes across different areas
of the plant. All welding must be done properly and tested before use.

Safety is important. Workers must wear PPE at all times. Any incidents
should be reported to the supervisor immediately.

1. SCOPE
Install pipes. Connect flanges. Test for leaks.

2. MATERIALS
Use approved materials only.

3. SCHEDULE
Work should be completed as soon as possible.

- Dave
`,
  };

  readonly bulkContracts: ContractDocument[] = [
    this.validContract,
    this.invalidContract,
    {
      name: 'C2-WOR-MDR-0018.txt', type: 'valid',
      text: `CONTRACT NUMBER: C2-WOR-MDR-0018
DOCUMENT TITLE: Master Document Register — Mechanical Systems
REVISION NUMBER: Rev B
ISSUE PURPOSE: IFU — Issued for Use
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE: MDR — Master Document Register
DISCIPLINE CODE: CMS — Configuration Management
DOCUMENT DATE: 02 April 2026
FROM ORGANISATION: WOR — Worley
PROJECT: VG CP2 LNG — C2 EPC-BOP
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
SDx Project Area: C2
Prepared by: S. Okonkwo    Date: 02-Apr-2026
Reviewed by: M. Brennan   Date: 03-Apr-2026
REVISION HISTORY
B  02-Apr-2026  Updated register for Phase 2
END OF DOCUMENT
Document: C2-WOR-MDR-0018 | Company Use`,
    },
    {
      name: 'C2-WOR-DWG-0099.txt', type: 'invalid',
      text: `DRAWING TITLE: Piping Layout
Prepared: March 2026
This drawing shows the layout of piping systems in building 3.
All measurements are approximate. Refer to latest revision for accuracy.
Note: This is a preliminary sketch only. DRAFT — NOT FOR CONSTRUCTION`,
    },
    {
      name: 'C2-WOR-SPE-0031.txt', type: 'valid',
      text: `CONTRACT NUMBER: C2-WOR-SPE-0031
DOCUMENT TITLE: Technical Specification — Welding Procedure Specification
REVISION NUMBER: Rev C
ISSUE PURPOSE: AFC — Approved for Construction
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE: SPE — Specification
DISCIPLINE CODE: MEC — Mechanical
DOCUMENT DATE: 28 March 2026
FROM ORGANISATION: WOR — Worley
PROJECT: Venture Global CP2 LNG
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
SDx Project Area: C2
Prepared by: K. Patel    Date: 28-Mar-2026
Reviewed by: J. Singh    Date: 29-Mar-2026
Approved by: A. Chen     Date: 30-Mar-2026
REVISION HISTORY
C  28-Mar-2026  Approved for Construction
B  14-Feb-2026  Issued for Review
A  10-Jan-2026  First Issue
END OF DOCUMENT
Security: Company Use`,
    },
    {
      name: 'ENG_REVIEW_DRAFT.txt', type: 'invalid',
      text: `Engineering Review Notes - DRAFT
Meeting held on 15th March.
Action items discussed:
- Review pipe sizing calculations
- Confirm material grades with procurement
These are informal notes only. FOR REVIEW ONLY — NOT FOR DISTRIBUTION`,
    },
    {
      name: 'C2-WOR-PRO-HSE-001.txt', type: 'valid',
      text: `CONTRACT NUMBER: C2-WOR-PRO-HSE-001
DOCUMENT TITLE: Construction HSE Management Plan
REVISION NUMBER: Rev A
ISSUE PURPOSE: IFI — Issued for Information
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE: PRO — Procedure
DISCIPLINE CODE: HSE — Health Safety Environment
DOCUMENT DATE: 01 April 2026
FROM ORGANISATION: WOR — Worley
PROJECT: VG CP2 LNG C2 EPC-BOP
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
SDx Project Area: C2
Prepared by: A. Williams  Date: 01-Apr-2026
Reviewed by: B. Thompson  Date: 02-Apr-2026
REVISION HISTORY
A  01-Apr-2026  Initial Issue
END OF DOCUMENT
Company Use`,
    },
    {
      name: 'misc_notes_final2.txt', type: 'invalid',
      text: `misc notes from site visit
need to check valve specs
talk to procurement about delivery dates
weather was bad last week, lost 2 days
reminder: submit timesheets by friday
also need to order more PPE
site access cards expiring soon for 3 people`,
    },
  ];

  // ── PDF SCENARIO DOCUMENTS ──────────────────────────────────────────────────

  /** 1. POSITIVE — Well-formed PDF with all metadata, passes every check */
  readonly pdfValidComplete: ContractDocument = {
    name: 'C2-WOR-REP-0055.pdf',
    type: 'valid',
    text: `================================================================================
VENTURE GLOBAL CP2 LNG
CONTRACT DOCUMENT
================================================================================
CONTRACT NUMBER:        C2-WOR-REP-0055
DOCUMENT TITLE:         Inspection Test Report — Piping Hydrostatic Test Package HT-003
REVISION NUMBER:        Rev A
ISSUE PURPOSE:          IFR — Issued for Review
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE:          REP — Report
DISCIPLINE CODE:        PIP — Piping
DOCUMENT DATE:          05 April 2026
EFFECTIVE DATE:         05 April 2026
FROM ORGANISATION:      WOR — Worley Group Pty Ltd
TO ORGANISATION:        VGL — Venture Global LNG Inc.
FROM ROLE:              Contractor Document Control
SUBMITTED BY:           Claire N. Dubois, Senior Document Controller
PROJECT:                Venture Global CP2 LNG — C2 EPC-BOP

================================================================================
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
================================================================================
SDx Project Area:       C2
Contract Reference:     C2 EPC-BOP
Transmittal Reference:  TRN-C2-WOR-2026-0055
Previous Revision:      — (First Issue)
Page Count:             8 pages
Native File Format:     PDF
Language:               English

Prepared by:    Claire N. Dubois              Date: 05-Apr-2026
Reviewed by:    Tomasz J. Kowalski            Date: 06-Apr-2026
Approved by:    Priya R. Nair                 Date: 07-Apr-2026

================================================================================
REVISION HISTORY
================================================================================
Rev    Date           Description                          Author
----   ----------     --------------------------------     -------------------
A      05-Apr-2026    First Issue — Issued for Review      C. Dubois

================================================================================
1. PURPOSE
================================================================================
This report documents the hydrostatic test results for piping package HT-003
in Area 200 of the CP2 LNG facility under Contract C2 EPC-BOP.

================================================================================
2. TEST RESULTS
================================================================================
All tested spools achieved and maintained the required test pressure of 1.5x
design pressure for a minimum hold period of 30 minutes with no visible leaks.

================================================================================
3. CONCLUSION
================================================================================
All piping spools in package HT-003 have passed hydrostatic testing and are
cleared for insulation and commissioning activities.

================================================================================
END OF DOCUMENT
================================================================================
Document: C2-WOR-REP-0055 | Revision: A | Date: 05 April 2026 | Company Use
`,
  };

  /** 2. POSITIVE — Valid PDF with revision history (Rev B), passes all checks */
  readonly pdfValidRevB: ContractDocument = {
    name: 'C2-WOR-ITP-0019.pdf',
    type: 'valid',
    text: `================================================================================
VENTURE GLOBAL CP2 LNG
CONTRACT DOCUMENT
================================================================================
CONTRACT NUMBER:        C2-WOR-ITP-0019
DOCUMENT TITLE:         Inspection and Test Plan — Structural Steel Erection
REVISION NUMBER:        Rev B
ISSUE PURPOSE:          IFC — Issued for Construction
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE:          ITP — Inspection and Test Plan
DISCIPLINE CODE:        STR — Structural
DOCUMENT DATE:          03 April 2026
FROM ORGANISATION:      WOR — Worley Group Pty Ltd
TO ORGANISATION:        VGL — Venture Global LNG Inc.
PROJECT:                Venture Global CP2 LNG — C2 EPC-BOP

================================================================================
SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
================================================================================
SDx Project Area:       C2
Contract Reference:     C2 EPC-BOP
Transmittal Reference:  TRN-C2-WOR-2026-0019
Previous Revision:      Rev A
Page Count:             12 pages
Native File Format:     PDF
Language:               English

Prepared by:    Raj K. Mehta                  Date: 03-Apr-2026
Reviewed by:    Lisa M. O'Brien               Date: 04-Apr-2026
Approved by:    David W. Chang                Date: 05-Apr-2026

================================================================================
REVISION HISTORY
================================================================================
Rev    Date           Description                          Author
----   ----------     --------------------------------     -------------------
B      03-Apr-2026    Issued for Construction              R. Mehta
A      15-Feb-2026    First Issue — Issued for Review      R. Mehta

================================================================================
1. SCOPE
================================================================================
This Inspection and Test Plan covers the erection and bolting of structural
steel members for Area 100 modules under Contract C2 EPC-BOP.

================================================================================
2. INSPECTION HOLD POINTS
================================================================================
2.1 Foundation bolt torque verification — Hold Point
2.2 Column plumb and alignment — Hold Point
2.3 Final bolt tensioning — Witness Point

================================================================================
3. ACCEPTANCE CRITERIA
================================================================================
All structural connections shall comply with AISC 360-22 and project
specification C2-WOR-SPE-0012.

================================================================================
END OF DOCUMENT
================================================================================
Document: C2-WOR-ITP-0019 | Revision: B | Date: 03 April 2026 | Company Use
`,
  };

  /** 3. NEGATIVE — Image-only scanned PDF, fails OCR / Text Searchability */
  readonly pdfImageOnly: ContractDocument = {
    name: 'C2-WOR-DWG-0112.pdf',
    type: 'invalid',
    text: `%PDF-1.4 img obj stream`,
  };

  /** 4. NEGATIVE — PDF with review markups and annotations present */
  readonly pdfWithMarkups: ContractDocument = {
    name: 'C2-WOR-CAL-0037.pdf',
    type: 'invalid',
    text: `================================================================================
VENTURE GLOBAL CP2 LNG
CONTRACT DOCUMENT
================================================================================
CONTRACT NUMBER:        C2-WOR-CAL-0037
DOCUMENT TITLE:         Calculation Report — Foundation Loading Analysis Area 300
REVISION NUMBER:        Rev A
ISSUE PURPOSE:          IFR — Issued for Review
SECURITY CLASSIFICATION: Company Use
DOCUMENT TYPE:          CAL — Calculation
DISCIPLINE CODE:        CIV — Civil
DOCUMENT DATE:          02 April 2026
FROM ORGANISATION:      WOR — Worley Group Pty Ltd
PROJECT:                Venture Global CP2 LNG — C2 EPC-BOP

SECOND COVER PAGE — DOCUMENT CONTROL INFORMATION
SDx Project Area:       C2
Contract Reference:     C2 EPC-BOP
Prepared by:    H. Tanaka    Date: 02-Apr-2026
Reviewed by:    F. Al-Rashid Date: 03-Apr-2026

REVISION HISTORY
A  02-Apr-2026  First Issue

1. INTRODUCTION
This calculation report presents the foundation loading analysis for Area 300.

[COMMENT] Reviewer: Please double-check the soil bearing capacity assumption — seems low.
[MARKUP] Highlighted section 2.3 for further review.
/Annots [<< /Type /Annot /Subtype /Text /Contents (Need to verify load case LC-04) >>]

2. DESIGN INPUTS
Soil bearing capacity: 150 kPa (assumed)
Seismic zone: Zone 2A per IBC 2021

3. RESULTS
All foundations satisfy the required safety factor of 2.5.

END OF DOCUMENT
Document: C2-WOR-CAL-0037 | Company Use`,
  };

  /** 5. NEGATIVE — PDF with wrong contract, missing security class, DRAFT watermark, and garbled orientation characters */
  readonly pdfMultipleFailures: ContractDocument = {
    name: 'C2-KBR-PID-0044.pdf',
    type: 'invalid',
    text: `DRAWING PACKAGE
DOCUMENT TITLE:  P&ID — Condensate Recovery Unit
REVISION NUMBER: Rev 0
ISSUE PURPOSE:   AFC — Approved for Construction
DOCUMENT TYPE:   PID
DISCIPLINE CODE: PRO — Process
DOCUMENT DATE:   March 2026
FROM ORGANISATION: KBR
PROJECT:          Cameron LNG Expansion

This document contains the process and instrumentation diagrams for the
condensate recovery unit. DRAFT — NOT FOR CONSTRUCTION.

Prepared by: T. Wilson

Ÿ±®©¤£¥Ð×Þßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ¡¢¤¦§¨ª«¬®¯°±²³µ¶·¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊË
ÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß

Note: security classification not assigned yet.
No revision history available for this issue.
`,
  };

  readonly pdfContracts: ContractDocument[] = [
    this.pdfValidComplete,
    this.pdfValidRevB,
    this.pdfImageOnly,
    this.pdfWithMarkups,
    this.pdfMultipleFailures,
  ];

  getDocumentsForScenario(scenarioId: string): ContractDocument[] {
    if (scenarioId === 'valid')   return [this.validContract];
    if (scenarioId === 'invalid') return [this.invalidContract];
    if (scenarioId === 'bulk')    return this.bulkContracts;
    if (scenarioId === 'pdf')     return this.pdfContracts;
    return [];
  }
}
