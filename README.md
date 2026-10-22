# Medarina — AI-Powered Healthcare Claims Investigation

**Investigate healthcare claims. Verify live evidence. Support informed audit decisions.**

Medarina is a healthcare claims investigation and clinical compliance auditing platform that helps reviewers examine billing claims, retrieve relevant public healthcare policy information, identify potential inconsistencies, and organize evidence for human review.

Instead of relying only on static information, Medarina integrates TinyFish for live web evidence retrieval and uses AI-assisted analysis to help reviewers understand potential billing and documentation risks.

> **Important:** Medarina supports healthcare audit workflows. It does not independently establish fraud, replace clinical judgment, or guarantee that a claim is compliant or non-compliant.

## The Problem

Healthcare claims may contain billing inconsistencies, insufficient supporting documentation, coding questions, or discrepancies between submitted services and applicable policy requirements.

Reviewers need to gather relevant information from public policy sources, compare it with the submitted claim, and document their findings. Manual research can be time-consuming, while unsupported automated conclusions can create additional risks.

Medarina aims to make this process more structured by connecting claim information, live policy research, evidence collection, and reviewer decisions in one workflow.

## The Solution

Medarina provides a centralized workspace for healthcare claims investigation.

- **Claim intake:** Capture claim statements, billing codes, service dates, billed amounts, and relevant context.
- **Live web research:** Use TinyFish to retrieve information from relevant public healthcare policy webpages.
- **Evidence collection:** Organize retrieved sources, including their titles, URLs, and available metadata.
- **AI-assisted analysis:** Generate summaries and identify potential documentation or billing concerns using the configured analysis service.
- **Risk assessment:** Help reviewers examine evidence gaps and potential inconsistencies.
- **Audit reporting:** Present findings and reviewer decisions in a structured report.
- **Investigation history:** Revisit saved investigations and their associated evidence and reports.
- **System diagnostics:** Check backend connectivity and test live retrieval.

## Key Features

| Feature | Purpose |
|---|---|
| Investigation Dashboard | View investigation counts, statuses, and workflow activity |
| Claim Intake | Record claim details and clinical context |
| TinyFish Integration | Retrieve current information from public webpages |
| Evidence Management | Review retrieved sources and supporting information |
| AI-Assisted Analysis | Summarize evidence and surface potential risks |
| Review Workflow | Track investigation progress and reviewer decisions |
| Reports | Present findings in a structured format |
| Supabase Persistence | Store investigation and report data through the backend |
| Integration Diagnostics | Test service connectivity and live retrieval |

Feature availability depends on the configured environment and successful service execution.

## How TinyFish Is Used

TinyFish is a core part of Medarina's evidence-retrieval workflow, not just a decorative integration.

Medarina uses TinyFish's web-agent capabilities to retrieve relevant information from public healthcare policy webpages.

### Retrieval Workflow

1. A reviewer creates or opens an investigation.
2. Medarina identifies the relevant claim details, billing codes, and research target.
3. The FastAPI backend sends a focused retrieval request to TinyFish.
4. TinyFish accesses the target webpage and extracts relevant information.
5. Medarina receives the returned evidence, including available source metadata.
6. The evidence is attached to the investigation for review and AI-assisted analysis.
7. The reviewer examines the findings and determines the appropriate audit outcome.

### Example

For a claim involving CPT 99214 and HCPCS G0438, Medarina can retrieve relevant public healthcare policy information and help identify questions that require further investigation.

A successful retrieval of the general CMS Physician Fee Schedule page does not, by itself, establish whether the particular code combination is permitted. Specific billing rules and supporting documentation must be verified before reaching a conclusion.

### Live Retrieval Diagnostics

The application includes a controlled live retrieval test to check whether TinyFish can access a public URL and return extracted information.

During development testing, the CMS Physician Fee Schedule page returned one source in approximately 49 seconds. Actual claim retrieval has also been tested, and retrieval timeouts have been addressed through focused prompts, a specific CMS target URL, and improved polling.

Results depend on the target webpage, service availability, request complexity, and configured credentials.

## Technical Architecture

```text
Reviewer
   |
   v
Medarina Frontend
React + TypeScript + Vite
   |
   v
FastAPI Backend
   |
   +---- TinyFish
   |       |
   |       v
   |   Live Web Evidence
   |
   +---- AI Analysis Service
   |       |
   |       v
   |   Evidence Summary
   |   and Risk Indicators
   |
   +---- Supabase
           |
           v
    Saved Investigations
    and Reports
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Live Web Retrieval | TinyFish |
| Database and Persistence | Supabase |
| AI-Assisted Analysis | Google Gemini, when configured and available |
| Testing | Pytest, frontend production build |
| Version Control | Git and GitHub |

## Project Structure

```text
mediarine/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── tinyfish_service.py
│   ├── gemini_service.py
│   ├── tests/
│   └── migrations/
├── src/
│   ├── components/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   └── index.css
├── README.md
├── package.json
└── vite.config.ts
```

The repository may contain additional configuration, deployment, and supporting files.

## Getting Started

### Prerequisites

Install the following:

- Node.js and npm
- Python 3.11 or a compatible version supported by the backend dependencies
- A Supabase project
- A TinyFish API key
- A Gemini API key if using Gemini-based analysis

### 1. Clone the Repository

```bash
git clone https://github.com/vidhi-421/mediarine.git
cd mediarine
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root for the frontend:

```env
VITE_API_URL=http://localhost:8000
```

Configure the backend using `backend/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

TINYFISH_ENDPOINT=https://agent.tinyfish.ai/v1/automation/run
TINYFISH_API_KEY=your_tinyfish_api_key

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_gemini_model
```

Use the actual variable names required by the backend configuration. Keep all real credentials private. Never commit API keys, service-role keys, or `.env` files to GitHub.

### 4. Install Backend Dependencies

Create and activate a Python virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use the environment's Python executable directly.

Install the project's backend dependencies using its existing requirements file, if provided:

```powershell
py -m pip install -r backend/requirements.txt
```

If the dependency file is located elsewhere, use the path present in the repository.

### 5. Start the Backend

From the project root:

```powershell
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Backend endpoints:

- Health check: `http://127.0.0.1:8000/health`
- API documentation: `http://127.0.0.1:8000/docs`

### 6. Start the Frontend

Open a second terminal in the project root:

```powershell
npm.cmd run dev
```

Open the application:

**http://localhost:8443/**

Use the port displayed by Vite if the configured port differs.

### 7. Test the Application

1. Open the Medarina dashboard.
2. Create a test investigation using fictional claim information.
3. Configure TinyFish in Settings.
4. Run the controlled live retrieval test.
5. Check whether evidence is returned and attached to the investigation.
6. Review the analysis, risk indicators, and report.
7. Verify that the investigation and report can be reopened from history.

Use fictional data for testing. Do not enter identifiable patient information into an unapproved environment.

## Database Setup

Medarina uses Supabase for backend persistence.

The repository includes an initial database migration at:

```text
backend/migrations/001_initial_schema.sql
```

Review the migration and the backend database implementation before applying it to a new project. Configure the correct Supabase credentials and verify that required tables and permissions are available.

Do not expose the Supabase service-role key in frontend code.

## Testing and Build

Run the backend tests:

```powershell
py -m pytest backend/tests/ -v
```

Build the frontend:

```powershell
npm.cmd run build
```

During development, the backend test suite was reported to pass 21 tests and the frontend production build completed successfully. These results describe the tested development state; rerun both commands against the latest checkout to verify the current revision.

Live retrieval also depends on external service availability and valid credentials.

## Responsible Use and Limitations

- Retrieved webpages may not contain all the rules needed to resolve a claim.
- AI-generated summaries and risk indicators require human verification.
- Missing documentation is not proof of misconduct.
- A successful API connection does not guarantee that every retrieval request will succeed.
- Retrieval can fail or time out because of webpage complexity, external service delays, or configuration issues.
- Audit outcomes must be based on appropriate evidence and reviewer judgment.
- Medarina is a development project and should not be treated as a certified clinical or claims adjudication system.

## Potential Users

- Healthcare claims reviewers
- Medical billing and coding audit teams
- Healthcare compliance professionals
- Research and audit support teams
- Developers building healthcare investigation workflows

## Expected Impact

Medarina aims to reduce the effort required to gather public policy information, make evidence easier to review, improve traceability during investigations, and support more consistent documentation of audit decisions.

Its value depends on reliable evidence retrieval, appropriate policy interpretation, and transparent human review.

## Future Improvements

- Broader coverage of authoritative healthcare policy sources
- Stronger evidence citations and source-level verification
- Improved handling of long-running retrieval tasks
- More comprehensive billing-code and policy cross-referencing
- Enhanced report export and reviewer sign-off workflows
- Better monitoring of retrieval quality and service reliability

## Repository

GitHub: https://github.com/vidhi-421/mediarine

## Acknowledgment

Built as an open-innovation healthcare technology project exploring AI-assisted investigation, live web intelligence, and evidence-supported audit workflows.

**Medarina — From claim submission to evidence-informed review.**
