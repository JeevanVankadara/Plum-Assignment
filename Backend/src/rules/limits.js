const SUB_LIMIT_MAP = {
  consultation: 'consultation_fees',
  pharmacy: 'pharmacy',
  diagnostic: 'diagnostic_tests',
  dental: 'dental',
  vision: 'vision',
  alternative: 'alternative_medicine',
};

function previousApprovedThisPolicyYear(previousClaims, serviceDate) {
  if (!serviceDate) return 0;
  const year = new Date(serviceDate).getFullYear();
  return (previousClaims || []).reduce((sum, c) => {
    const claimYear = c.serviceDate ? new Date(c.serviceDate).getFullYear() : null;
    return claimYear === year ? sum + (Number(c.approved) || 0) : sum;
  }, 0);
}

export function runLimits({ claim, policy, previousClaims = [] }) {
  const trail = [];
  const cov = policy.coverage_details;
  const claimed = claim.claimed || 0;
  const payableItems = (claim.lineItems || []).filter(li => li.payable !== false);
  const rejectedItems = (claim.lineItems || [])
    .filter(li => li.payable === false)
    .map(li => `${li.description} - ${li.rejectionReason || 'Not payable'}`);
  const payableTotal = payableItems.reduce((sum, li) => sum + (li.amount || 0), 0);

  const totals = {};
  payableItems.forEach(li => {
    totals[li.category] = (totals[li.category] || 0) + (li.amount || 0);
  });

  const subLimitBreaches = [];
  let subLimitedBase = 0;
  for (const [category, amount] of Object.entries(totals)) {
    const policyKey = SUB_LIMIT_MAP[category];
    const limit = policyKey ? cov[policyKey]?.sub_limit : null;
    if (limit && amount > limit) {
      subLimitBreaches.push({ category, amount, limit });
      subLimitedBase += limit;
    } else {
      subLimitedBase += amount;
    }
  }

  const perClaimLimit = cov.per_claim_limit || claimed;
  const perClaimBase = Math.min(subLimitedBase, perClaimLimit);
  const perClaimExceededBy = Math.max(0, subLimitedBase - perClaimLimit);

  trail.push({
    step: 'limits',
    ruleId: 'PER_CLAIM_EXCEEDED',
    label: `Per-claim limit Rs.${perClaimLimit}`,
    status: perClaimExceededBy > 0 ? 'warn' : 'pass',
    detail: perClaimExceededBy > 0 ? `Payable amount exceeds limit by Rs.${perClaimExceededBy}` : `Within limit (Rs.${subLimitedBase})`,
  });

  trail.push({
    step: 'limits',
    ruleId: 'SUB_LIMIT_EXCEEDED',
    label: 'Category sub-limits',
    status: subLimitBreaches.length ? 'warn' : 'pass',
    detail: subLimitBreaches.length
      ? subLimitBreaches.map(b => `${b.category}: Rs.${b.amount} > Rs.${b.limit}`).join('; ')
      : 'All categories within sub-limits',
  });

  const previousApproved = previousApprovedThisPolicyYear(previousClaims, claim.serviceDate);
  const annualLimit = cov.annual_limit || perClaimBase;
  const annualRemaining = Math.max(0, annualLimit - previousApproved);
  const approvedBeforeCopay = Math.min(perClaimBase, annualRemaining);
  trail.push({
    step: 'limits',
    ruleId: 'ANNUAL_LIMIT_EXCEEDED',
    label: `Annual limit Rs.${annualLimit}`,
    status: approvedBeforeCopay < perClaimBase ? 'warn' : 'pass',
    detail: approvedBeforeCopay < perClaimBase
      ? `Annual remaining Rs.${annualRemaining}; capped payable amount`
      : `Annual remaining Rs.${annualRemaining}`,
  });

  const consultationLimit = cov.consultation_fees?.sub_limit ?? Infinity;
  const consultationAllowed = Math.min(totals.consultation || 0, consultationLimit, approvedBeforeCopay);
  const copay = Math.round(consultationAllowed * (cov.consultation_fees?.copay_percentage || 0) / 100);
  const approved = Math.max(0, approvedBeforeCopay - copay);
  const deductions = Math.max(0, claimed - approvedBeforeCopay);

  trail.push({
    step: 'limits',
    ruleId: 'COPAY_APPLIED',
    label: 'Co-payment calculated',
    status: 'pass',
    detail: `Copay Rs.${copay}, deductions Rs.${deductions}, approved Rs.${approved}`,
    evidence: { copay, deductions, approved, payableTotal, rejectedItems },
  });

  return { trail, copay, deductions, approved, rejectedItems };
}
