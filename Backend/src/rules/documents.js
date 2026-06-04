import { isValidDoctorReg } from '../utils/docRegValidator.js';

const STOP_WORDS = new Set([
  'test',
  'tests',
  'profile',
  'examination',
  'routine',
  'complete',
  'count',
  'function',
  'blood',
  'with',
  'and',
  'the',
]);

function docTypeFrom(doc) {
  return (doc.documentType || doc.extractedFields?.documentType || 'other').toLowerCase();
}

function normalizeTestName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, match => ` ${match.replace(/[()]/g, '')} `)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokensFor(value = '') {
  return normalizeTestName(value)
    .split(/\s+/)
    .filter(token => token && !STOP_WORDS.has(token));
}

function acronymsFor(value = '') {
  const text = normalizeTestName(value);
  const fromParens = [...String(value).matchAll(/\(([A-Za-z0-9]+)\)/g)].map(match => match[1].toLowerCase());
  const words = text.split(/\s+/).filter(token => token && !STOP_WORDS.has(token));
  const acronym = words.length > 1 ? words.map(word => word[0]).join('') : '';
  return new Set([...fromParens, acronym].filter(Boolean));
}

function testsMatch(a, b) {
  const aText = normalizeTestName(a);
  const bText = normalizeTestName(b);
  if (!aText || !bText) return false;
  if (aText.includes(bText) || bText.includes(aText)) return true;

  const aTokens = new Set(tokensFor(a));
  const bTokens = new Set(tokensFor(b));
  const aAcronyms = acronymsFor(a);
  const bAcronyms = acronymsFor(b);
  if ([...aAcronyms].some(acronym => bTokens.has(acronym) || bAcronyms.has(acronym))) return true;
  if ([...bAcronyms].some(acronym => aTokens.has(acronym) || aAcronyms.has(acronym))) return true;

  const shared = [...aTokens].filter(token => bTokens.has(token));
  return shared.length > 0 && shared.length >= Math.min(aTokens.size, bTokens.size);
}

function isAncillaryDiagnostic(item) {
  return /sample collection|collection charge|home collection|handling/i.test(item.description || '');
}

function applyDiagnosticSupport(claim, hasBill) {
  const diagnosticItems = (claim.lineItems || []).filter(item => item.payable !== false && item.category === 'diagnostic');
  if (!diagnosticItems.length) {
    return { status: 'pass', detail: 'No diagnostic claim submitted', rejectedItems: [], matchedCount: 0 };
  }

  const prescribedTests = claim.prescribedTests || [];
  const invoiceTests = claim.diagnosticInvoiceTests || [];
  const hasPrescribedTests = prescribedTests.length > 0;
  const hasDiagnosticEvidence = hasBill && invoiceTests.length > 0;
  const rejectedItems = [];
  let matchedCount = 0;

  if (!hasPrescribedTests) {
    for (const item of diagnosticItems) {
      item.payable = false;
      item.rejectionReason = 'Diagnostic test not prescribed';
      rejectedItems.push(`${item.description} - diagnostic test not prescribed`);
    }
    const hasOtherPayable = (claim.lineItems || []).some(item => item.payable !== false);
    return {
      status: hasOtherPayable ? 'warn' : 'fail',
      detail: 'Diagnostic bill contains tests, but prescription does not prescribe diagnostic tests',
      rejectedItems,
      matchedCount,
    };
  }

  if (!hasDiagnosticEvidence) {
    for (const item of diagnosticItems) {
      item.payable = false;
      item.rejectionReason = 'Diagnostic invoice/report missing';
      rejectedItems.push(`${item.description} - diagnostic invoice/report missing`);
    }
    const hasOtherPayable = (claim.lineItems || []).some(item => item.payable !== false);
    return {
      status: hasOtherPayable ? 'warn' : 'fail',
      detail: `Prescribed diagnostic tests found (${prescribedTests.join(', ')}), but no matching diagnostic invoice/report was uploaded`,
      rejectedItems,
      matchedCount,
    };
  }

  for (const item of diagnosticItems) {
    if (isAncillaryDiagnostic(item)) continue;
    const matched = prescribedTests.some(prescribed => testsMatch(item.description, prescribed));
    if (matched) {
      matchedCount += 1;
    } else {
      item.payable = false;
      item.rejectionReason = 'Diagnostic test not prescribed';
      rejectedItems.push(`${item.description} - not found in prescription`);
    }
  }

  const hasMatchedTest = matchedCount > 0;
  for (const item of diagnosticItems.filter(isAncillaryDiagnostic)) {
    if (!hasMatchedTest) {
      item.payable = false;
      item.rejectionReason = 'Ancillary diagnostic charge without matched prescribed test';
      rejectedItems.push(`${item.description} - no matched prescribed diagnostic test`);
    }
  }

  const hasOtherPayable = (claim.lineItems || []).some(item => item.payable !== false);
  return {
    status: rejectedItems.length ? hasOtherPayable ? 'warn' : 'fail' : 'pass',
    detail: rejectedItems.length
      ? `Unmatched diagnostic item(s): ${rejectedItems.join('; ')}`
      : `Diagnostic invoice matches prescribed test(s): ${prescribedTests.join(', ')}`,
    rejectedItems,
    matchedCount,
  };
}

export function runDocuments({ claim, extractedDocs }) {
  const trail = [];
  const docs = extractedDocs || [];
  const types = new Set([...(claim.documentTypes || []), ...docs.map(docTypeFrom)].map(t => String(t).toLowerCase()));
  const hasPrescription = types.has('prescription');
  const hasBill = types.has('bill') || types.has('lab_report');
  const missing = [];

  if (!hasPrescription) missing.push('prescription');
  if (!hasBill) missing.push('bill');

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

  const diagnosticSupport = applyDiagnosticSupport(claim, hasBill);
  trail.push({
    step: 'documents',
    ruleId: 'INVALID_PRESCRIPTION',
    label: 'Prescription is present',
    status: hasPrescription ? 'pass' : 'fail',
    detail: hasPrescription ? 'Prescription found' : 'Prescription from registered doctor is required',
  });

  trail.push({
    step: 'documents',
    ruleId: 'MISSING_DIAGNOSTIC_SUPPORT',
    label: 'Diagnostic tests match prescription',
    status: diagnosticSupport.status,
    detail: diagnosticSupport.detail,
    evidence: {
      prescribedTests: claim.prescribedTests || [],
      diagnosticInvoiceTests: claim.diagnosticInvoiceTests || [],
      rejectedItems: diagnosticSupport.rejectedItems,
      matchedCount: diagnosticSupport.matchedCount,
    },
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
