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
    evidenceText: 'Viral fever prescription paracetamol CBC test',
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
    claim: baseClaim({ documentTypes: ['bill'] }),
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

test('partially approves a claim over the per-claim limit', () => {
  const result = adjudicate({
    claim: baseClaim({
      lineItems: [
        { description: 'Doctor consultation', amount: 2000, category: 'consultation', payable: true },
        { description: 'Medicines', amount: 5500, category: 'pharmacy', payable: true },
      ],
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
