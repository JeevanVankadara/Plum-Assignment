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
