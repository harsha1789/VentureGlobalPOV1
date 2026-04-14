import os
import json
import csv
import fitz


def create_ref_json_from_csv(csv_path, parent_dir):
    print(f"\n--- EXTRACTING REFERENCE METADATA FROM CSV ---")
    print(f"Reading {csv_path}...")
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [col.strip() for col in reader.fieldnames]
        for row in reader:
            # Build reference_data dynamically to capture ANY newly added columns
            reference_data = {}
            for col_name, value in row.items():
                if not col_name:
                    continue
                # Transform "Purchase Order number" -> "purchase_order_number"
                safe_key = col_name.strip().lower().replace(" ", "_").replace(".", "")
                reference_data[safe_key] = str(value).strip() if value else "NA"

            ref_data = {
                "reference_data": reference_data,
                "requirements": {
                    "check_blank_pages": True,
                    "check_ocr": True,
                    "check_consistency": True,
                },
            }
            doc_number = ref_data["reference_data"].get(
                "document_number", "metadata_reference"
            )
            json_filename = os.path.join(parent_dir, f"{doc_number}.json")
            with open(json_filename, "w") as out_f:
                json.dump(ref_data, out_f, indent=4)
            print(f"  [SUCCESS] Generated reference JSON from CSV: {json_filename}")
            return ref_data
    return None


def check_metadata(pdf_path, json_reference):
    doc = fitz.open(pdf_path)
    # Extract metadata dictionary
    meta = doc.metadata
    for page in doc:
        text = page.get_text().strip()
        if not text:
            # Potentially blank, check images
            if not page.get_images():
                print(f"Page {page.number} is blank")

    mismatches = []
    matches = []
    skipped = []
    # Compare with json_reference...
    if isinstance(json_reference, dict):
        data_to_check = json_reference.get("reference_data", json_reference)
        for key, expected_val in data_to_check.items():
            if key in meta:
                pdf_val = meta[key]
                if str(pdf_val).strip() != str(expected_val).strip():
                    err_msg = f"Metadata mismatch for '{key}': expected '{expected_val}', got '{pdf_val}'"
                    print(err_msg)
                    mismatches.append(err_msg)
                else:
                    matches.append(f"{key}: {pdf_val}")
            else:
                skipped.append(key)

    return meta, mismatches, matches, skipped


def filter_validation_issues(result, metadata_mismatches):
    filtered_issues = []
    filtered_raw_issues = []

    # PRESERVE BLANK PAGES that came from the AI analysis phase
    for existing_issue in result.get("issues", []):
        if "BLANK" in str(existing_issue).upper():
            filtered_issues.append(existing_issue)

    try:
        from dateutil import parser

        has_dateutil = True
    except ImportError:
        has_dateutil = False
        print("   [WARNING] 'python-dateutil' not found.")

    original_issues = result.get("raw_issues", [])
    for issue in original_issues:
        is_real_error = True
        found_norm = " ".join(str(issue.found).split()).strip().lower()
        expected_norm = " ".join(str(issue.expected).split()).strip().lower()

        if found_norm == expected_norm:
            is_real_error = False
            print(f"   [SYNC] Found visual match for '{issue.field}': '{issue.found}'")
        elif has_dateutil and "date" in issue.field.lower():
            try:
                if parser.parse(str(issue.found)) == parser.parse(str(issue.expected)):
                    is_real_error = False
                    print(f"   [DATE SYNC] '{issue.found}' matches '{issue.expected}'")
            except Exception:
                pass

        if is_real_error:
            filtered_raw_issues.append(issue)
            filtered_issues.append(
                f"ACCURACY ERROR (Page {issue.page}): '{issue.field}' found as '{issue.found}', expected '{issue.expected}'"
            )

    if result.get("non_ocr_pages"):
        non_ocr_msg = f"ERROR: Non-OCR (Plain Image) pages detected: {result.get('non_ocr_pages')}"
        filtered_issues.append(non_ocr_msg)
        print(f"   [REJECT] {non_ocr_msg}")

    if metadata_mismatches:
        for mismatch in metadata_mismatches:
            msg = f"NATIVE METADATA ERROR: {mismatch}"
            filtered_issues.append(msg)
            print(f"   [REJECT] {msg}")

    result["issues"] = filtered_issues
    result["raw_issues"] = filtered_raw_issues
    result["is_valid"] = len(filtered_issues) == 0


def generate_text_report(report_path, target_pdf_path, result, system_mode):
    is_valid = result.get("is_valid", False)
    status_text = "PASSED" if is_valid else "FAILED"
    lines = [
        "==================================================",
        "          COMPLIANCE VALIDATION REPORT            ",
        "==================================================",
        "",
        f"Document Name : {os.path.basename(target_pdf_path)}",
        f"System Mode   : {system_mode}",
        f"Final Status  : {status_text}",
        "",
        "--------------------------------------------------",
        "VALIDATION STEPS EXECUTED:",
        "1. Extracted payload matching JSON target layout",
        "2. Interrogated Native PDF Metadata",
        "3. Checked History table for 'Rev 1' sequentially",
        "4. Processed Pages visually and textually against AI",
        "--------------------------------------------------",
        "",
    ]

    lines.append("NATIVE PDF METADATA CHECKS:")
    if result.get("meta_matches"):
        for match_item in result["meta_matches"]:
            lines.append(f"  ✓ Validated natively: {match_item}")
    else:
        lines.append("  (No native metadata keys matching reference dynamically found)")
    lines.append("--------------------------------------------------\n")

    if is_valid:
        lines.append("SUMMARY:")
        lines.append("The document passed all compliance barriers smoothly.")
        lines.append("Action Taken: Task Approved & Transmittal Generated.")
    else:
        lines.append("SUMMARY OF ISSUES / DISCREPANCIES:")

        # 1. Blank Pages Section
        blank_pages = [i for i in result.get("issues", []) if "BLANK" in str(i).upper()]
        if blank_pages:
            lines.append("\n  [!] Blank pages:")
            for bp in blank_pages:
                lines.append(f"      - {bp}")

        # 2. Non OCR Images Section
        if result.get("non_ocr_pages"):
            lines.append(f"\n  [!] Non OCR images at pages:")
            for page in result.get("non_ocr_pages", []):
                lines.append(f"      - {page}")

        # 3. Other errors Section
        has_other = result.get("raw_issues") or any(
            "ERROR" in str(i).upper()
            and "NON-OCR" not in str(i).upper()
            and "BLANK" not in str(i).upper()
            for i in result.get("issues", [])
        )
        if has_other:
            lines.append("\n  [!] Other errors:")

            # Print AI object mismatches
            if result.get("raw_issues"):
                for issue in result.get("raw_issues", []):
                    lines.append(
                        f"      - Page {issue.page}: Mismatch in '{issue.field}' (Expected: '{issue.expected}', Found: '{issue.found}')"
                    )

            # Print raw string logs explicitly for metadata or miscellaneous exceptions
            string_logs = [
                i
                for i in result.get("issues", [])
                if "ERROR" in str(i).upper()
                and "NON-OCR" not in str(i).upper()
                and "BLANK" not in str(i).upper()
            ]
            for log in string_logs:
                lines.append(f"      - {log}")

        lines.append("\nAction Taken: Task Declined.")

        error_pdf = target_pdf_path.replace(".pdf", "_errors.pdf")
        if os.path.exists(error_pdf):
            lines.append(
                f"Artifact Saved: Highlighting generated in {os.path.basename(error_pdf)}"
            )

    lines.append("")
    lines.append("==================================================")
    lines.append("                 END OF REPORT                    ")
    lines.append("==================================================")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n[DONE] Professional TEXT report generated: {report_path}")
