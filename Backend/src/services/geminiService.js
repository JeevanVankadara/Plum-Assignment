import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs/promises';

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!apiKey) console.warn('GEMINI_API_KEY missing — extraction will fail until set.');

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const EXTRACTION_PROMPT = `You are a medical claim document parser.
Extract the following fields from the attached document and return STRICT JSON only (no markdown, no commentary).

Classify documentType carefully:
- Use "prescription" for any doctor/clinic prescription, Rx note, dental prescription, treatment plan, or doctor letterhead that contains diagnosis, prescribed medicines, prescribed tests, advised procedures, doctor registration, or doctor's signature/stamp.
- A prescription remains "prescription" even if it also mentions consultation fee, procedure fee, dental braces fee, treatment charges, or medicine names.
- Use "bill" only for invoices, receipts, pharmacy cash memos, paid bills, or lab/diagnostic invoices whose main purpose is itemized billing/payment.
- Use "lab_report" only for actual diagnostic test result reports, not for lab invoices.
- If both prescription and bill-like content appear, prefer "prescription" when the document is issued by a doctor and contains Rx/diagnosis/treatment advice.

Classify policy exclusions exactly:
- If the diagnosis, prescribed treatment, procedure, or medicines clearly fall under a policy exclusion, set "exclusionMatch" to exactly one of these strings:
  "Cosmetic procedures",
  "Weight loss treatments",
  "Infertility treatments",
  "Experimental treatments",
  "Self-inflicted injuries",
  "Adventure sports injuries",
  "War and nuclear risks",
  "HIV/AIDS treatment",
  "Alcoholism/drug abuse treatment",
  "Non-allopathic treatments (except listed)",
  "Vitamins and supplements (unless prescribed for deficiency)"
- If no exclusion applies, set "exclusionMatch" to null.
- Do not invent new exclusion labels. Use only the exact strings above or null.

Check diagnostic test relevance:
- Be particular about whether diagnostic tests align with the patient's diagnosis/problem.
- If a diagnostic test in the bill/invoice is not medically aligned with the diagnosis/problem, add it to "irrelevantTests".
- Include the test name and amount exactly as shown in the invoice/bill when available.
- Example: MRI or CT Scan for simple viral fever, mild throat infection, or routine fever without injury/neurological/back/abdominal/chest symptoms should be marked irrelevant.
- If the document does not contain enough diagnosis/problem context to judge relevance, keep "irrelevantTests" empty for that document.

{
  "documentType": "prescription | bill | lab_report | other",
  "patientName": string,
  "age": number | null,
  "memberId": string | null,
  "doctorName": string | null,
  "doctorRegNo": string | null,
  "provider": string | null,
  "serviceDate": "YYYY-MM-DD" | null,
  "submissionDate": "YYYY-MM-DD" | null,
  "diagnosis": string | null,
  "prescription": [string],
  "procedures": [string],
  "tests_prescribed": [string],
  "treatment": string | null,
  "exclusionMatch": string | null,
  "irrelevantTests": [{ "testName": string, "amount": number, "reason": string }],
  "preAuthObtained": boolean,
  "lineItems": [{ "description": string, "amount": number, "category": "consultation|pharmacy|diagnostic|dental|vision|alternative|other" }],
  "totalAmount": number,
  "legibilityScore": number  // 0..1
}
If a field is unknown return null or empty array. Use Indian Rupee numeric values only.
Do not include GST, CGST, SGST, IGST, tax, round-off, or service-charge rows in lineItems.`;

function logGeminiExtraction(file, parsed, rawText) {
  const summary = {
    file: file.originalname || file.filename,
    documentType: parsed.documentType,
    patientName: parsed.patientName,
    age: parsed.age,
    memberId: parsed.memberId,
    doctorName: parsed.doctorName,
    doctorRegNo: parsed.doctorRegNo,
    provider: parsed.provider,
    serviceDate: parsed.serviceDate,
    submissionDate: parsed.submissionDate,
    diagnosis: parsed.diagnosis,
    treatment: parsed.treatment,
    prescription: parsed.prescription,
    procedures: parsed.procedures,
    tests_prescribed: parsed.tests_prescribed,
    preAuthObtained: parsed.preAuthObtained,
    exclusionMatch: parsed.exclusionMatch,
    irrelevantTests: parsed.irrelevantTests,
    lineItems: parsed.lineItems,
    totalAmount: parsed.totalAmount,
    legibilityScore: parsed.legibilityScore,
    parseError: parsed._parseError || false,
  };

  console.log('\n[Gemini extraction result]');
  console.log(JSON.stringify(summary, null, 2));
  if (parsed._parseError) {
    console.log('[Gemini raw response - parse failed]');
    console.log(rawText);
  }
}

export async function extractFromDocument(file) {
  if (!genAI) throw new Error('Gemini not configured');

  const buffer = await fs.readFile(file.path);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
    { inlineData: { data: buffer.toString('base64'), mimeType: file.mimetype } },
  ]);

  const text = result.response.text();
  const cleaned = text.replace(/^```json\s*|\s*```$/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { documentType: 'other', lineItems: [], totalAmount: 0, legibilityScore: 0.3, _parseError: true };
  }

  logGeminiExtraction(file, parsed, text);

  return { parsed, raw: text };
}
