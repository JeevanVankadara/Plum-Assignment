import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs/promises';

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!apiKey) console.warn('GEMINI_API_KEY missing — extraction will fail until set.');

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const GEMINI_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 3);

const EXTRACTION_PROMPT = `You are a medical claim document parser.
Extract the following fields from the attached document and return STRICT JSON only (no markdown, no commentary).

Classify documentType carefully:
- Use "prescription" for any doctor/clinic prescription, Rx note, dental prescription, treatment plan, or doctor letterhead that contains diagnosis, prescribed medicines, prescribed tests, advised procedures, doctor registration, or doctor's signature/stamp.
- A prescription remains "prescription" even if it also mentions consultation fee, procedure fee, dental braces fee, treatment charges, or medicine names.
- A single page can be both prescription evidence and bill evidence. If a doctor-issued prescription also contains consultation fees, procedure charges, pharmacy items, lab/test charges, invoice numbers, totals, or paid bill rows, still use "prescription" but extract every billable row into lineItems.
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
- For each billable line item, also set item-level "exclusionMatch" when that specific item is excluded.
- Mark cosmetic dental/aesthetic items such as teeth whitening, cosmetic bleaching, smile improvement, aesthetic dental polishing, Botox, fillers, or liposuction as exactly "Cosmetic procedures".
- Do not mark the whole claim excluded if only some line items are cosmetic; keep covered line items separate.

Classify pharmacy bills carefully:
- For pharmacy invoices/cash memos, use category "pharmacy" for retail pharmacy rows such as tablets, capsules, syrups, sachets, ORS, vapor rubs, cough syrups, strips, chewables, thermometers, steam inhalers, and similar items unless the item is clearly diagnostic, dental, vision, or alternative treatment.
- Do not use category "other" for pharmacy bill rows only because they are devices/accessories. The backend will decide whether they are payable by checking if they were prescribed.
- For each pharmacy line item, set "prescriptionMatched" to true only if that exact or clearly equivalent item appears in an uploaded prescription; otherwise false. If uncertain, use false.

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
  "lineItems": [{ "description": string, "amount": number, "category": "consultation|pharmacy|diagnostic|dental|vision|alternative|other", "exclusionMatch": string | null, "prescriptionMatched": boolean | null }],
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error) {
  const message = String(error?.message || '');
  return error?.status === 503
    || error?.status === 429
    || /503|429|high demand|service unavailable|temporarily/i.test(message);
}

async function generateWithRetry(model, parts) {
  let lastError;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    try {
      return await model.generateContent(parts);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === GEMINI_MAX_RETRIES) throw error;

      const delayMs = 1200 * (attempt + 1);
      console.warn(`Gemini temporary error, retrying in ${delayMs}ms (${attempt + 1}/${GEMINI_MAX_RETRIES})`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

export async function extractFromDocument(file) {
  if (!genAI) throw new Error('Gemini not configured');

  const buffer = await fs.readFile(file.path);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await generateWithRetry(model, [
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
