import test from 'node:test';
import assert from 'node:assert/strict';
import { adjudicate } from '../src/services/adjudicationService.js';

function docs(types, { serviceDate = '2024-11-01', legibility = 0.95 } = {}) {
  return types.map(type => ({
    documentType: type,
    legibilityScore: legibility,
    extractedFields: { documentType: type, serviceDate },
  }));
}

function baseClaim(overrides = {}) {
  return {
    claimId: 'CLM_TEST',
    memberId: 'EMP001',
    patient: 'Rajesh Kumar',
    age: 32,
    doctor: 'Dr. Sharma',
    docRegNo: 'KA/45678/2015',
    provider: 'Apollo Hospitals',
    serviceDate: '2024-11-01',
    documentTypes: ['prescription', 'bill'],
    diagnosis: 'Viral fever',
    exclusionMatch: null,
    evidenceText: 'Viral fever prescription paracetamol CBC test',
    prescribedTests: [],
    prescribedPharmacyItems: ['Paracetamol tablets'],
    diagnosticInvoiceTests: [],
    irrelevantTests: [],
    hasDiagnosticClaim: false,
    preAuthObtained: false,
    lineItems: [
      { description: 'Doctor consultation', amount: 1000, category: 'consultation', payable: true },
      { description: 'Paracetamol tablets', amount: 500, category: 'pharmacy', payable: true },
    ],
    claimed: 1500,
    ...overrides,
  };
}

test('approves a complete consultation claim', () => {
  const result = adjudicate({
    claim: baseClaim(),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.equal(result.approved, 1400);
  assert.deepEqual(result.rejectionReasons, []);
});

test('rejects when prescription is missing', () => {
  const result = adjudicate({
    claim: baseClaim({
      documentTypes: ['bill'],
      doctor: null,
      docRegNo: null,
      prescribedTests: [],
      prescribedPharmacyItems: [],
      evidenceText: '',
    }),
    extractedDocs: docs(['bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('MISSING_DOCUMENTS'));
  assert.ok(result.rejectionReasons.includes('INVALID_PRESCRIPTION'));
});

test('rejects an invalid doctor registration number', () => {
  const result = adjudicate({
    claim: baseClaim({ docRegNo: 'KMC-48291' }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('DOCTOR_REG_INVALID'));
});

test('rejects fully excluded weight loss treatment', () => {
  const result = adjudicate({
    claim: baseClaim({
      diagnosis: 'Obesity - BMI 35',
      exclusionMatch: 'Weight loss treatments',
      evidenceText: 'Obesity bariatric consultation diet plan',
      lineItems: [
        { description: 'Bariatric consultation', amount: 3000, category: 'consultation', payable: true },
        { description: 'Diet plan', amount: 5000, category: 'other', payable: true },
      ],
      claimed: 8000,
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.97,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('EXCLUDED_CONDITION'));
});

test('rejects exact cosmetic exclusion from Gemini', () => {
  const result = adjudicate({
    claim: baseClaim({
      diagnosis: 'Cosmetic dental alignment',
      treatment: 'Cosmetic braces fitting for smile improvement',
      exclusionMatch: 'Cosmetic procedures',
      lineItems: [
        { description: 'Orthodontic Braces fitting for smile improvement', amount: 8500, category: 'dental', exclusionMatch: 'Cosmetic procedures', payable: true },
        { description: 'Teeth Whitening', amount: 1000, category: 'dental', exclusionMatch: 'Cosmetic procedures', payable: true },
      ],
      claimed: 9500,
      evidenceText: 'Cosmetic dental alignment braces teeth whitening',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.97,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('EXCLUDED_CONDITION'));
});

test('single prescription page with bill line items satisfies required documents', () => {
  const result = adjudicate({
    claim: baseClaim({
      documentTypes: ['prescription'],
      lineItems: [
        { description: 'Consultation Fee', amount: 500, category: 'consultation', payable: true },
      ],
      claimed: 500,
      evidenceText: 'Viral fever consultation fee prescription',
    }),
    extractedDocs: [
      {
        documentType: 'prescription',
        legibilityScore: 0.95,
        extractedFields: {
          documentType: 'prescription',
          serviceDate: '2024-11-01',
          totalAmount: 500,
          lineItems: [{ description: 'Consultation Fee', amount: 500, category: 'consultation' }],
        },
      },
    ],
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.ok(!result.rejectionReasons.includes('MISSING_DOCUMENTS'));
});

test('partially approves root canal while excluding cosmetic whitening', () => {
  const result = adjudicate({
    claim: baseClaim({
      documentTypes: ['prescription'],
      diagnosis: 'Tooth decay requiring root canal treatment',
      evidenceText: 'Tooth decay root canal treatment teeth whitening cosmetic',
      lineItems: [
        { description: 'Consultation Fee', amount: 500, category: 'consultation', payable: true },
        { description: 'Root canal treatment - Molar #36', amount: 8000, category: 'dental', payable: true },
        { description: 'Teeth whitening - full arch cosmetic bleaching', amount: 4000, category: 'dental', exclusionMatch: 'Cosmetic procedures', payable: true },
        { description: 'Medicines', amount: 500, category: 'pharmacy', payable: true },
      ],
      prescribedPharmacyItems: ['Medicines'],
      claimed: 13000,
    }),
    extractedDocs: docs(['prescription']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'PARTIAL');
  assert.equal(result.approved, 4950);
  assert.ok(result.rejectedItems.some(item => item.includes('Teeth whitening') && item.includes('Cosmetic procedures')));
  assert.ok(!result.rejectionReasons.includes('EXCLUDED_CONDITION'));
});

test('partially approves fever items while excluding unrelated cosmetic item', () => {
  const result = adjudicate({
    claim: baseClaim({
      diagnosis: 'Viral fever',
      evidenceText: 'Viral fever consultation paracetamol teeth whitening cosmetic',
      lineItems: [
        { description: 'Doctor consultation', amount: 500, category: 'consultation', payable: true },
        { description: 'Paracetamol tablets', amount: 200, category: 'pharmacy', payable: true },
        { description: 'Teeth whitening cosmetic bleaching', amount: 3000, category: 'dental', payable: true },
      ],
      claimed: 3700,
    }),
    extractedDocs: docs(['prescription']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'PARTIAL');
  assert.equal(result.approved, 650);
  assert.ok(result.rejectedItems.some(item => item.includes('Cosmetic procedures')));
});

test('rejects when all claimed items are cosmetic exclusions', () => {
  const result = adjudicate({
    claim: baseClaim({
      diagnosis: 'Cosmetic smile improvement',
      evidenceText: 'Cosmetic teeth whitening aesthetic dental polishing',
      lineItems: [
        { description: 'Teeth whitening cosmetic bleaching', amount: 4000, category: 'dental', payable: true },
        { description: 'Aesthetic dental polishing', amount: 1000, category: 'dental', payable: true },
      ],
      claimed: 5000,
    }),
    extractedDocs: docs(['prescription']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('EXCLUDED_CONDITION'));
});

test('same prescription page can provide diagnostic billing evidence', () => {
  const result = adjudicate({
    claim: baseClaim({
      documentTypes: ['prescription'],
      prescribedTests: ['CBC'],
      diagnosticInvoiceTests: ['Complete Blood Count (CBC)'],
      hasDiagnosticClaim: true,
      lineItems: [
        { description: 'Consultation Fee', amount: 150, category: 'consultation', payable: true },
        { description: 'Complete Blood Count (CBC)', amount: 350, category: 'diagnostic', payable: true },
      ],
      claimed: 500,
      evidenceText: 'Viral fever CBC Complete Blood Count prescribed and billed',
    }),
    extractedDocs: [
      {
        documentType: 'prescription',
        legibilityScore: 0.95,
        extractedFields: {
          documentType: 'prescription',
          serviceDate: '2024-11-01',
          tests_prescribed: ['CBC'],
          totalAmount: 500,
          lineItems: [
            { description: 'Consultation Fee', amount: 150, category: 'consultation' },
            { description: 'Complete Blood Count (CBC)', amount: 350, category: 'diagnostic' },
          ],
        },
      },
    ],
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.ok(!result.rejectionReasons.includes('MISSING_DOCUMENTS'));
  assert.ok(!result.rejectionReasons.includes('MISSING_DIAGNOSTIC_SUPPORT'));
});

test('ignores non-policy exclusion labels from Gemini', () => {
  const result = adjudicate({
    claim: baseClaim({
      diagnosis: 'Viral fever',
      exclusionMatch: 'Cosmetic',
      lineItems: [
        { description: 'Doctor consultation', amount: 500, category: 'consultation', payable: true },
      ],
      claimed: 500,
      evidenceText: 'Viral fever doctor consultation',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.ok(!result.rejectionReasons.includes('EXCLUDED_CONDITION'));
});

test('partially approves a claim over the per-claim limit', () => {
  const result = adjudicate({
    claim: baseClaim({
      lineItems: [
        { description: 'Doctor consultation', amount: 2000, category: 'consultation', payable: true },
        { description: 'Medicines', amount: 5500, category: 'pharmacy', payable: true },
      ],
      prescribedPharmacyItems: ['Medicines'],
      claimed: 7500,
      evidenceText: 'Gastroenteritis prescription antibiotics probiotics',
      diagnosis: 'Gastroenteritis',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.98,
  });

  assert.equal(result.decision, 'PARTIAL');
  assert.equal(result.approved, 4800);
  assert.equal(result.rejectionReasons.length, 0);
});

test('rejects MRI without pre-authorization', () => {
  const result = adjudicate({
    claim: baseClaim({
      documentTypes: ['prescription', 'bill', 'lab_report'],
      prescribedTests: ['MRI Lumbar Spine'],
      diagnosticInvoiceTests: ['MRI Lumbar Spine'],
      hasDiagnosticClaim: true,
      lineItems: [
        { description: 'MRI Lumbar Spine', amount: 15000, category: 'diagnostic', payable: true },
      ],
      claimed: 15000,
      diagnosis: 'Suspected lumbar disc herniation',
      evidenceText: 'Suspected lumbar disc herniation MRI Lumbar Spine',
    }),
    extractedDocs: docs(['prescription', 'bill', 'lab_report']),
    llmConfidence: 0.94,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('PRE_AUTH_MISSING'));
});

test('routes fever claim with irrelevant MRI to manual review and deducts MRI amount', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedTests: ['MRI Brain'],
      diagnosticInvoiceTests: ['MRI Brain'],
      irrelevantTests: [
        {
          testName: 'MRI Brain',
          amount: 5000,
          reason: 'MRI does not align with simple viral fever',
          excluded: true,
        },
      ],
      hasDiagnosticClaim: true,
      preAuthObtained: true,
      lineItems: [
        { description: 'Doctor consultation', amount: 500, category: 'consultation', payable: true },
        { description: 'MRI Brain', amount: 5000, category: 'diagnostic', payable: true },
      ],
      claimed: 5500,
      diagnosis: 'Viral fever',
      evidenceText: 'Viral fever MRI Brain',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'MANUAL_REVIEW');
  assert.equal(result.approved, 450);
  assert.equal(result.deductions, 5000);
  assert.ok(result.rejectedItems.some(item => item.includes('irrelevant to diagnosis')));
});

test('ignores irrelevant entries that do not match diagnostic line items', () => {
  const result = adjudicate({
    claim: baseClaim({
      irrelevantTests: [
        {
          testName: 'Paracetamol tablets',
          amount: 500,
          reason: 'Incorrectly flagged non-diagnostic item',
          excluded: true,
        },
      ],
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.equal(result.approved, 1400);
});

test('accepts diagnostic invoice when tests match prescription', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedTests: ['CBC'],
      diagnosticInvoiceTests: ['Complete Blood Count (CBC)'],
      hasDiagnosticClaim: true,
      lineItems: [
        { description: 'Doctor consultation', amount: 500, category: 'consultation', payable: true },
        { description: 'Complete Blood Count (CBC)', amount: 350, category: 'diagnostic', payable: true },
      ],
      claimed: 850,
      diagnosis: 'Viral fever',
      evidenceText: 'Viral fever CBC Complete Blood Count',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.deepEqual(result.rejectionReasons, []);
});

test('rejects diagnostic bill items when no tests were prescribed', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedTests: [],
      diagnosticInvoiceTests: ['Complete Blood Count (CBC)', 'Liver Function Test'],
      hasDiagnosticClaim: true,
      lineItems: [
        { description: 'Doctor consultation', amount: 500, category: 'consultation', payable: true },
        { description: 'Complete Blood Count (CBC)', amount: 350, category: 'diagnostic', payable: true },
        { description: 'Liver Function Test', amount: 650, category: 'diagnostic', payable: true },
      ],
      claimed: 1500,
      evidenceText: 'Viral fever paracetamol azithromycin Complete Blood Count Liver Function Test',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'PARTIAL');
  assert.equal(result.approved, 450);
  assert.ok(result.rejectedItems.some(item => item.includes('diagnostic test not prescribed')));
});

test('does not require diagnostic evidence when only consultation or pharmacy is claimed', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedTests: ['CBC'],
      diagnosticInvoiceTests: [],
      hasDiagnosticClaim: false,
      lineItems: [
        { description: 'Doctor consultation', amount: 500, category: 'consultation', payable: true },
        { description: 'Paracetamol tablets', amount: 100, category: 'pharmacy', payable: true },
      ],
      claimed: 600,
      evidenceText: 'Viral fever CBC prescribed paracetamol',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.deepEqual(result.rejectionReasons, []);
});

test('keeps prescribed pharmacy items payable', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedPharmacyItems: ['Tab. Paracetamol 650 mg - 1 tab TID x 5 days'],
      lineItems: [
        { description: 'Paracetamol 650 mg (15 tabs)', amount: 600, category: 'pharmacy', payable: true },
      ],
      claimed: 600,
      evidenceText: 'Viral fever paracetamol prescribed',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.equal(result.approved, 600);
  assert.deepEqual(result.rejectedItems, []);
});

test('deducts pharmacy bill items that are not in prescription', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedPharmacyItems: [
        'Tab. Paracetamol 650 mg',
        'Tab. Ibuprofen 400 mg',
        'Cap. Doxycycline 100 mg',
        'Tab. Cetirizine 10 mg',
        'ORS Sachet',
      ],
      lineItems: [
        { description: 'Paracetamol 650 mg (15 tabs)', amount: 35, category: 'pharmacy', payable: true },
        { description: 'Ibuprofen 400 mg (10 tabs)', amount: 42, category: 'pharmacy', payable: true },
        { description: 'Doxycycline 100 mg (10 caps)', amount: 88, category: 'pharmacy', payable: true },
        { description: 'Cetirizine 10 mg (10 tabs)', amount: 24, category: 'pharmacy', payable: true },
        { description: 'ORS Sachet (Electral) 21g', amount: 88, category: 'pharmacy', payable: true },
        { description: 'Vicks VapoRub 25 ml', amount: 110, category: 'pharmacy', payable: true },
        { description: 'Steam Inhaler (Plastic)', amount: 260, category: 'pharmacy', payable: true },
        { description: 'Digital Thermometer', amount: 185, category: 'pharmacy', payable: true },
        { description: 'Honitus Cough Syrup 100 ml', amount: 95, category: 'pharmacy', payable: true },
        {
          description: 'Vitamin C Chewable (15 tabs)',
          amount: 120,
          category: 'pharmacy',
          exclusionMatch: 'Vitamins and supplements (unless prescribed for deficiency)',
          payable: true,
        },
      ],
      claimed: 1047,
      evidenceText: 'Acute viral fever paracetamol ibuprofen doxycycline cetirizine ORS',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'PARTIAL');
  assert.equal(result.approved, 277);
  assert.ok(result.rejectedItems.some(item => item === 'Vicks VapoRub 25 ml - not prescribed'));
  assert.ok(result.rejectedItems.some(item => item === 'Steam Inhaler (Plastic) - not prescribed'));
  assert.ok(result.rejectedItems.some(item => item === 'Digital Thermometer - not prescribed'));
  assert.ok(result.rejectedItems.some(item => item.includes('Vitamin C Chewable') && item.includes('Vitamins and supplements')));
  assert.ok(!result.rejectionReasons.includes('SERVICE_NOT_COVERED'));
});

test('rejects when only non-prescribed pharmacy items are claimed', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedPharmacyItems: ['Paracetamol 650 mg'],
      lineItems: [
        { description: 'Vicks VapoRub 25 ml', amount: 110, category: 'pharmacy', payable: true },
        { description: 'Digital Thermometer', amount: 185, category: 'pharmacy', payable: true },
      ],
      claimed: 295,
      evidenceText: 'Viral fever paracetamol',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('PHARMACY_NOT_PRESCRIBED'));
});

test('does not fully reject mixed claims only because one item is other', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedPharmacyItems: ['Paracetamol 650 mg'],
      lineItems: [
        { description: 'Paracetamol 650 mg (15 tabs)', amount: 600, category: 'pharmacy', payable: true },
        { description: 'Unclear wellness accessory', amount: 185, category: 'other', payable: true },
      ],
      claimed: 785,
      evidenceText: 'Viral fever paracetamol',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'PARTIAL');
  assert.ok(!result.rejectionReasons.includes('SERVICE_NOT_COVERED'));
  assert.ok(result.rejectedItems.some(item => item.includes('service not covered')));
});

test('rejects diagnostic amount when prescribed test has no invoice or report', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedTests: ['CBC'],
      diagnosticInvoiceTests: [],
      hasDiagnosticClaim: true,
      lineItems: [
        { description: 'CBC charge', amount: 350, category: 'diagnostic', payable: true },
      ],
      claimed: 350,
      evidenceText: 'Viral fever CBC prescribed',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'REJECTED');
  assert.ok(result.rejectionReasons.includes('MISSING_DIAGNOSTIC_SUPPORT'));
});

test('allows sample collection only with a matched prescribed diagnostic test', () => {
  const result = adjudicate({
    claim: baseClaim({
      prescribedTests: ['CBC'],
      diagnosticInvoiceTests: ['Complete Blood Count (CBC)'],
      hasDiagnosticClaim: true,
      lineItems: [
        { description: 'Complete Blood Count (CBC)', amount: 350, category: 'diagnostic', payable: true },
        { description: 'Sample Collection Charges', amount: 150, category: 'diagnostic', payable: true },
      ],
      claimed: 500,
      evidenceText: 'Viral fever CBC Complete Blood Count Sample Collection Charges',
    }),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
  });

  assert.equal(result.decision, 'APPROVED');
  assert.equal(result.approved, 500);
});

test('routes low-confidence claims to manual review', () => {
  const result = adjudicate({
    claim: baseClaim(),
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.2,
  });

  assert.equal(result.decision, 'MANUAL_REVIEW');
});

test('routes same-day duplicate patterns to manual review', () => {
  const claim = baseClaim({ memberId: 'EMP008', provider: 'Fortis Healthcare', claimed: 4800 });
  const result = adjudicate({
    claim,
    extractedDocs: docs(['prescription', 'bill']),
    llmConfidence: 0.95,
    previousClaims: [
      { memberId: 'EMP008', patient: claim.patient, provider: claim.provider, serviceDate: claim.serviceDate, claimed: 4800, approved: 3000 },
    ],
  });

  assert.equal(result.decision, 'MANUAL_REVIEW');
  assert.ok(result.fraudFlags.length > 0);
});
