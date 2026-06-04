export function runEligibility({ claim, policy }) {
  const trail = [];
  const today = new Date();
  const effective = new Date(policy.effective_date);

  trail.push({
    step: 'eligibility', ruleId: 'POLICY_ACTIVE', label: 'Policy active on treatment date',
    status: today >= effective ? 'pass' : 'fail',
    detail: today >= effective ? `Policy effective since ${policy.effective_date}` : 'Policy not yet effective',
  });

  const serviceDate = claim.serviceDate ? new Date(claim.serviceDate) : null;
  const waitingDays = policy.waiting_periods?.initial_waiting ?? 0;
  const waitingOk = !serviceDate || (serviceDate.getTime() - effective.getTime()) / 86400000 >= waitingDays;
  trail.push({
    step: 'eligibility', ruleId: 'WAITING_PERIOD', label: `Initial waiting period (${waitingDays} days)`,
    status: waitingOk ? 'pass' : 'fail',
    detail: waitingOk ? 'Waiting period satisfied' : 'Treatment falls within waiting period',
  });

  const memberOk = !!claim.memberId;
  trail.push({
    step: 'eligibility', ruleId: 'MEMBER_NOT_COVERED', label: 'Member verification',
    status: memberOk ? 'pass' : 'fail',
    detail: memberOk ? `Member ${claim.memberId} found` : 'Member ID missing or unknown',
  });

  return trail;
}
