export function runMedical({ claim, policy }) {
  const trail = [];
  const diag = (claim.diagnosis || '').toLowerCase();
  const isCosmetic = /cosmetic|botox|filler|liposuction/.test(diag);
  const isExperimental = /experimental|trial drug/.test(diag);

  trail.push({
    step: 'medical', ruleId: 'COSMETIC_PROCEDURE', label: 'Not a cosmetic procedure',
    status: isCosmetic ? 'fail' : 'pass',
    detail: isCosmetic ? 'Cosmetic procedure detected' : 'No cosmetic indicators',
  });

  trail.push({
    step: 'medical', ruleId: 'EXPERIMENTAL_TREATMENT', label: 'Not experimental',
    status: isExperimental ? 'fail' : 'pass',
    detail: isExperimental ? 'Experimental treatment detected' : 'Standard treatment',
  });

  const necessityOk = !!claim.diagnosis && (claim.lineItems?.length ?? 0) > 0;
  trail.push({
    step: 'medical', ruleId: 'NOT_MEDICALLY_NECESSARY', label: 'Medical necessity established',
    status: necessityOk ? 'pass' : 'warn',
    detail: necessityOk ? 'Diagnosis supports prescribed items' : 'Diagnosis or line items missing',
  });

  return trail;
}
