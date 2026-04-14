import os
import json
import requests
import fitz  # PyMuPDF
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Use your .env file!
load_dotenv()


# --- Data Models for Structured Output ---
class ReferenceDataFields(BaseModel):
    action: str
    document_number: str
    revision: str
    issue_date: str
    document_title: str
    classification: str
    alternate_document_number: str = "NA"
    alternate_revision_number: str = "NA"
    issue_purpose: str
    file_name: str
    security_code: str
    supplier_number: str = "NA"
    purchase_order_number: str = "NA"
    supervised_by: str = "NA"


class ReferenceDataResponse(BaseModel):
    reference_data: ReferenceDataFields


class Issue(BaseModel):
    page: int
    field: str
    found: str
    expected: str


class AnalysisResult(BaseModel):
    metadata_found: Optional[ReferenceDataFields]
    issues: List[Issue]
    non_ocr_pages: List[str]


class GeminiComplianceSystem:
    def __init__(self, api_key):
        # NEW SDK Client
        self.client = genai.Client(api_key=api_key)
        self.model_id = "models/gemini-2.0-flash"
        self.loadsheet_pdf = "Sample_Loadsheet.pdf"
        self.report_file = "Compliance_Report.txt"

        # OCR-Focused Generation Config
        self.ocr_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0),
            response_mime_type="application/json",
            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
        )

    def download_loadsheet(self, url):
        print(f"\n[DOWNLOAD] Fetching loadsheet from {url}...")
        try:
            response = requests.get(url)
            response.raise_for_status()
            with open(self.loadsheet_pdf, "wb") as f:
                f.write(response.content)
            print(f"  [SUCCESS] Downloaded to {self.loadsheet_pdf}")
            return True
        except Exception as e:
            print(f"  [ERROR] Failed to download: {e}")
            return False

    def extract_loadsheet_data(self):
        """
        Uses Gemini to extract all 14 columns from the loadsheet.
        """
        print(f"\n[AI-EXTRACT] Parsing loadsheet: {self.loadsheet_pdf}...")
        doc = fitz.open(self.loadsheet_pdf)
        contents = []
        for page in doc:
            text = page.get_text()
            contents.append(f"--- [PAGE {page.number + 1} TEXT] ---\n{text}\n")
            # Always add images for high-fidelity OCR as requested
            pix = page.get_pixmap()
            img_bytes = pix.tobytes("png")
            contents.append(
                types.Part.from_bytes(data=img_bytes, mime_type="image/png")
            )

        system_instruction = """
        [CONTEXT]
        You are an OCR and Document Metadata Analysis specialist.
        [REQUEST]
        Extract all columns from the metadata loadsheet provided.
        [ACTIONS]
        1. Scan the image/text for the first valid data row.
        2. Map fields to the requested JSON structure.
        3. Use "NA" for empty fields.
        [FRAMING]
        OCR ONLY. Transcribe the text exactly as it appears. Do not explain, summarize, or provide context.
        Provide the response immediately as if your thinking budget is set to 0. Do not use reasoning steps.
        [TEMPLATE]
        Return ONLY valid JSON following the provided schema.
        """

        prompt = [
            "<task>Extract 14 columns from the document following OCR only rules.</task>"
        ]
        prompt.extend(contents)

        import time

        max_retries = 3
        for attempt in range(max_retries):
            try:
                config = self.ocr_config
                config.response_schema = ReferenceDataResponse
                config.system_instruction = system_instruction

                response = self.client.models.generate_content(
                    model=self.model_id, contents=prompt, config=config
                )

                data = response.parsed

                doc_number = data["reference_data"].get(
                    "document_number", "metadata_reference"
                )
                json_filename = f"{doc_number}.json"

                # Add requirements
                data_dict = data.model_dump()
                data_dict["requirements"] = {
                    "check_blank_pages": True,
                    "check_ocr": True,
                    "check_consistency": True,
                }

                with open(json_filename, "w") as f:
                    json.dump(data_dict, f, indent=4)

                print(f"  [SUCCESS] AI Reference created: {json_filename}")
                return data_dict
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(
                        f"  [WAIT] Loadsheet rate limit hit. Retrying in 15s... (Attempt {attempt+1}/{max_retries})"
                    )
                    time.sleep(15)
                    continue
                print(f"  [ERROR] AI Loadsheet extraction failed: {e}")
                return None
        return None

    def analyze_document_with_ai(self, contents, master_ref):
        """
        Validates metadata consistency: Only reports error if a field is found but mismatched.
        """
        fields_to_check = ", ".join(master_ref.keys())

        system_instruction = """
        [CONTEXT]
        You are an elite Document Integrity Auditor.
        
        [CRITICAL DIRECTIVE]
        You MUST verify consistency ACROSS ALL PAGES. Documents often hide errors deep inside.
        For example, 'Revision' might be '1' on the cover, but accidentally say 'Rev 4' or 'Revision 0' on page 4, 5, or 6. 
        YOU MUST HUNT for 'Rev', 'Revision', 'Date', 'Title', or 'Document Number' on EVERY single page. 
        
        [ACTIONS]
        1. Look at Page 1. Extract metadata. Compare to reference.
        2. Look at Page 2, Page 3, Page 4, Page 5, etc., individually!
        3. Every time you see a revision number, document number, date, or title on ANY page, compare it to the master reference.
        4. If it differs (e.g., reference says Revision '1', but Page 5 says Revision '4'), you MUST generate an Issue object with the specific page number.

        [FRAMING]
        - Report ONLY discrepancies. Do not report correct matches.
        - Treat "04", "Rev 4", "Rev. 4", "Revision 4" as a found value of "4". If reference is "1", this is a critical mismatch!
        - Mapping: "Reason for Issue" = "issue_purpose".
        - Do not stop at page 1. Your primary job is finding hidden mismatches on later pages!
        - OCR ONLY: Transcribe exactly as shown. No hallucinations or reasoning.
        """

        prompt = [
            f"<reference>{json.dumps(master_ref, indent=2)}</reference>",
            "<task>Analyze the following document for consistency across all provided parts (text and images).</task>",
        ]
        # Append all parts
        if isinstance(contents, list):
            prompt.extend(contents)
        else:
            prompt.append(contents)

        import time

        max_retries = 3
        for attempt in range(max_retries):
            try:
                config = self.ocr_config
                config.response_schema = AnalysisResult
                config.system_instruction = system_instruction

                response = self.client.models.generate_content(
                    model=self.model_id, contents=prompt, config=config
                )
                return response.parsed
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(
                        f"  [WAIT] Rate limit hit. Retrying in 25s... (Attempt {attempt+1}/{max_retries})"
                    )
                    time.sleep(25)
                    continue
                print(f"  [ERROR] AI Document analysis failed: {e}")
                return None
        return None

    def validate_document(self, target_pdf, ref_data):
        print(f"\n[AI-SCANNING] {target_pdf}...")
        filename = os.path.basename(target_pdf)
        master = ref_data["reference_data"]

        # Build analysis contents
        analysis_parts = []
        non_ocr_pages = []
        issues = []

        try:
            doc = fitz.open(target_pdf)
            for i, page in enumerate(doc):
                page_num = i + 1
                text = page.get_text().strip()
                has_images = len(page.get_images()) > 0

                # Blank Page Detection
                if not text and not has_images:
                    issues.append(
                        f"BLANK PAGE ALERT: Page {page_num} is completely empty."
                    )
                    continue

                analysis_parts.append(f"--- [PAGE {page_num} TEXT] ---\n{text}\n")

                # OCR / Image Detection
                if not text and has_images:
                    non_ocr_pages.append(f"Page {page_num} (IMAGE ONLY)")
                    pix = page.get_pixmap()
                    img_bytes = pix.tobytes("png")
                    analysis_parts.append(
                        types.Part.from_bytes(data=img_bytes, mime_type="image/png")
                    )
                elif has_images:
                    non_ocr_pages.append(f"Page {page_num} (MIXED: Text + Image)")
                    pix = page.get_pixmap()
                    img_bytes = pix.tobytes("png")
                    analysis_parts.append(
                        types.Part.from_bytes(data=img_bytes, mime_type="image/png")
                    )

        except Exception as e:
            return {
                "filename": filename,
                "is_valid": False,
                "issues": [f"Open Error: {e}"],
            }

        # Run Gemini Analysis
        analysis = self.analyze_document_with_ai(analysis_parts, master)

        if analysis:
            for issue in analysis.issues:
                if (
                    str(issue.found).strip().lower()
                    != str(issue.expected).strip().lower()
                ):
                    issues.append(
                        f"ACCURACY ERROR (Page {issue.page}): '{issue.field}' found as '{issue.found}', expected '{issue.expected}'"
                    )
            extracted = (
                analysis.metadata_found.model_dump() if analysis.metadata_found else {}
            )
        else:
            issues.append("ERROR: AI analysis failed to return data.")
            extracted = {}

        if non_ocr_pages:
            issues.append(f"🚩 NON-OCR ALERT: {non_ocr_pages}")

        return {
            "filename": filename,
            "is_valid": len(issues) == 0,
            "issues": issues,
            "extracted": extracted,
            "non_ocr_pages": non_ocr_pages,
            "raw_issues": analysis.issues if analysis else [],
        }

    def generate_highlighted_pdf(self, input_pdf_path, results):
        """
        Creates a copy of the PDF with visual highlights on the mismatched fields.
        """
        issues = results.get("raw_issues", [])
        if not issues:
            return None

        output_path = input_pdf_path.replace(".pdf", "_errors.pdf")
        try:
            doc = fitz.open(input_pdf_path)

            for issue in issues:
                # Page index is 0-based in fitz, AI returns 1-based
                page_idx = issue.page - 1
                if page_idx < 0 or page_idx >= len(doc):
                    continue

                page = doc[page_idx]
                found_text = str(issue.found).strip()

                if not found_text or found_text.lower() == "na":
                    continue

                # Search for the text on the page
                text_instances = page.search_for(found_text)

                for inst in text_instances:
                    # Add highlight
                    highlight = page.add_highlight_annot(inst)
                    highlight.set_colors(stroke=(1, 0, 0))  # Red
                    highlight.update()

                    # Add a visible "error box" (text annotation) nearby
                    # We'll place it slightly to the right of the highlight
                    rect = fitz.Rect(inst.x1 + 10, inst.y0, inst.x1 + 150, inst.y1 + 20)
                    annot = page.add_freetext_annot(
                        rect,
                        f"ERROR: {issue.field}\nExpected: {issue.expected}\nFound: {issue.found}",
                        fontsize=8,
                        fontname="helv",
                        text_color=(1, 0, 0),
                    )
                    annot.update()

            doc.save(output_path)
            doc.close()
            print(f"  [SUCCESS] Highlighted error report generated: {output_path}")
            return output_path
        except Exception as e:
            print(f"  [ERROR] Failed to generate highlighted PDF: {e}")
            return None


def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: No GEMINI_API_KEY found.")
        return

    system = GeminiComplianceSystem(api_key)

    url = "https://raw.githubusercontent.com/athrvzoz/LocatorFile/refs/heads/main/Sample%20Loadsheet.pdf"
    if not system.download_loadsheet(url):
        return

    ref_data = system.extract_loadsheet_data()
    if not ref_data:
        return

    target = ref_data["reference_data"].get("file_name", "CEP210090ER.pdf")
    if os.path.exists(target):
        result = system.validate_document(target, ref_data)

        # Report
        report = "DOCUMENT INTEGRITY REPORT (Gemini AI Mode)\n"
        report += "=" * 50 + "\n\n"
        report += f"Document: {result['filename']}\n"
        status = "PASSED" if result["is_valid"] else "FAILED"
        report += f"Status: {status}\n"

        for issue in result["issues"]:
            report += f"  - {issue}\n"

        report += "\nReference Values used (from Loadsheet):\n"
        report += json.dumps(ref_data["reference_data"], indent=4)

        with open(system.report_file, "w", encoding="utf-8") as f:
            f.write(report)

        print(f"\n[DONE] AI Report saved to {system.report_file}")
    else:
        print(f"Target {target} not found.")


if __name__ == "__main__":
    main()
