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

function cosmeticFallback(description = '') {
  return /teeth whitening|tooth whitening|cosmetic bleaching|smile improvement|aesthetic.*polish|cosmetic polishing|botox|filler|liposuction/i.test(description)
    ? 'Cosmetic procedures'
    : null;
}

function itemPolicyExclusion(item, policy) {
  const exclusions = new Set(policy.exclusions || []);
  const exact = typeof item.exclusionMatch === 'string' ? item.exclusionMatch.trim() : null;
  if (exclusions.has(exact)) return exact;
  const fallback = cosmeticFallback(item.description);
  return exclusions.has(fallback) ? fallback : null;
}

function markExcludedItems(claim, policy, claimLevelExclusion) {
  const rejected = [];
  let itemLevelExcluded = false;
  for (const item of claim.lineItems || []) {
    const exclusion = itemPolicyExclusion(item, policy);
    if (!exclusion) continue;
    item.payable = false;
    item.rejectionReason = exclusion;
    itemLevelExcluded = true;
    rejected.push(`${item.description} - ${exclusion}`);
  }

  if (!itemLevelExcluded && claimLevelExclusion) {
    for (const item of claim.lineItems || []) {
      item.payable = false;
      item.rejectionReason = claimLevelExclusion;
      rejected.push(`${item.description} - ${claimLevelExclusion}`);
    }
  }
  return rejected;
}

function isCategoryCovered(category, policy) {
  const key = CATEGORY_TO_POLICY_KEY[category];
  if (!key) return false;
  return policy.coverage_details[key]?.covered !== false;
}

function markUncoveredItems(claim, policy) {
  const rejected = [];
  for (const item of claim.lineItems || []) {
    if (item.payable === false) continue;
    if (isCategoryCovered(item.category, policy)) continue;

    item.payable = false;
    item.rejectionReason = 'Service not covered';
    rejected.push(`${item.description} - service not covered`);
  }
  return rejected;
}

export function runCoverage({ claim, policy }) {
  const trail = [];
  const exclusion = exactPolicyExclusion(claim, policy);
  const rejectedItems = markExcludedItems(claim, policy, exclusion);
  const hasPayableItem = (claim.lineItems || []).some(item => item.payable !== false);

  trail.push({
    step: 'coverage',
    ruleId: 'EXCLUDED_CONDITION',
    label: 'Not in exclusion list',
    status: rejectedItems.length && !hasPayableItem ? 'fail' : rejectedItems.length ? 'warn' : 'pass',
    detail: rejectedItems.length
      ? hasPayableItem
        ? `Excluded item(s) removed: ${rejectedItems.join('; ')}`
        : `All claimed items match exclusion: ${exclusion || 'Excluded items'}`
      : 'No matching exclusion',
    evidence: { exclusionMatch: exclusion, rejectedItems },
  });

  const uncoveredItems = markUncoveredItems(claim, policy);
  const hasCoveredPayableItem = (claim.lineItems || []).some(item => item.payable !== false);
  trail.push({
    step: 'coverage',
    ruleId: 'SERVICE_NOT_COVERED',
    label: 'All services covered',
    status: uncoveredItems.length === 0 ? 'pass' : hasCoveredPayableItem ? 'warn' : 'fail',
    detail: uncoveredItems.length === 0
      ? 'All payable line items are covered'
      : hasCoveredPayableItem
        ? `Uncovered item(s) removed: ${uncoveredItems.join('; ')}`
        : `No payable covered services remain: ${uncoveredItems.join('; ')}`,
    evidence: { rejectedItems: uncoveredItems },
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
