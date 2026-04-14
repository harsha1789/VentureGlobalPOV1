import os
import sys
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

from process_compliance_ai import GeminiComplianceSystem
from ui_actions import (
    perform_initial_ui_downloads,
    check_task_view_history,
    navigate_to_claimed_tasks,
    perform_final_ui_action,
)
from validation_helpers import (
    create_ref_json_from_csv,
    check_metadata,
    filter_validation_issues,
    generate_text_report,
)

load_dotenv(os.path.join(parent_dir, ".env"))


def main_workflow():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY environment variable not set.")
        return

    print("--- STARTING PLAYWRIGHT BROWSER AUTOMATION ---")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False, slow_mo=1500)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        # Step 1: Perform UI Navigation and target downloads
        export_path, target_pdf_path = perform_initial_ui_downloads(page, parent_dir)

        # Step 2: Validate the history entries in the browser UI
        check_task_view_history(page)

        # Step 3: Switch back to task view
        navigate_to_claimed_tasks(page)

        print("\n--- STARTING COMPLIANCE WORKFLOW ---")
        csv_loadsheet = export_path

        if not os.path.exists(csv_loadsheet):
            print(
                f"Workflow aborted: Could not find downloaded loadsheet at {csv_loadsheet}"
            )
            return

        if not target_pdf_path or not os.path.exists(target_pdf_path):
            print(
                f"Workflow aborted: Target PDF document {target_pdf_path} was not downloaded successfully."
            )
            return

        # Initialize AI System
        system = GeminiComplianceSystem(api_key)
        system.model_id = "gemini-2.5-flash"
        system.report_file = os.path.join(parent_dir, "Compliance_Report.txt")

        # Prepare payload
        ref_data = create_ref_json_from_csv(csv_loadsheet, parent_dir)
        if not ref_data:
            print("Workflow aborted: Failed to extract reference data from CSV.")
            return

        # Verification Sequence
        print(
            f"\n--- VALIDATING DOWNLOADED DOCUMENT {os.path.basename(target_pdf_path)} AGAINST REFERENCE ---"
        )

        meta, metadata_mismatches, meta_matches, meta_skipped = check_metadata(
            target_pdf_path, ref_data
        )
        result = system.validate_document(target_pdf_path, ref_data)

        # Inject metadata tracing data into result for logging visibility
        result["meta_matches"] = meta_matches
        result["meta_skipped"] = meta_skipped

        # Filtering logic
        filter_validation_issues(result, metadata_mismatches)
        is_valid = result.get("is_valid", False)

        if not is_valid:
            print("\n[REPORTING] Mismatches detected. Generating highlighted PDF...")
            system.generate_highlighted_pdf(target_pdf_path, result)

        # Output to UI
        perform_final_ui_action(page, is_valid)

        # Detail Printing
        print("\nDetailed Run Results:")
        print(f"Document: {result.get('filename', target_pdf_path)}")
        print(f"Status: {'PASSED' if is_valid else 'FAILED'}")
        for issue in result.get("issues", []):
            print(f"  - {issue}")

        # Produce Final .txt Report
        report_path = os.path.join(parent_dir, "Validation_Summary.txt")
        generate_text_report(report_path, target_pdf_path, result, system.model_id)

        print(
            "\nAutomation complete! Closing browser in 3 seconds to let you view it..."
        )
        page.wait_for_timeout(3000)
        context.close()
        browser.close()


if __name__ == "__main__":
    main_workflow()
