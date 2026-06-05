import { runEligibility } from './eligibility.js';
import { runDocuments } from './documents.js';
import { runCoverage } from './coverage.js';
import { runLimits } from './limits.js';
import { runIrrelevantDiagnostics, runMedical } from './medical.js';
import { runProcess } from './process.js';

export function runAllRules({ claim, extractedDocs, policy, previousClaims = [] }) {
  const trail = [];
  trail.push(...runEligibility({ claim, policy }));
  trail.push(...runDocuments({ claim, extractedDocs }));
  trail.push(...runCoverage({ claim, policy }));
  trail.push(...runIrrelevantDiagnostics({ claim, policy }));
  const limits = runLimits({ claim, policy, previousClaims });
  trail.push(...limits.trail);
  trail.push(...runMedical({ claim, policy }));
  trail.push(...runProcess({ claim, policy, previousClaims }));

  return {
    trail: trail.map((t, i) => ({ ...t, order: i })),
    financials: {
      copay: limits.copay,
      deductions: limits.deductions,
      approved: limits.approved,
      rejectedItems: limits.rejectedItems,
    },
  };
}
