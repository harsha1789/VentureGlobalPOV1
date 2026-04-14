# VG_OCR Project

## Overview

This repository provides an automation workflow for document compliance analysis using Google Gemini AI and PDF OCR.

- `automation/ui_workflow.py`: Main automation entrypoint.
- `process_compliance_ai.py`: AI-based extraction and document validation logic.
- `requirements.txt`: Python dependency list.
- `.env.example`: Template for the Gemini API key.

## Setup

1. Install dependencies:

```powershell
pip install -r requirements.txt
```

2. Install Playwright browsers:

```powershell
playwright install chromium
```

3. Configure environment:

- Rename `.env.example` to `.env`.
- Add your Gemini API key:

```text
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

## Run

From the repository root, run:

```powershell
python automation\ui_workflow.py
```

## Notes

- `automation/ui_workflow.py` imports and executes `process_compliance_ai.main()`.
- The workflow downloads a sample loadsheet PDF and uses Gemini to extract and validate metadata.
- API rate limiting may occur during Gemini extraction, so retries are built in.

## Files to Share

- `automation/ui_workflow.py`
- `process_compliance_ai.py`
- `requirements.txt`
- `.env.example`
