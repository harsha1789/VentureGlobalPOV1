# Error Documentation for VG CP2 Document Control

This document outlines common errors encountered during document validation, particularly in OCR-based checks inspired by the VGL_OCR project (https://github.com/athrvzoz/VGL_OCR). It provides error codes, descriptions, causes, and resolution steps.

---

## Error Categories

### 1. Metadata Validation Errors

#### ERR-META-001: Metadata Mismatch
**Description:** Native PDF metadata does not match the reference data from the loadsheet.

**Common Fields Affected:**
- Document Number
- Revision
- Issue Date
- Document Title
- Classification

**Cause:** Incorrect metadata embedding during document creation or editing.

**Resolution:**
1. Open the PDF in Adobe Acrobat or similar tool.
2. Go to File > Properties > Description tab.
3. Update the incorrect metadata fields.
4. Save the document.
5. Re-submit for validation.

#### ERR-META-002: Missing Metadata Field
**Description:** Required metadata field is not present in the PDF.

**Cause:** Document was created without proper metadata or metadata was stripped.

**Resolution:**
1. Use PDF editing software to add the missing metadata.
2. Ensure all required fields are populated as per validation rules.

---

### 2. OCR and Content Validation Errors

#### ERR-OCR-001: Text Extraction Failure
**Description:** OCR failed to extract readable text from the document.

**Cause:** 
- Scanned image without OCR layer
- Poor image quality
- Unsupported font or encoding

**Resolution:**
1. Ensure the document has a text layer (not just images).
2. If scanned, perform OCR using tools like Adobe Acrobat or ABBYY FineReader.
3. Re-save as searchable PDF.

#### ERR-OCR-002: Content Mismatch
**Description:** Extracted text does not match expected reference values.

**Common Issues:**
- Wrong revision number on internal pages
- Incorrect document number
- Date format discrepancies

**Cause:** Manual editing errors or template inconsistencies.

**Resolution:**
1. Review all pages of the document for consistency.
2. Correct any mismatched fields.
3. Ensure headers/footers match the reference data.

#### ERR-OCR-003: Blank Page Detected
**Description:** Document contains completely blank pages.

**Cause:** Extra pages added accidentally or scanning artifacts.

**Resolution:**
1. Remove blank pages from the document.
2. Re-save and re-submit.

#### ERR-OCR-004: Non-OCR Page (Image Only)
**Description:** Page contains only images without extractable text.

**Cause:** Scanned pages without OCR processing.

**Resolution:**
1. Perform OCR on the image-only pages.
2. Convert to searchable text.
3. Re-submit the document.

---

### 3. File and Naming Errors

#### ERR-FILE-001: Invalid File Name
**Description:** File name contains forbidden characters or doesn't follow naming convention.

**Forbidden Characters:** `~ / \ @ & % ! # $ ^ * ( ) + = { } [ ] | < > ?`

**Expected Format:** `[PROJECT]-[CONTRACTOR]-[DOCTYPE]-[DISCIPLINE]-[SEQNO]-[REV].[ext]`

**Resolution:**
1. Rename the file to match the convention.
2. Remove any special characters.
3. Ensure extension is .pdf or allowed type.

#### ERR-FILE-002: Document Number Mismatch
**Description:** Document number in content doesn't match file name.

**Resolution:**
1. Verify the document number in the PDF content.
2. Rename file to match, or correct the content.

---

### 4. Batch and Submission Errors

#### ERR-BATCH-001: Mixed Disciplines
**Description:** Batch contains documents from different disciplines.

**Valid Disciplines:** CMS, CIV, CME, ELE, INS, MEC, PIP, STR, PRO, HSE, QA, PUR

**Resolution:**
1. Separate documents by discipline.
2. Submit in separate batches.

#### ERR-BATCH-002: Inconsistent Issue Purpose
**Description:** Documents in batch have different issue purposes.

**Valid Codes:** IFU, IFI, IFC, IFR, IFT, AFC, AFD, IFA, PUR

**Resolution:**
1. Ensure all documents have the same issue purpose.
2. For superseding documents, note the exception.

---

### 5. System and Processing Errors

#### ERR-SYS-001: API Rate Limit Exceeded
**Description:** OCR service rate limit hit during processing.

**Cause:** Too many requests to Gemini AI or similar service.

**Resolution:**
1. Wait 15-25 seconds and retry.
2. Reduce batch size if processing large volumes.

#### ERR-SYS-002: PDF Open Error
**Description:** Unable to open or process the PDF file.

**Cause:** Corrupted file, unsupported format, or password protection.

**Resolution:**
1. Check if PDF is corrupted.
2. Remove password protection if present.
3. Ensure PDF is not encrypted.

#### ERR-SYS-003: Network Error
**Description:** Unable to download reference loadsheet or access external resources.

**Resolution:**
1. Check internet connection.
2. Verify URLs are accessible.
3. Retry the operation.

---

## Error Reporting and Highlighting

When errors are detected, the system may generate:
- **Text Report:** Detailed summary in Validation_Summary.txt
- **Highlighted PDF:** Copy of document with errors marked in red (_errors.pdf)

Review these artifacts to locate and correct issues.

---

## Prevention Tips

1. **Use Consistent Templates:** Ensure all documents use approved templates with correct metadata.
2. **Perform OCR Early:** Convert scanned documents to searchable PDFs before submission.
3. **Double-Check Metadata:** Verify PDF properties before uploading.
4. **Batch Appropriately:** Group documents by discipline and issue purpose.
5. **Test Submissions:** Use the validation system to check documents before final submission.

---

## References

- [VGL_OCR Project](https://github.com/athrvzoz/VGL_OCR) - Source of OCR validation logic
- Validation Rules Reference
- Validation Service Documentation