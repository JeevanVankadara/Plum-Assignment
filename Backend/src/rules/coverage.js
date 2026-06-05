const CATEGORY_TO_POLICY_KEY = {
  consultation: 'consultation_fees',
  pharmacy: 'pharmacy',
  diagnostic: 'diagnostic_tests',
  dental: 'dental',
  vision: 'vision',
  alternative: 'alternative_medicine',
};

function exactPolicyExclusion(claim, policy) {
  const exclusions = new Set(policy.exclusions || []);
  const match = typeof claim.exclusionMatch === 'string' ? claim.exclusionMatch.trim() : null;
  return exclusions.has(match) ? match : null;
}

function markExcludedItems(claim, exclusion) {
  if (!exclusion) return [];
  const rejected = [];
  for (const item of claim.lineItems || []) {
    item.payable = false;
    item.rejectionReason = exclusion;
    rejected.push(`${item.description} - ${exclusion}`);
  }
  return rejected;
}

export function runCoverage({ claim, policy }) {
  const trail = [];
  const exclusion = exactPolicyExclusion(claim, policy);
  const rejectedItems = markExcludedItems(claim, exclusion);
  const hasPayableItem = (claim.lineItems || []).some(item => item.payable !== false);

  trail.push({
    step: 'coverage',
    ruleId: 'EXCLUDED_CONDITION',
    label: 'Not in exclusion list',
    status: exclusion && !hasPayableItem ? 'fail' : exclusion ? 'warn' : 'pass',
    detail: exclusion ? `Condition matches exclusion: ${exclusion}` : 'No matching exclusion',
    evidence: { exclusionMatch: exclusion, rejectedItems },
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
