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

const PHARMACY_STOP_WORDS = new Set([
  'tab',
  'tablet',
  'tablets',
  'cap',
  'capsule',
  'capsules',
  'syrup',
  'sachet',
  'strip',
  'strips',
  'of',
  'mg',
  'ml',
  'gm',
  'g',
  'mcg',
  'iu',
  'tabs',
  'caps',
  'days',
  'day',
  'after',
  'food',
  'before',
  'sos',
  'bd',
  'tid',
  'tds',
  'od',
  'hs',
  'qid',
  'water',
  'sip',
  'throughout',
  'for',
  'with',
  'if',
  'fever',
]);

function docTypeFrom(doc) {
  return (doc.documentType || doc.extractedFields?.documentType || 'other').toLowerCase();
}

function hasPrescriptionEvidence(claim, docs) {
  const types = new Set([...(claim.documentTypes || []), ...docs.map(docTypeFrom)].map(t => String(t).toLowerCase()));
  const docsHavePrescriptionContent = docs.some(doc => {
    const fields = doc.extractedFields || {};
    return docTypeFrom(doc) === 'prescription'
      || !!fields.doctorName
      || !!fields.doctorRegNo
      || !!fields.diagnosis
      || !!fields.treatment
      || (Array.isArray(fields.prescription) && fields.prescription.length > 0)
      || (Array.isArray(fields.procedures) && fields.procedures.length > 0)
      || (Array.isArray(fields.tests_prescribed) && fields.tests_prescribed.length > 0);
  });
  const hasClinicalText = !!(
    claim.doctor
    || claim.docRegNo
    || (claim.prescribedTests || []).length
    || (claim.prescribedPharmacyItems || []).length
  );
  return types.has('prescription') || docsHavePrescriptionContent || hasClinicalText;
}

function hasBillEvidence(claim, docs) {
  const types = new Set([...(claim.documentTypes || []), ...docs.map(docTypeFrom)].map(t => String(t).toLowerCase()));
  const docHasAmount = docs.some(doc => {
    const fields = doc.extractedFields || {};
    return Number(fields.totalAmount) > 0 || (Array.isArray(fields.lineItems) && fields.lineItems.length > 0);
  });
  return types.has('bill')
    || types.has('lab_report')
    || (claim.lineItems || []).length > 0
    || Number(claim.claimed) > 0
    || docHasAmount;
}

function samePageDiagnosticTests(docs) {
  return docs
    .filter(doc => docTypeFrom(doc) === 'prescription')
    .flatMap(doc => Array.isArray(doc.extractedFields?.lineItems) ? doc.extractedFields.lineItems : [])
    .filter(item => /diagnostic|test|scan|x-?ray|mri|ct|cbc|ecg|ultrasound|lab/i.test(`${item.category || ''} ${item.description || ''}`))
    .map(item => item.description)
    .filter(Boolean);
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

function tokensForMedicine(value = '') {
  return normalizeTestName(value)
    .split(/\s+/)
    .filter(token => token && !PHARMACY_STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function medicinesMatch(a, b) {
  const aText = normalizeTestName(a);
  const bText = normalizeTestName(b);
  if (!aText || !bText) return false;
  if (aText.includes(bText) || bText.includes(aText)) return true;

  const aTokens = new Set(tokensForMedicine(a));
  const bTokens = new Set(tokensForMedicine(b));
  const shared = [...aTokens].filter(token => bTokens.has(token));
  return shared.length > 0;
}

function isAncillaryDiagnostic(item) {
  return /sample collection|collection charge|home collection|handling/i.test(item.description || '');
}

function applyDiagnosticSupport(claim, hasBill, docs) {
  const diagnosticItems = (claim.lineItems || []).filter(item => item.payable !== false && item.category === 'diagnostic');
  if (!diagnosticItems.length) {
    return { status: 'pass', detail: 'No diagnostic claim submitted', rejectedItems: [], matchedCount: 0 };
  }

  const prescribedTests = claim.prescribedTests || [];
  const invoiceTests = [...new Set([...(claim.diagnosticInvoiceTests || []), ...samePageDiagnosticTests(docs)])];
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

function applyPharmacySupport(claim) {
  const pharmacyItems = (claim.lineItems || []).filter(item =>
    item.payable !== false
    && item.category === 'pharmacy'
    && !item.exclusionMatch
  );
  if (!pharmacyItems.length) {
    return { status: 'pass', detail: 'No pharmacy claim submitted', rejectedItems: [], matchedCount: 0 };
  }

  const prescribedItems = claim.prescribedPharmacyItems || [];
  const rejectedItems = [];
  let matchedCount = 0;

  for (const item of pharmacyItems) {
    const matched = prescribedItems.some(prescribed => medicinesMatch(item.description, prescribed));
    item.prescriptionMatched = matched;
    if (matched) {
      matchedCount += 1;
      continue;
    }

    item.payable = false;
    item.rejectionReason = 'Not prescribed';
    rejectedItems.push(`${item.description} - not prescribed`);
  }

  const hasOtherPayable = (claim.lineItems || []).some(item => item.payable !== false);
  return {
    status: rejectedItems.length ? hasOtherPayable ? 'warn' : 'fail' : 'pass',
    detail: rejectedItems.length
      ? `Unprescribed pharmacy item(s): ${rejectedItems.join('; ')}`
      : `Pharmacy bill items match prescription (${matchedCount} item(s))`,
    rejectedItems,
    matchedCount,
  };
}

export function runDocuments({ claim, extractedDocs }) {
  const trail = [];
  const docs = extractedDocs || [];
  const hasPrescription = hasPrescriptionEvidence(claim, docs);
  const hasBill = hasBillEvidence(claim, docs);
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

  const diagnosticSupport = applyDiagnosticSupport(claim, hasBill, docs);
  const pharmacySupport = applyPharmacySupport(claim);
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

  trail.push({
    step: 'documents',
    ruleId: 'PHARMACY_NOT_PRESCRIBED',
    label: 'Pharmacy items match prescription',
    status: pharmacySupport.status,
    detail: pharmacySupport.detail,
    evidence: {
      prescribedPharmacyItems: claim.prescribedPharmacyItems || [],
      rejectedItems: pharmacySupport.rejectedItems,
      matchedCount: pharmacySupport.matchedCount,
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
