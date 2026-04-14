import os


def perform_initial_ui_downloads(page, parent_dir):
    print("1. Navigating to http://localhost:4200/")
    page.goto("http://localhost:4200/")
    page.wait_for_selector(".data-table tbody tr")
    print("2. Clicking on the first task in C2 project...")
    page.locator(".data-table tbody tr").first.click()
    print("2b. Claiming the Task...")
    page.locator(".sp-action:has-text('Claim Task')").click()
    page.wait_for_timeout(500)
    print("3a. In Task section, clicking on 'Export Data' option...")
    with page.expect_download() as download_info:
        page.locator(".sp-action:has-text('Export Data')").click()
    export_path = os.path.join(parent_dir, download_info.value.suggested_filename)
    download_info.value.save_as(export_path)
    print(f"   ✓ Exported data saved to: {export_path}")

    print("3b. Going to FILES tab...")
    page.locator(".sp-tab:has-text('FILES')").click()
    print("3c. Downloading the file from Attachments...")
    with page.expect_download() as download_info2:
        page.locator(".sp-body .sp-action").first.click()
    target_pdf_path = os.path.join(
        parent_dir, f"attachment_{download_info2.value.suggested_filename}"
    )
    download_info2.value.save_as(target_pdf_path)
    print(f"   ✓ Attachment saved to: {target_pdf_path}")
    return export_path, target_pdf_path


def check_task_view_history(page):
    print("4. Switching back to TASK tab to perform approval/decline...")
    page.locator(".sp-tab:has-text('TASK')").click()
    print("4b. Opening View History and validating revisions...")
    page.locator(".sp-action:has-text('View History')").click()
    page.wait_for_selector(".history-full-page-table")
    history_rows = page.locator(".history-full-page-table tbody tr")
    row_count = history_rows.count()
    print(f"   -> Found {row_count} history entries.")
    for i in range(row_count):
        rev_text = history_rows.nth(i).locator("td").nth(4).inner_text()
        name_text = history_rows.nth(i).locator(".link-cell").inner_text()
        print(f"      ✓ Row {i+1}: Revision {rev_text} | Name: {name_text}")
        if i == 0:
            assert "1" in rev_text, f"Expected Rev 1 in first row, got {rev_text}"
        elif i == 1:
            assert "0" in rev_text, f"Expected Rev 0 in second row, got {rev_text}"
    print("   -> Validation complete. Returning to Dashboard...")
    page.locator(".toolbar-btn:has-text('BACK')").click()
    print("   ✓ view history found and content valid checks")


def navigate_to_claimed_tasks(page):
    print("4c. Navigating to 'Personal Claimed Tasks' to prepare for final action...")
    page.locator(".nav-item:has-text('Personal Claimed Tasks')").click()
    page.wait_for_timeout(1000)
    page.locator(".data-table tbody tr").first.click()
    page.locator(".sp-tab:has-text('TASK')").click()


def perform_final_ui_action(page, is_valid):
    print("\n" + "=" * 50)
    if is_valid:
        print("                       ACCEPT")
        print("=" * 50 + "\n")
        print("5. passed validation! Proceeding with Transmittal Flow...")
        try:
            page.locator(".sp-action:has-text('Create Transmittal')").click()
            page.wait_for_selector(".modal-container")
            page.once("dialog", lambda dialog: dialog.accept())
            print("   -> Clicking 'FINISH' in transmittal modal...")
            page.locator(".modal-btn.primary:has-text('FINISH')").click()
            print("   -> Transmittal complete. Pausing to show state...")
            page.wait_for_timeout(2000)
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator(".sp-action:has-text('Approve')").click()
            print("   ✓ Task Approved successfully!")
        except Exception as e:
            print(f"   [Error in Acceptance Flow]: {e}")
    else:
        print("                       REJECT")
        print("=" * 50 + "\n")
        print("5. failed validation! Clicking 'Decline'...")
        try:
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator(".sp-action:has-text('Decline')").click()
            print("   ✓ Clicked Decline!")
        except Exception as e:
            print(f"   [Error clicking Decline]: {e}")
