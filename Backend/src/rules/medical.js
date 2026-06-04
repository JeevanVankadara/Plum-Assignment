function claimText(claim) {
  return [
    claim.diagnosis,
    claim.evidenceText,
    ...(claim.lineItems || []).map(li => li.description),
  ].filter(Boolean).join(' ').toLowerCase();
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
