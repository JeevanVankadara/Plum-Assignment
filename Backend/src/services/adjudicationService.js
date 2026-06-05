import { runAllRules } from '../rules/index.js';
import { aggregateConfidence } from '../utils/confidence.js';
import { getPolicy } from '../config/policy.js';

const HARD_FAIL_STEPS = new Set(['eligibility', 'documents', 'coverage', 'medical', 'process']);
const MANUAL_REVIEW_THRESHOLD = 25000;
const MANUAL_REVIEW_CONFIDENCE = 0.7;

export function adjudicate({ claim, extractedDocs, llmConfidence = 0.9, previousClaims = [] }) {
  const policy = getPolicy();
  const { trail, financials } = runAllRules({ claim, extractedDocs, policy, previousClaims });

  const hardFails = trail.filter(t => t.status === 'fail' && HARD_FAIL_STEPS.has(t.step));
  const warns = trail.filter(t => t.status === 'warn');
  const fraudFlags = trail
    .filter(t => t.evidence?.fraudFlag)
    .map(t => t.detail);
  const manualReviewFlags = trail
    .filter(t => t.evidence?.manualReview)
    .map(t => t.detail);
  const rejectedItems = [
    ...financials.rejectedItems,
    ...trail.flatMap(t => t.evidence?.rejectedItems || []),
  ];
  const confidence = aggregateConfidence(trail, llmConfidence);

  let decision = 'APPROVED';
  let approved = financials.approved;

  if (hardFails.length) {
    decision = 'REJECTED';
    approved = 0;
  } else if (financials.deductions > 0) {
    decision = 'PARTIAL';
  }

  if (!hardFails.length && (claim.claimed > MANUAL_REVIEW_THRESHOLD || confidence < MANUAL_REVIEW_CONFIDENCE || fraudFlags.length || manualReviewFlags.length)) {
    decision = 'MANUAL_REVIEW';
  }

  return {
    decision,
    approved,
    deductions: financials.deductions,
    copay: financials.copay,
    confidence,
    rejectionReasons: hardFails.map(f => f.ruleId),
    rejectedItems: [...new Set(rejectedItems)].filter(Boolean),
    fraudFlags: [...new Set([...fraudFlags, ...manualReviewFlags])].filter(Boolean),
    notes: hardFails.length
      ? `Rejected due to: ${hardFails.map(f => f.ruleId).join(', ')}`
      : warns.length
      ? `${warns.length} warning(s) raised during adjudication`
      : 'Clean run',
    nextSteps: decision === 'APPROVED'
      ? 'Payment will be processed within 3 business days.'
      : decision === 'REJECTED'
      ? 'You may appeal this decision within 30 days with additional documentation.'
      : decision === 'PARTIAL'
      ? 'Partial amount approved. See deductions for details.'
      : 'Claim referred to a human reviewer.',
    trail,
  };
}
