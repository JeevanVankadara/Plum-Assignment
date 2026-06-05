# CuraLogic Backend

Node.js + Express + MongoDB backend for OPD claim adjudication.
Extracts fields from uploaded documents via Gemini Flash, runs the rules from
`src/data/adjudication_rules.md` against `src/data/policy_terms.json`, and
stores a full explainable audit trail.

## Setup

```bash
cp .env.example .env
# edit .env — add GEMINI_API_KEY
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

## Switching to MongoDB Atlas later

Change only `MONGO_URI` in `.env`:

```text
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.xxx.mongodb.net/curalogic
```

## API

| Method | Path                        | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| POST   | `/api/claims`               | multipart upload (`files[]`, `memberId`) |
| GET    | `/api/claims`               | recent queue                             |
| GET    | `/api/claims/:id`           | claim detail + audit trail               |
| PATCH  | `/api/claims/:id/decision`  | manual override `{ decision, reason }`   |
| GET    | `/api/health`               | health check                             |

## Decision output

```json
{
  "claimId": "CLM_AB12CD",
  "decision": "APPROVED | REJECTED | PARTIAL | MANUAL_REVIEW",
  "approved": 3200,
  "rejectionReasons": ["DOCTOR_REG_INVALID"],
  "confidence": 0.86,
  "trail": [ /* explainable rule-by-rule log */ ]
}
```

## Assumptions

- Policy active status is checked using `policy_terms.json` `effective_date` only. The policy file does not provide an expiry/end date, so the backend verifies that treatment happened after the policy started, but it cannot verify whether the policy later expired.
- Waiting periods are calculated from the policy `effective_date`. The policy file does not provide employee/member enrollment dates.
- Member verification does not use a member/dependent database or roster. The backend only checks whether a member ID is present in the uploaded photo/PDF or submitted form data. If no member ID is found, the claim is rejected as `MEMBER_NOT_COVERED`; if an ID is present, the system assumes it belongs to a covered employee/dependent because no roster data is maintained.
- `network_hospitals` in `policy_terms.json` is treated only as the insurer's network/tie-up provider list. It is not a hospital/clinic legal registration database, so the backend cannot verify whether a provider is officially registered with a government, medical, NABH, NABL, or clinic licensing authority.
- Pre-authorization checking is implemented only for MRI/CT diagnostic items because `policy_terms.json` lists `MRI (with pre-auth)` and `CT Scan (with pre-auth)` as special covered tests. The backend does not dynamically parse every possible future `pre_authorization_required` policy rule; if new pre-auth services are added, the rule logic must be updated.

## Folder layout

```
src/
  config/       db + policy loader
  models/       Claim, ExtractedDoc, AuditTrail
  rules/        one file per rule category (matches adjudication_rules.md)
  services/     geminiService (LLM extraction), adjudicationService (orchestrator)
  controllers/  request handlers
  routes/       express routers
  middleware/   multer upload, error handler
  utils/        doc reg validator, confidence aggregator
  data/         policy_terms.json + adjudication_rules.md
```
