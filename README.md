# Med Arina 🏥
### AI-Powered Healthcare Claim Investigation Platform

Med Arina is a healthcare technology project designed to help investigate healthcare claims by analyzing claim information, gathering supporting evidence, and identifying inconsistencies that may require further review.

The platform aims to make healthcare claim investigation more structured, transparent, and evidence-based using AI-assisted analysis and web intelligence.

## 🎯 Problem Statement

Healthcare claim investigation can require significant manual effort to verify information, review supporting evidence, and identify suspicious or inconsistent details. Missing information and conflicting evidence can make the process more difficult.

Med Arina aims to support investigators by organizing claim information and highlighting potential concerns for human review.

## 💡 Proposed Solution

Med Arina combines AI-assisted reasoning with evidence collection and claim analysis to support healthcare claim investigation.

The proposed workflow includes:

1. **Claim Submission:** Enter healthcare claim information for investigation.
2. **AI Analysis:** Use AI to interpret claim details and identify information that needs verification.
3. **Evidence Collection:** Retrieve relevant information from web sources using the planned TinyFish integration.
4. **Evidence Comparison:** Compare available evidence with the submitted claim details.
5. **Risk Assessment:** Highlight inconsistencies, missing information, and potential anomalies.
6. **Investigation Report:** Present findings and supporting evidence to assist human reviewers.

## ✨ Key Features

- Healthcare claim investigation workflow
- AI-assisted claim analysis
- Evidence preview and source organization
- Investigation history and report views
- Risk assessment to highlight potential inconsistencies
- Dashboard for organizing investigations
- Explainable findings to support human review

*Feature availability depends on the current implementation and connected API services.*

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| TypeScript | Type-safe application development |
| Vite | Development server and build tooling |
| CSS | Styling and responsive interface |
| Python / FastAPI | Proposed backend API |
| Gemini API | Proposed AI-assisted analysis |
| TinyFish | Proposed web intelligence and evidence retrieval |
| SQLite | Proposed data storage |

## 🏗️ Project Architecture

```text
Med Arina
│
├── Frontend
│   ├── React
│   ├── TypeScript
│   └── Vite
│
├── Claim Investigation
│   ├── Claim Information
│   ├── Evidence Review
│   └── Risk Assessment
│
└── Planned Integrations
    ├── Gemini API
    ├── TinyFish
    └── Backend API
        └── SQLite
```

The architecture represents the proposed system design. Backend services and external integrations should be configured and verified before being considered operational.

## 🚀 Getting Started

### Prerequisites

Install the following tools:

- [Node.js](https://nodejs.org/)
- npm, included with Node.js
- Git

### 1. Clone the repository

```bash
git clone https://github.com/vidhi-421/mediarine.git
```

### 2. Navigate to the project directory

```bash
cd mediarine
```

### 3. Install dependencies

```bash
npm install
```

If your project uses pnpm, you can instead run:

```bash
pnpm install
```

### 4. Start the development server

```bash
npm run dev
```

Open the local URL displayed in your terminal, usually `http://localhost:5173`.

### 5. Build for production

```bash
npm run build
```

## 👥 Target Users

- Healthcare claim investigators
- Insurance claim review teams
- Healthcare administrators
- Organizations interested in evidence-based claim verification

## 🔮 Future Scope

- Complete backend integration
- Live evidence retrieval through TinyFish
- Gemini-powered claim analysis
- Secure user authentication and data storage
- Improved explainable risk scoring
- Exportable investigation reports
- Enhanced validation and audit trails

## ⚠️ Responsible Use

Med Arina is intended to assist healthcare claim investigation, not replace qualified human reviewers.

A risk score or detected inconsistency does not establish fraud or wrongdoing. Findings should be verified against reliable evidence before any decision is made.

Use appropriate safeguards to protect confidential healthcare information.

## 📌 Project Information

- **Project Name:** Med Arina
- **Category:** Healthcare Technology / AI
- **Repository:** https://github.com/vidhi-421/mediarine

---

Developed as an AI-assisted healthcare claim investigation project.

