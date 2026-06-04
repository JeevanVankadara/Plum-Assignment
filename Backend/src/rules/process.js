export function runProcess({ claim, policy }) {
  const trail = [];
  const min = policy.claim_requirements?.minimum_claim_amount ?? 0;
  const claimed = claim.claimed || 0;

  trail.push({
    step: 'process', ruleId: 'BELOW_MIN_AMOUNT', label: `Above minimum ₹${min}`,
    status: claimed >= min ? 'pass' : 'fail',
    detail: claimed >= min ? `Claimed ₹${claimed}` : `Below minimum (₹${claimed})`,
  });

  const deadline = policy.claim_requirements?.submission_timeline_days ?? 30;
  if (claim.serviceDate) {
    const days = (Date.now() - new Date(claim.serviceDate).getTime()) / 86400000;
    trail.push({
      step: 'process', ruleId: 'LATE_SUBMISSION', label: `Within ${deadline}-day window`,
      status: days <= deadline ? 'pass' : 'fail',
      detail: `${Math.floor(days)} days since service date`,
    });
  }

  return trail;
}
