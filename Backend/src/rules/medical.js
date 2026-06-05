function claimText(claim) {
  return [
    claim.diagnosis,
    claim.evidenceText,
    ...(claim.lineItems || []).map(li => li.description),
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalize(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function words(value = '') {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function testsMatch(a, b) {
  const aText = normalize(a);
  const bText = normalize(b);
  if (!aText || !bText) return false;
  if (aText.includes(bText) || bText.includes(aText)) return true;
  const aWords = new Set(words(aText));
  const bWords = new Set(words(bText));
  const shared = [...aWords].filter(word => bWords.has(word));
  return shared.length > 0 && shared.length >= Math.min(aWords.size, bWords.size, 2);
}

function categorySupported(category, text) {
  if (category === 'consultation') return true;
  if (category === 'pharmacy') return /fever|infection|pain|migraine|bronchitis|diabetes|hypertension|gastro|deficiency|prescri|medicine|tablet|capsule/.test(text);
  if (category === 'diagnostic') return /suspected|test|scan|cbc|x-?ray|ecg|mri|ct|diagnos|fever|pain|injury/.test(text);
  if (category === 'dental') return /tooth|teeth|decay|root canal|filling|extraction|dental/.test(text);
  if (category === 'vision') return /eye|vision|glasses|lens|sight/.test(text);
  if (category === 'alternative') return /ayurveda|homeopathy|unani|pain|therapy|panchakarma/.test(text);
  return false;
}

export function runIrrelevantDiagnostics({ claim }) {
  const irrelevantTests = claim.irrelevantTests || [];
  const rejectedItems = [];

  for (const test of irrelevantTests) {
    const matchedItem = (claim.lineItems || []).find(item =>
      item.category === 'diagnostic'
      && item.payable !== false
      && (testsMatch(item.description, test.testName)
        || (Number(test.amount) > 0 && Number(item.amount) === Number(test.amount)))
    );

    if (!matchedItem) continue;
    matchedItem.payable = false;
    matchedItem.rejectionReason = 'Irrelevant to diagnosis';
    test.excluded = true;
    rejectedItems.push(`${matchedItem.description} - irrelevant to diagnosis`);
  }

  return [{
    step: 'medical',
    ruleId: 'IRRELEVANT_DIAGNOSTIC_TEST',
    label: 'Diagnostic tests align with diagnosis',
    status: rejectedItems.length ? 'warn' : 'pass',
    detail: rejectedItems.length
      ? `Irrelevant diagnostic item(s) detected: ${rejectedItems.join('; ')}`
      : 'No irrelevant diagnostic tests detected',
    evidence: {
      manualReview: rejectedItems.length > 0,
      irrelevantTests,
      rejectedItems,
    },
  }];
}

export function runMedical({ claim }) {
  const trail = [];
  const text = claimText(claim);
  const isCosmetic = /cosmetic|botox|filler|liposuction|whitening|aesthetic/.test(text);
  const isExperimental = /experimental|trial drug|unproven/.test(text);

  trail.push({
    step: 'medical',
    ruleId: 'COSMETIC_PROCEDURE',
    label: 'Not a cosmetic procedure',
    status: isCosmetic && !(claim.lineItems || []).some(li => li.payable !== false) ? 'fail' : isCosmetic ? 'warn' : 'pass',
    detail: isCosmetic ? 'Cosmetic indicator detected and excluded where applicable' : 'No cosmetic indicators',
  });

  trail.push({
    step: 'medical',
    ruleId: 'EXPERIMENTAL_TREATMENT',
    label: 'Not experimental',
    status: isExperimental ? 'fail' : 'pass',
    detail: isExperimental ? 'Experimental treatment detected' : 'Standard treatment',
  });

  const payableItems = (claim.lineItems || []).filter(li => li.payable !== false);
  const unsupported = payableItems.filter(li => !categorySupported(li.category, text));
  const hasMinimumContext = !!claim.diagnosis && payableItems.length > 0;
  trail.push({
    step: 'medical',
    ruleId: 'NOT_MEDICALLY_NECESSARY',
    label: 'Medical necessity established',
    status: !hasMinimumContext ? 'fail' : unsupported.length ? 'warn' : 'pass',
    detail: !hasMinimumContext
      ? 'Diagnosis or payable line items missing'
      : unsupported.length
      ? `Could not confidently match item(s) to diagnosis: ${unsupported.map(li => li.description).join(', ')}`
      : 'Diagnosis supports payable items',
  });

  return trail;
}
