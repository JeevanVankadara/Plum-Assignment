const CATEGORY_TO_POLICY_KEY = {
  consultation: 'consultation_fees',
  pharmacy: 'pharmacy',
  diagnostic: 'diagnostic_tests',
  dental: 'dental',
  vision: 'vision',
  alternative: 'alternative_medicine',
};

function textForClaim(claim) {
  return [
    claim.diagnosis,
    claim.evidenceText,
    ...(claim.lineItems || []).map(li => li.description),
  ].filter(Boolean).join(' ').toLowerCase();
}

function exclusionMatch(text) {
  const checks = [
    { label: 'Cosmetic procedures', re: /cosmetic|botox|filler|liposuction|whitening|aesthetic/ },
    { label: 'Weight loss treatments', re: /weight loss|obesity|bariatric|slimming|diet plan/ },
    { label: 'Infertility treatments', re: /infertility|ivf|fertility/ },
    { label: 'Experimental treatments', re: /experimental|trial drug|unproven/ },
    { label: 'Self-inflicted injuries', re: /self[- ]inflicted/ },
    { label: 'Alcoholism/drug abuse treatment', re: /alcoholism|drug abuse|substance abuse/ },
    { label: 'HIV/AIDS treatment', re: /\bhiv\b|aids/ },
    { label: 'Non-allopathic treatments (except listed)', re: /naturopathy|acupuncture|reiki/ },
  ];
  return checks.find(check => check.re.test(text));
}

function markExcludedItems(claim) {
  const rejected = [];
  for (const item of claim.lineItems || []) {
    const text = `${item.description || ''} ${claim.diagnosis || ''}`.toLowerCase();
    const match = exclusionMatch(text);
    if (match) {
      item.payable = false;
      item.rejectionReason = match.label;
      rejected.push(`${item.description} - ${match.label}`);
    }
  }
  return rejected;
}

export function runCoverage({ claim, policy }) {
  const trail = [];
  const claimText = textForClaim(claim);
  const rejectedItems = markExcludedItems(claim);
  const claimLevelExclusion = exclusionMatch(claimText);
  const hasPayableItem = (claim.lineItems || []).some(item => item.payable !== false);

  trail.push({
    step: 'coverage',
    ruleId: 'EXCLUDED_CONDITION',
    label: 'Not in exclusion list',
    status: claimLevelExclusion && !hasPayableItem ? 'fail' : rejectedItems.length ? 'warn' : 'pass',
    detail: claimLevelExclusion
      ? rejectedItems.length && hasPayableItem
        ? `Excluded item(s) removed: ${rejectedItems.join('; ')}`
        : `Condition matches exclusion: ${claimLevelExclusion.label}`
      : 'No matching exclusion',
    evidence: { rejectedItems },
  });

  const categories = new Set((claim.lineItems || []).filter(li => li.payable !== false).map(li => li.category));
  const uncovered = [...categories].filter(category => {
    const key = CATEGORY_TO_POLICY_KEY[category];
    return key ? policy.coverage_details[key]?.covered === false : category === 'other';
  });
  trail.push({
    step: 'coverage',
    ruleId: 'SERVICE_NOT_COVERED',
    label: 'All services covered',
    status: uncovered.length === 0 ? 'pass' : 'fail',
    detail: uncovered.length === 0 ? 'All payable line items are covered' : `Uncovered: ${uncovered.join(', ')}`,
  });

  const needsPreAuth = (claim.lineItems || []).some(li =>
    li.payable !== false && li.category === 'diagnostic' && /mri|ct scan|ct-scan/i.test(li.description || '')
  );
  trail.push({
    step: 'coverage',
    ruleId: 'PRE_AUTH_MISSING',
    label: 'Pre-authorization check',
    status: needsPreAuth && !claim.preAuthObtained ? 'fail' : 'pass',
    detail: needsPreAuth && !claim.preAuthObtained
      ? 'MRI/CT detected without pre-authorization'
      : 'No missing pre-authorization',
  });

  return trail;
}
