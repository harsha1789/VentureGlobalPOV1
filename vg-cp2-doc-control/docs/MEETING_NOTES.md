Meeting Gist

  This was a knowledge transfer meeting between Venture Global's document control team (Autumn Hampton, Kirk, Bill Szeto) and
  Zensar's team (Chaitanya, Hrushikesh, Navneet, Gayathri, Anumeha, Patrick). The goal: Zensar needs to understand VG's          document control process — likely to explore automation opportunities.
                                                                                                                               
  ---
  The Flow (End-to-End Document Control Process)

  1. Document Submission

  - Contractors submit documents (PDFs, DWGs, Excel, Word, Navisworks, etc.) along with a CSV load sheet containing metadata.  
  - The system (Hexagon EDMS) runs basic automated validations on the load sheet and returns a validation report to the        
  contractor if errors are found.

  2. Claiming & Initial Review

  - A document controller claims a submittal from a shared to-do list.
  - They download the CSV load sheet and perform preliminary checks: file names, issue dates, submittal types, required        
  metadata.

  3. QA / Metadata & Content Validation (Mostly Manual)

  - Check for spaces in file names, correct issue dates, matching document numbers
  - Verify "reason for issue" aligns with the workflow
  - Confirm the document is OCR'd, correctly oriented, has no blank pages
  - For revisions: verify prior versions exist, and metadata (contract numbers, titles) matches across versions

  4. Pass or Reject

  - Pass → proceeds to transmittal issuance
  - Fail → rejected in the system, notification sent to submitter, plus a detailed email with rejection reason and resubmission
   request

  5. Transmittal & Distribution

  - Approved documents are issued on an incoming transmittal to internal teams based on preloaded distribution matrices        
  - Document status changes from "submitted" → "current"
  - Email notifications sent to all listed recipients
  - Document removed from the controller's to-do list

  ---
  Key Takeaways

  ┌──────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
  │     Area     │                                          Detail                                           │
  ├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Team size    │ < 10 document controllers, ~100 docs processed/day                                        │
  ├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Automation   │ Almost none — bulk of QA is manual                                                        │
  ├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ SOPs         │ No detailed work instructions exist; only a numbering procedure and an info exchange spec │
  ├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Templates    │ No standardized doc templates; contractors use their own formats                          │
  ├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Integrations │ Limited API-based links to SAP (maintenance/completion), mostly scheduled jobs            │
  ├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Backlog      │ Unprocessed docs just sit in the to-do list — no automated prioritization                 │
  └──────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘

  Follow-ups

  - Bill Szeto: Share reference docs, slide deck, and arrange test environment access
  - Autumn/Bill: Provide sample documents for Zensar's automation analysis

  The overall takeaway: this is a heavily manual, labor-intensive process with clear automation potential — which is likely why
   Zensar is engaged.