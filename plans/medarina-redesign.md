# Medarina Redesign & Extension Plan

## Decisions (confirmed)
- Add the missing form fields (two-step New Investigation form).
- Build a 4-step onboarding modal.
- Stay frontend-only (localStorage); TinyFish behind a service layer, honest "not configured" states.
- PDF export: use **jsPDF** (added as a dependency) plus browser print via a print stylesheet. (The PDF question was skipped, so this uses what you asked for in the original brief.)

## Constraints
- Keep all current routes (`src/lib/router.ts`), auth flow (`src/lib/auth.ts`), existing sample records and stored localStorage data working.
- Palette: primary `#237653` light / `#70C99A` dark, mint, white and sky blue; Inter; light and dark themes.
- No emojis; use the existing icon approach in `src/components/ui.tsx`.

## 1. Theme (`src/index.css`, `src/components/ui.tsx`)
- Rework CSS variables into a clinical look: surface, surface-muted (mint tint), border, primary, accent (sky blue), and status tokens for success, warning, danger and info, each with a dark-mode version.
- Update shared primitives (Card, Button, Badge, Input, Select, Textarea, StatusPill, Stepper, Modal) to use these tokens. Add `Stepper` and `Modal` if they don't exist yet.
- Shell/sidebar gets a hospital-style header: wordmark, an environment badge and a TinyFish status dot.

## 2. Data layer (`src/lib/store.ts`)
- Extend the `Investigation` type with optional fields: `serviceDateFrom`, `serviceDateTo`, `billingDate`, `billedAmount` (number), `billingCodes: {code, type: 'CPT'|'ICD-10'|'HCPCS', description}[]`, `clinicalTimeline: {date, event}[]`, `reviewerNotes`, `retrieval: {status, startedAt, completedAt, message}`.
- Because the new fields are optional, existing records load without changes. Add a `normalizeInvestigation` step on read.
- Add 3–4 new realistic sample investigations (for example duplicate billing, upcoding E/M 99215, unbundled lab panel, and a DME without documentation), seeded only when their IDs are missing. Keep the existing samples.
- Add selectors for dashboard stats: total, open, flagged, closed, total billed under review, and average days open.

## 3. TinyFish service (`src/lib/tinyfish.ts`, new)
- `getConfig()` reads the endpoint and key from Settings in localStorage. `getStatus()` returns `'not_configured' | 'ready' | 'error'`.
- `retrieveEvidence(inv)` does this:
  - If no endpoint is set, return `{status:'not_configured'}` without making a call.
  - Otherwise, `fetch` the endpoint with a timeout (AbortController, 20s) and map the response to evidence items.
  - On failure, return `{status:'error', message}`.
- Status values shown in the UI: Not configured, Queued, Retrieving, Completed, Failed. The app never shows fake success.
- Settings page: add or keep endpoint and key fields plus a "Test connection" button that calls `getStatus` with a ping.

## 4. Overview dashboard (`src/pages/Overview.tsx`)
- Top row of stat cards using the selectors from section 2.
- A status breakdown bar and a list of recent investigations linking to the detail page.
- **TinyFish status panel** showing the config state, last retrieval time, and a link to Settings. When nothing is configured it shows "No retrieval endpoint configured".
- Quick actions: New Investigation, Load Sample Claim.

## 5. New Investigation (`src/pages/NewInvestigation.tsx`)
- **Step 1 (Claim details):** existing fields plus service dates from/to, billing date, billed amount (currency input) and billing codes (repeatable rows).
- **Step 2 (Clinical context):** clinical timeline (repeatable date/event rows), reviewer notes, and a review summary.
- Validation for each step: required fields, `to >= from`, amount > 0, and at least 1 code. Errors show inline, and Next is blocked until they're fixed.
- Buttons: Back, Next, Submit, **Clear Form** (asks for confirmation) and **Load Sample Claim** (fills a realistic claim).
- After submit: save, go to the detail page, and optionally start retrieval.

## 6. Investigation Detail (`src/pages/InvestigationDetail.tsx`, `EvidencePreview.tsx`)
- Add an evidence retrieval panel: a "Retrieve evidence" button with a step timeline (Queued → Retrieving → Completed/Failed, or Not configured), saved in `retrieval`.
- Show the new fields: billing codes table, clinical timeline, and reviewer notes.
- Add a "View report" action.

## 7. Report viewer (`src/pages/Report.tsx` + route `/investigations/:id/report`)
- A printable layout with: header (Medarina, case ID, date), claim summary, codes, timeline, evidence, findings and notes, and signature lines.
- **Print** calls `window.print()` with `@media print` CSS that hides the app shell.
- **Export PDF** builds the PDF with jsPDF text and tables (`jspdf`, plus `jspdf-autotable` for the tables) and saves it as `Medarina-<caseId>.pdf`.

## 8. History (`src/pages/History.tsx`)
- Keep the current filters. Add billed amount and retrieval-status columns and a "View report" action on each row.

## 9. Onboarding modal (`src/components/Onboarding.tsx`)
- Has 4 steps:
  1. Welcome
  2. Creating investigations
  3. Evidence retrieval and TinyFish setup (link to Settings)
  4. Reports and export
- Shows a stepper, Back/Next/Skip and Finish.
- Appears once after sign-in, controlled by the `medarina.onboarded.<userId>` flag. A "Replay onboarding" option goes in Help and Settings.

## 10. Help & Auth
- Restyle the auth screens with the new theme only; their logic stays the same. Add a short TinyFish FAQ entry to Help.

## Verification
- `npm run build` passes, with types checking cleanly.
- Manual checks:
  - Old localStorage data still loads.
  - The two-step form validates, and Clear and Load Sample work.
  - Retrieval with no endpoint shows "Not configured", and a bad endpoint shows "Failed".
  - Print preview hides the shell, and the PDF downloads.
  - Onboarding shows once and can be replayed.
  - Both themes look right on every page.
