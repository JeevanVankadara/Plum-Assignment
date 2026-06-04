function daysBetween(a, b) {
  return (a.getTime() - b.getTime()) / 86400000;
}

function waitingDaysForDiagnosis(diagnosis = '', policy) {
  const diag = diagnosis.toLowerCase();
  const specific = policy.waiting_periods?.specific_ailments || {};
  for (const [ailment, days] of Object.entries(specific)) {
    if (diag.includes(ailment.toLowerCase())) return days;
  }
  return policy.waiting_periods?.initial_waiting ?? 0;
}

export function runEligibility({ claim, policy }) {
  const trail = [];
  const effective = new Date(policy.effective_date);
  const serviceDate = claim.serviceDate ? new Date(claim.serviceDate) : null;
  const validServiceDate = serviceDate && !Number.isNaN(serviceDate.getTime());

  trail.push({
    step: 'eligibility',
    ruleId: 'POLICY_ACTIVE',
    label: 'Policy active on treatment date',
    status: validServiceDate && serviceDate >= effective ? 'pass' : 'fail',
    detail: validServiceDate
      ? serviceDate >= effective
        ? `Policy effective since ${policy.effective_date}`
        : `Treatment date ${claim.serviceDate} is before policy effective date`
      : 'Treatment date missing or invalid',
  });

  const waitingDays = waitingDaysForDiagnosis(claim.diagnosis, policy);
  const waitingOk = validServiceDate && daysBetween(serviceDate, effective) >= waitingDays;
  trail.push({
    step: 'eligibility',
    ruleId: 'WAITING_PERIOD',
    label: `Waiting period (${waitingDays} days)`,
    status: waitingOk ? 'pass' : 'fail',
    detail: waitingOk ? 'Waiting period satisfied' : 'Treatment falls within waiting period',
  });

  const memberId = (claim.memberId || '').trim();
  const memberOk = memberId && memberId !== 'UNKNOWN';
  trail.push({
    step: 'eligibility',
    ruleId: 'MEMBER_NOT_COVERED',
    label: 'Member verification',
    status: memberOk ? 'pass' : 'fail',
    detail: memberOk
      ? `Member ${memberId} supplied. Policy file has no member roster for deeper verification.`
      : 'Member ID missing or unknown',
  });

  return trail;
}
