/**
 * Seed script — resets and pre-populates the in-memory data store.
 * Run via: node seed.js   (or: npm run seed)
 * Also called programmatically by server.js on startup.
 *
 * Demo seed: exactly two submittals — one positive (passes all checks),
 * one invalid (image-only PIP doc with wrong contract number). Keeps the
 * To Do table clean so the audience sees only the two rows being processed.
 */

const { v4: uuidv4 } = require('uuid');

function createSeedData() {
  const submittals = [
    // === POSITIVE: Well-formed PDF — all checks pass ===
    {
      id: uuidv4(),
      documentNumber: 'VG-CP2-MEC-DWG-0001',
      title: 'Mechanical Equipment Layout — Train 1',
      revision: 'A',
      fileType: 'PDF',
      discipline: 'Mechanical',
      originator: 'Worley Engineering',
      submittedBy: 'John.Smith@worley.com',
      submissionDate: '2026-04-01',
      status: 'Review Submittal',
      claimedBy: null,
      transmittalNumber: null,
      approved: false,
      stepName: 'Review Submittal',
      submittalDescription: 'Mechanical Equipment Layout Drawing for Train 1 - For Review',
      reasonForIssue: 'For Review',
      submittalType: 'Submittal',
      targetDate: '2026-04-15',
      priority: '2',
      contract: 'C2 EPC - BOP',
      fromOrganisation: 'WOR',
      toOrganisation: 'PRJ',
      datasheet: {
        documentNumber: 'VG-CP2-MEC-DWG-0001',
        title: 'Mechanical Equipment Layout — Train 1',
        revision: 'A',
        fileType: 'PDF',
        discipline: 'Mechanical'
      },
      document: {
        fileName: 'VG-CP2-MEC-DWG-0001_RevA.pdf',
        fileFormat: 'PDF',
        fileSizeKB: 2450,
        corrupted: false,
        textContent: 'CONTRACT NUMBER: VG-CP2-MEC-DWG-0001\nDOCUMENT TITLE: Mechanical Equipment Layout — Train 1\nREVISION NUMBER: Rev A\nISSUE PURPOSE: IFR — Issued for Review\nSECURITY CLASSIFICATION: Company Use\nDOCUMENT TYPE: DWG — Drawing\nDISCIPLINE CODE: MEC — Mechanical\nDOCUMENT DATE: 01 April 2026\nFROM ORGANISATION: WOR — Worley Group Pty Ltd\nPROJECT: Engineering Project — C2 EPC-BOP\nSECOND COVER PAGE — DOCUMENT CONTROL INFORMATION\nSDx Project Area: C2\nPrepared by: J. Smith    Date: 01-Apr-2026\nReviewed by: A. Kumar    Date: 02-Apr-2026\nApproved by: M. Brennan  Date: 03-Apr-2026\nREVISION HISTORY\nA  01-Apr-2026  First Issue\n1. SCOPE\nThis drawing shows the mechanical equipment layout for Train 1 under Contract C2 EPC-BOP.\n2. REFERENCES\nAll equipment shall be installed per project specifications.\nEND OF DOCUMENT\nDocument: VG-CP2-MEC-DWG-0001 | Revision: A | Company Use'
      }
    },
    // === NEGATIVE: Image-only scanned PDF with wrong contract number ===
    {
      id: uuidv4(),
      documentNumber: 'VG-CP2-PIP-DWG-0112',
      title: 'Piping Isometric — Scanned Drawing Area 400',
      revision: 'A',
      fileType: 'PDF',
      discipline: 'Piping',
      originator: 'Worley Engineering',
      submittedBy: 'Mike.Chen@worley.com',
      submissionDate: '2026-04-05',
      status: 'Review Submittal',
      claimedBy: null,
      transmittalNumber: null,
      approved: false,
      stepName: 'Review Submittal',
      submittalDescription: 'Piping Isometric Drawing (Scanned) - For Review',
      reasonForIssue: 'For Review',
      submittalType: 'Submittal',
      targetDate: '2026-04-20',
      priority: '2',
      contract: 'C2 EPC - BOP',
      fromOrganisation: 'WOR',
      toOrganisation: 'PRJ',
      datasheet: {
        documentNumber: 'VG-CP2-PIP-DWG-0112',
        title: 'Piping Isometric — Scanned Drawing Area 400',
        revision: 'A',
        fileType: 'PDF',
        discipline: 'Piping'
      },
      document: {
        fileName: 'VG-CP2-PIP-DWG-0112_RevA.pdf',
        fileFormat: 'PDF',
        fileSizeKB: 8540,
        corrupted: false,
        textContent: '%PDF-1.4 img obj stream'
      }
    }
  ];

  const users = [
    {
      username: process.env.BOT_USERNAME || 'dc_bot',
      password: process.env.BOT_PASSWORD || 'BotPass2026!',
      displayName: 'DC Automation Bot'
    },
    {
      username: 'admin',
      password: 'Admin2026!',
      displayName: 'System Admin'
    }
  ];

  return { submittals, users };
}

module.exports = { createSeedData };

// Allow standalone execution
if (require.main === module) {
  const data = createSeedData();
  console.log('Seed data generated:');
  console.log(`  Submittals: ${data.submittals.length}`);
  console.log(`  Users: ${data.users.length}`);
  data.submittals.forEach(s => {
    console.log(`    - ${s.documentNumber} [${s.status}]`);
  });
}
