export function runCoverage({ claim, policy }) {
  const trail = [];
  const exclusions = (policy.exclusions || []).map(e => e.toLowerCase());
  const diag = (claim.diagnosis || '').toLowerCase();

  const excluded = exclusions.find(e => diag.includes(e.split(' ')[0]));
  trail.push({
    step: 'coverage', ruleId: 'EXCLUDED_CONDITION', label: 'Not in exclusion list',
    status: excluded ? 'fail' : 'pass',
    detail: excluded ? `Condition matches exclusion: ${excluded}` : 'No matching exclusion',
  });

  const categories = new Set((claim.lineItems || []).map(li => li.category));
  const uncovered = [...categories].filter(c => {
    const key = ({
      consultation: 'consultation_fees',
      pharmacy: 'pharmacy',
      diagnostic: 'diagnostic_tests',
      dental: 'dental',
      vision: 'vision',
      alternative: 'alternative_medicine',
    })[c];
    return key ? policy.coverage_details[key]?.covered === false : false;
  });
  trail.push({
    step: 'coverage', ruleId: 'SERVICE_NOT_COVERED', label: 'All services covered',
    status: uncovered.length === 0 ? 'pass' : 'fail',
    detail: uncovered.length === 0 ? 'All line items covered' : `Uncovered: ${uncovered.join(', ')}`,
  });

  const preAuthCats = ['diagnostic'];
  const needsPreAuth = (claim.lineItems || []).some(li =>
    preAuthCats.includes(li.category) && /mri|ct scan/i.test(li.description || '')
  );
  trail.push({
    step: 'coverage', ruleId: 'PRE_AUTH_MISSING', label: 'Pre-authorization check',
    status: needsPreAuth ? 'warn' : 'pass',
    detail: needsPreAuth ? 'MRI/CT detected — pre-authorization recommended' : 'No pre-auth required',
  });

  return trail;
}
