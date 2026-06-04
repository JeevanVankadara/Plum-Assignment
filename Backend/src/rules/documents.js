import { isValidDoctorReg } from '../utils/docRegValidator.js';

function docTypeFrom(doc) {
  return (doc.documentType || doc.extractedFields?.documentType || 'other').toLowerCase();
}

export function runDocuments({ claim, extractedDocs }) {
  const trail = [];
  const docs = extractedDocs || [];
  const types = new Set([...(claim.documentTypes || []), ...docs.map(docTypeFrom)].map(t => String(t).toLowerCase()));
  const hasDiagnosticItems = (claim.lineItems || []).some(li => li.category === 'diagnostic');
  const missing = [];

  if (!types.has('prescription')) missing.push('prescription');
  if (!types.has('bill')) missing.push('bill');
  if (hasDiagnosticItems && !types.has('lab_report')) missing.push('lab_report');

  trail.push({
    step: 'documents',
    ruleId: 'MISSING_DOCUMENTS',
    label: 'Required documents submitted',
    status: docs.length > 0 && missing.length === 0 ? 'pass' : 'fail',
    detail: docs.length
      ? missing.length
        ? `Missing required document(s): ${missing.join(', ')}`
        : `${docs.length} document(s) received`
      : 'No documents uploaded',
  });

  trail.push({
    step: 'documents',
    ruleId: 'INVALID_PRESCRIPTION',
    label: 'Prescription is present',
    status: types.has('prescription') ? 'pass' : 'fail',
    detail: types.has('prescription') ? 'Prescription found' : 'Prescription from registered doctor is required',
  });

  const avgLegibility = docs.length
    ? docs.reduce((s, d) => s + (d.legibilityScore ?? 0.5), 0) / docs.length
    : 0;
  trail.push({
    step: 'documents',
    ruleId: 'ILLEGIBLE_DOCUMENTS',
    label: 'Document legibility',
    status: avgLegibility >= 0.6 ? 'pass' : 'fail',
    detail: `Average legibility ${(avgLegibility * 100).toFixed(0)}%`,
  });

  const regValid = isValidDoctorReg(claim.docRegNo);
  trail.push({
    step: 'documents',
    ruleId: 'DOCTOR_REG_INVALID',
    label: 'Doctor registration number',
    status: regValid ? 'pass' : 'fail',
    detail: regValid ? `Reg ${claim.docRegNo} valid` : `Reg "${claim.docRegNo ?? 'missing'}" not in accepted format`,
  });

  const dates = docs.map(d => d.extractedFields?.serviceDate).filter(Boolean);
  const datesMatch = dates.length > 0 && dates.every(d => d === dates[0]) && (!claim.serviceDate || claim.serviceDate === dates[0]);
  trail.push({
    step: 'documents',
    ruleId: 'DATE_MISMATCH',
    label: 'Treatment date consistency',
    status: datesMatch ? 'pass' : 'fail',
    detail: dates.length
      ? datesMatch ? 'All document dates align' : `Conflicting dates: ${dates.join(', ')}`
      : 'Treatment date missing from documents',
  });

  const patientOk = !!claim.patient;
  trail.push({
    step: 'documents',
    ruleId: 'PATIENT_MISMATCH',
    label: 'Patient details match policy',
    status: patientOk ? 'pass' : 'fail',
    detail: patientOk ? `Patient: ${claim.patient}` : 'Patient name missing',
  });

  return trail;
}
