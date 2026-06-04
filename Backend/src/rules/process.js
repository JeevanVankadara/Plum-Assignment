function sameDayClaims(previousClaims, serviceDate) {
  if (!serviceDate) return [];
  return (previousClaims || []).filter(c => c.serviceDate === serviceDate);
}

export function runProcess({ claim, policy, previousClaims = [] }) {
  const trail = [];
  const min = policy.claim_requirements?.minimum_claim_amount ?? 0;
  const claimed = claim.claimed || 0;

  trail.push({
    step: 'process',
    ruleId: 'BELOW_MIN_AMOUNT',
    label: `Above minimum Rs.${min}`,
    status: claimed >= min ? 'pass' : 'fail',
    detail: claimed >= min ? `Claimed Rs.${claimed}` : `Below minimum (Rs.${claimed})`,
  });

  const deadline = policy.claim_requirements?.submission_timeline_days ?? 30;
  if (claim.serviceDate && claim.submissionDate) {
    const serviceDate = new Date(claim.serviceDate);
    const submissionDate = new Date(claim.submissionDate);
    const days = (submissionDate.getTime() - serviceDate.getTime()) / 86400000;
    trail.push({
      step: 'process',
      ruleId: 'LATE_SUBMISSION',
      label: `Within ${deadline}-day window`,
      status: days <= deadline ? 'pass' : 'fail',
      detail: `${Math.floor(days)} days between treatment and submission`,
    });
  } else {
    trail.push({
      step: 'process',
      ruleId: 'LATE_SUBMISSION',
      label: `Within ${deadline}-day window`,
      status: 'pass',
      detail: 'Skipped for demo because submission date was not provided',
    });
  }

  const sameDay = sameDayClaims(previousClaims, claim.serviceDate);
  const duplicate = sameDay.find(c =>
    c.provider === claim.provider &&
    c.patient === claim.patient &&
    Math.abs((Number(c.claimed) || 0) - claimed) < 1
  );

  trail.push({
    step: 'process',
    ruleId: 'DUPLICATE_CLAIM',
    label: 'Duplicate and same-day pattern check',
    status: duplicate || sameDay.length >= 3 ? 'warn' : 'pass',
    detail: duplicate
      ? 'Possible duplicate claim found for same patient, provider, date, and amount'
      : sameDay.length >= 3
      ? `${sameDay.length} previous claims found for the same service date`
      : 'No duplicate or unusual same-day pattern found',
    evidence: duplicate || sameDay.length >= 3 ? { fraudFlag: true } : undefined,
  });

  return trail;
}
