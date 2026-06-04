export function runLimits({ claim, policy }) {
  const trail = [];
  const cov = policy.coverage_details;
  const claimed = claim.claimed || 0;

  const perClaimOk = claimed <= cov.per_claim_limit;
  trail.push({
    step: 'limits', ruleId: 'PER_CLAIM_EXCEEDED', label: `Per-claim limit ₹${cov.per_claim_limit}`,
    status: perClaimOk ? 'pass' : 'warn',
    detail: perClaimOk ? `Within limit (₹${claimed})` : `Exceeds by ₹${claimed - cov.per_claim_limit}`,
  });

  // Sub-limit check per category (best-effort by item category)
  const subLimitMap = {
    consultation: cov.consultation_fees?.sub_limit,
    pharmacy: cov.pharmacy?.sub_limit,
    diagnostic: cov.diagnostic_tests?.sub_limit,
    dental: cov.dental?.sub_limit,
    vision: cov.vision?.sub_limit,
    alternative: cov.alternative_medicine?.sub_limit,
  };
  const totals = {};
  (claim.lineItems || []).forEach(li => {
    totals[li.category] = (totals[li.category] || 0) + (li.amount || 0);
  });
  const breaches = Object.entries(totals).filter(([k, v]) => subLimitMap[k] && v > subLimitMap[k]);
  trail.push({
    step: 'limits', ruleId: 'SUB_LIMIT_EXCEEDED', label: 'Category sub-limits',
    status: breaches.length === 0 ? 'pass' : 'warn',
    detail: breaches.length === 0 ? 'All categories within sub-limits' :
      breaches.map(([k, v]) => `${k}: ₹${v} > ₹${subLimitMap[k]}`).join('; '),
  });

  // Co-pay = consultation copay% applied to consultation items
  const consultationTotal = totals.consultation || 0;
  const copay = Math.round(consultationTotal * (cov.consultation_fees?.copay_percentage || 0) / 100);
  const deductions = breaches.reduce((s, [k, v]) => s + (v - subLimitMap[k]), 0) +
    Math.max(0, claimed - cov.per_claim_limit);
  const approved = Math.max(0, claimed - deductions - copay);

  trail.push({
    step: 'limits', ruleId: 'COPAY_APPLIED', label: 'Co-payment calculated',
    status: 'pass',
    detail: `Copay ₹${copay}, deductions ₹${deductions}, approved ₹${approved}`,
    evidence: { copay, deductions, approved },
  });

  return { trail, copay, deductions, approved };
}
