import { isValidDoctorReg } from '../utils/docRegValidator.js';

export function runDocuments({ claim, extractedDocs }) {
  const trail = [];

  const hasDocs = extractedDocs.length > 0;
  trail.push({
    step: 'documents', ruleId: 'MISSING_DOCUMENTS', label: 'Required documents submitted',
    status: hasDocs ? 'pass' : 'fail',
    detail: hasDocs ? `${extractedDocs.length} document(s) received` : 'No documents uploaded',
  });

  const avgLegibility = hasDocs
    ? extractedDocs.reduce((s, d) => s + (d.legibilityScore ?? 0.5), 0) / extractedDocs.length
    : 0;
  trail.push({
    step: 'documents', ruleId: 'ILLEGIBLE_DOCUMENTS', label: 'Document legibility',
    status: avgLegibility >= 0.6 ? 'pass' : avgLegibility >= 0.4 ? 'warn' : 'fail',
    detail: `Average legibility ${(avgLegibility * 100).toFixed(0)}%`,
  });

  const regValid = isValidDoctorReg(claim.docRegNo);
  trail.push({
    step: 'documents', ruleId: 'DOCTOR_REG_INVALID', label: 'Doctor registration number',
    status: regValid ? 'pass' : 'fail',
    detail: regValid ? `Reg ${claim.docRegNo} valid` : `Reg "${claim.docRegNo ?? 'missing'}" not in [State]/[Number]/[Year] format`,
  });

  const dates = extractedDocs.map(d => d.extractedFields?.serviceDate).filter(Boolean);
  const datesMatch = dates.length <= 1 || dates.every(d => d === dates[0]);
  trail.push({
    step: 'documents', ruleId: 'DATE_MISMATCH', label: 'Treatment date consistency',
    status: datesMatch ? 'pass' : 'warn',
    detail: datesMatch ? 'All document dates align' : `Conflicting dates: ${dates.join(', ')}`,
  });

  const patientOk = !!claim.patient;
  trail.push({
    step: 'documents', ruleId: 'PATIENT_MISMATCH', label: 'Patient details match policy',
    status: patientOk ? 'pass' : 'warn',
    detail: patientOk ? `Patient: ${claim.patient}` : 'Patient name missing',
  });

  return trail;
}
