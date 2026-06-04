import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs/promises';

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!apiKey) console.warn('GEMINI_API_KEY missing — extraction will fail until set.');

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const EXTRACTION_PROMPT = `You are a medical claim document parser.
Extract the following fields from the attached document and return STRICT JSON only (no markdown, no commentary):
{
  "documentType": "prescription | bill | lab_report | other",
  "patientName": string,
  "age": number | null,
  "memberId": string | null,
  "doctorName": string | null,
  "doctorRegNo": string | null,
  "provider": string | null,
  "serviceDate": "YYYY-MM-DD" | null,
  "diagnosis": string | null,
  "prescription": [string],
  "lineItems": [{ "description": string, "amount": number, "category": "consultation|pharmacy|diagnostic|dental|vision|alternative|other" }],
  "totalAmount": number,
  "legibilityScore": number  // 0..1
}
If a field is unknown return null or empty array. Use Indian Rupee numeric values only.`;

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

  return { parsed, raw: text };
}
