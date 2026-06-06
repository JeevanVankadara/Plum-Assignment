# PlumClaims - AI OPD Claim Adjudication

GitHub Repository: [JeevanVankadara/Plum-Assignment](https://github.com/JeevanVankadara/Plum-Assignment)

Deployed Application: [https://plum-assignment-nine.vercel.app/](https://plum-assignment-nine.vercel.app/)

PlumClaims is an OPD medical insurance claim adjudication tool built for the Plum intern assignment. It accepts prescription, bill, pharmacy, lab, and image/PDF documents, extracts claim details with Google Gemini, validates them against the provided policy terms, and returns an explainable claim decision.

The application contains:

- `Backend` - Node.js, Express, MongoDB, Gemini extraction, adjudication rules, audit trail, member tracking.
- `Frontend_typescript` - React, Vite, TypeScript, Tailwind UI used for the deployed frontend.
- `Frontend` - Original JSX frontend copy.
- `policy_terms.json` - Machine-readable policy limits, exclusions, co-pay, waiting period, covered services, and network hospitals.
- `test_cases.json` - Assignment test cases and expected outcomes.
- `Files_given_in_Assignment` - Original markdown files provided with the assignment:
  - `plum_intern_assignment.md`
  - `adjudication_rules.md`
  - `sample_documents_guide.md`

The backend also keeps runtime copies of the policy/rules under `Backend/src/data`, because the rule loader reads from that backend data folder.

## Core Behavior

The backend returns decisions in the required assignment format:

```json
{
  "claim_id": "CLM_XXXXX",
  "decision": "APPROVED/REJECTED/PARTIAL/MANUAL_REVIEW",
  "approved_amount": 0,
  "rejection_reasons": [],
  "confidence_score": 0.95,
  "notes": "Additional observations",
  "next_steps": "What the claimant should do"
}
```

Additional fields are also returned for the UI, including audit trail, extracted documents, rejected items, deductions, co-pay, irrelevant tests, and admin finalization status.

## Run Locally

### Backend

```bash
cd Backend
npm install
cp .env.example .env
npm run dev
```

Backend runs on:

```text
http://localhost:4000
```

Required backend environment variables:

```text
PORT=4000
MONGO_URI=<your MongoDB URI>
GEMINI_API_KEY=<your Gemini API key>
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGIN=http://localhost:5173
```

### TypeScript Frontend

```bash
cd Frontend_typescript
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

For deployment or a non-local backend, set:

```text
VITE_API_BASE=https://your-backend-url.onrender.com
```

Do not include a trailing slash in `VITE_API_BASE`.

## Deployment Notes

### Vercel Frontend

Use `Frontend_typescript` as the Vercel root directory.

Recommended settings:

```text
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Environment variable:

```text
VITE_API_BASE=https://your-backend-url.onrender.com
```

`Frontend_typescript/vercel.json` includes an SPA rewrite so refreshes on `/analytics`, `/rules`, and other React Router routes load correctly.

### Render Backend

Use `Backend` as the Render root directory.

Recommended settings:

```text
Build Command: npm install
Start Command: npm start
```

Backend environment variables:

```text
PORT=4000
MONGO_URI=<your MongoDB URI>
GEMINI_API_KEY=<your Gemini API key>
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGIN=https://your-vercel-frontend.vercel.app
```

Do not include a trailing slash in `CORS_ORIGIN`.

## Major Implemented Features

- Gemini-based document extraction for images/PDFs.
- Console logging of main Gemini extraction fields for testing.
- Rule-based adjudication aligned with `Files_given_in_Assignment/adjudication_rules.md`.
- Required document validation using evidence, so a single page can act as both prescription and bill when it contains both clinical and billing information.
- Item-level exclusions for cosmetic, supplement, non-prescribed, and unsupported items.
- Diagnostic prescription-to-invoice matching with fuzzy matching.
- Irrelevant diagnostic test detection and manual review toggle.
- GST/tax ignored as a non-payable tax component.
- Admin finalization flow with one-time approve/reject lock.
- Editable admin notes and next steps saved to MongoDB.
- Member collection created lazily from claim member IDs.
- Dynamic analytics, queue search, and status filters.

## Running The Assignment Test Cases

The assignment test scenarios are listed in `test_cases.json`.

There are two practical ways to test them.

### 1. Run Backend Automated Tests

The backend includes rule tests that cover the main assignment behavior and the extra demo rules added during development.

```bash
cd Backend
npm install
npm test
```

These tests run without calling Gemini. They use mocked extracted document data and directly test the adjudication engine.

### 2. Run Test Cases Through The Application UI

Use this when you want to verify the full upload flow with Gemini extraction.

1. Start the backend.

```bash
cd Backend
npm install
npm run dev
```

2. Start the TypeScript frontend in a second terminal.

```bash
cd Frontend_typescript
npm install
npm run dev
```

3. Open the app.

```text
http://localhost:5173
```

4. Open `test_cases.json` and pick a test case such as `TC001`, `TC002`, or `TC003`.

5. Create or use mock prescription/bill/lab/pharmacy images matching the test case data. Use `Files_given_in_Assignment/sample_documents_guide.md` as the format guide.

6. Upload the documents in the New Adjudication card and enter the test case member ID.

7. Compare the app result with the expected output in `test_cases.json`:

- decision: `APPROVED`, `REJECTED`, `PARTIAL`, or `MANUAL_REVIEW`
- approved amount
- rejection reasons or rejected items
- confidence score
- audit trail rules

Note: Some expected values can differ from the original `test_cases.json` because the implementation intentionally uses partial approval for limit excess and item-level deductions for mixed claims instead of rejecting the full claim.

## Assumptions

These assumptions were made because the provided assignment files do not include every real-world insurance data source.

### Policy Status

Policy active status is checked using `policy_terms.json` `effective_date`.

The policy file does not provide a cancellation date, expiry date, or policy status API. So the backend verifies that the treatment date is on or after the policy effective date, but it cannot verify later cancellation or expiry.

### Waiting Period

Waiting period is calculated from the policy effective date.

The policy file gives an OPD waiting period, but it does not provide individual employee/member enrollment dates. In a real insurer system, waiting period should usually be calculated from the member's enrollment or policy start date. Here, the system uses the policy effective date as the available reference date.

### Member And Dependent Verification

There is no real member, employee, or dependent roster database in the provided policy file.

The backend only checks whether a member ID is present in the uploaded photo/PDF or submitted form data. If the member ID is missing or `UNKNOWN`, the claim is rejected as member not covered. If a member ID is present, the system allows adjudication to continue and adds an audit note that deeper roster verification is not possible.

`policy_terms.json` says dependents are covered, but it does not list actual employees or dependents. So dependent coverage is assumed when a valid-looking member ID is present.

### Members Collection

The MongoDB `members` collection is created and updated by this application.

It starts empty because no mock member data was provided. When a claim is processed, the backend creates or updates the member document using the extracted/submitted member ID and patient name. It stores claim IDs, claim count, and approved spending.

`totalSpent` tracks approved/final payable amount, not every claimed amount.

### Hospital Or Clinic Authenticity

The app extracts provider names, but it does not verify hospital or clinic registration with a government, NABH, NABL, medical council, or licensing database.

The `network_hospitals` array in `policy_terms.json` is treated as a network/tie-up provider list. It is not treated as a legal registration database. A hospital being absent from this list does not automatically mean it is fake; it only means the app cannot verify it as a listed network hospital.

### Doctor Verification

Doctor registration is checked by format and presence.

The app does not call a real medical council registry. If a doctor registration number is present and matches the expected pattern, it is treated as valid for this demo. If it is missing or invalid-looking, the claim can be rejected or flagged.

### Late Submission

Late submission rejection is skipped unless a submission date is explicitly extracted or provided.

This avoids rejecting old sample/test documents only because they were uploaded during the demo after the treatment date.

### Annual Limits

Annual limit usage is calculated from claims stored in this MongoDB database for the same member ID and treatment year.

The system does not know about claims paid outside this app, claims from another database, family floater usage, or company-level policy records. Therefore annual limit checks are accurate only for the data already stored by this application.

### Co-payment

Co-pay is treated as a fixed percentage from `policy_terms.json`.

It is not the same as "amount above the limit". The patient pays the configured co-pay percentage on payable amounts, and also pays any excluded, non-covered, or over-limit amount.

There is no separate generic-medicine co-pay rule in the provided policy terms. Unless the policy explicitly defines a different rule, the normal policy co-pay applies.

### Medical Necessity

Medical necessity is checked using deterministic rules and Gemini-assisted extraction.

The app checks whether diagnosis exists, whether claimed items are plausibly related to the diagnosis, and whether obvious irrelevant tests are present. It does not use a full clinical guideline database, medical protocol engine, or doctor-reviewed treatment protocol database.

Low confidence or suspicious medical necessity cases are routed to manual review.

### Pre-authorization

Pre-authorization is checked specially for MRI and CT scan items.

The policy file has some ambiguity: diagnostic services generally show `pre_authorization_required: false`, while covered tests mention `MRI (with pre-auth)` and `CT Scan (with pre-auth)`. The backend therefore handles MRI/CT as special pre-auth-required items. If more pre-auth services are added later, the rule logic should be extended.

### Diagnostic Evidence

For diagnostic claims, a lab invoice can be enough evidence if it clearly lists the same tests prescribed by the doctor.

Separate lab reports are optional when the diagnostic invoice/bill line items match the prescribed tests. Diagnostic evidence is required only when diagnostic amounts are claimed, not merely because a prescription mentions tests.

Ancillary diagnostic charges such as sample collection are allowed only when at least one prescribed diagnostic test is matched on the same invoice.

### Pharmacy Matching

Pharmacy bill items must match medicines/items prescribed by the doctor.

Items present in the medical bill but not present in the prescription are excluded from payable amount. They are not treated as payable `other` items.

### GST And Taxes

GST, CGST, SGST, tax, round-off, and similar tax/accounting rows are ignored.

They are not treated as payable medical line items and should not trigger missing or unsupported service errors.

### Single Page Prescription And Bill

A single uploaded document can satisfy both prescription and bill requirements if it contains both:

- clinical evidence such as doctor, diagnosis, prescription, treatment, procedure, or tests advised
- billing evidence such as line items or total amount

This supports prescription-cum-bill documents and clinic invoices that include consultation, medicine, procedure, or diagnostic charges on one page.

### Exclusions And Cosmetic Items

Policy exclusions are applied at line-item level whenever possible.

If a claim contains both valid and excluded items, the excluded items are deducted and the valid items continue through adjudication. For example, root canal treatment can continue while teeth whitening is excluded.

If all claimed payable items are excluded or cosmetic, the claim is rejected completely.

Gemini is prompted to use exact exclusion names from `policy_terms.json`, such as `Cosmetic procedures` and `Vitamins and supplements (unless prescribed for deficiency)`.

### Irrelevant Diagnostic Tests

Gemini can flag diagnostic tests that do not align with the diagnosis, such as an MRI for a simple fever without complication symptoms.

Flagged tests are excluded by default and the claim is sent to manual review. The admin can toggle whether to include or exclude those items before final approval.

### Duplicate And Pattern Checks

Duplicate, same-day, and recent-pattern checks use only claims already stored in this MongoDB database.

The app cannot detect duplicate claims submitted in another system or historical claims not present in this database.

### Gemini Extraction

Document understanding depends on Google Gemini and document legibility.

The backend logs Gemini extraction results in the console for testing, including patient name, member ID, doctor, dates, diagnosis, line items, total amount, exclusion matches, and irrelevant tests.

Temporary Gemini errors such as model high demand can still happen in deployment. The backend includes retry behavior, but Google API availability is outside the app's control.

### Admin Finalization

System decisions are automatic recommendations/current decisions after upload.

Admin approval or rejection is the final decision. Once an admin finalizes a claim, the decision cannot be changed again. Admin notes and next steps can still be edited and saved after finalization for documentation.

### Deployment

The frontend and backend are deployed separately.

The TypeScript frontend uses `VITE_API_BASE` to find the backend. The backend uses `CORS_ORIGIN` to allow the deployed frontend origin. Both values should be exact origins without trailing slashes.

## Useful Commands

Backend:

```bash
cd Backend
npm install
npm run dev
npm test
```

TypeScript frontend:

```bash
cd Frontend_typescript
npm install
npm run dev
npm run build
```
