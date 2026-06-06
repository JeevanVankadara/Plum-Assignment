import { TopNav } from "../components/TopNav";
import { Footer } from "../components/Footer";

interface RuleRow {
  id: string;
  step: string;
  rule: string;
  scope: string;
  outcome: string;
}

const rules: RuleRow[] = [
  {
    id: "R-001",
    step: "Policy status",
    rule: "Treatment date must be on or after the policy effective date.",
    scope: "Eligibility",
    outcome: "Reject if the policy was not active on the treatment date.",
  },
  {
    id: "R-002",
    step: "Waiting period",
    rule: "OPD claims must satisfy the configured waiting period before payment.",
    scope: "Eligibility",
    outcome: "Reject if the claim falls inside the waiting period.",
  },
  {
    id: "R-003",
    step: "Member verification",
    rule: "A member or employee ID must be visible in the uploaded documents or supplied during upload.",
    scope: "Eligibility",
    outcome: "Reject if member ID is missing or unknown.",
  },
  {
    id: "R-004",
    step: "Required documents",
    rule: "Every claim needs prescription evidence and bill evidence. A single prescription-cum-bill page can satisfy both.",
    scope: "Documents",
    outcome: "Reject if prescription or billing evidence is missing.",
  },
  {
    id: "R-005",
    step: "Prescription validity",
    rule: "Prescription evidence must include patient, doctor, treatment date, and clinical details such as diagnosis, medicines, tests, or procedures.",
    scope: "Documents",
    outcome: "Reject if prescription evidence is not valid.",
  },
  {
    id: "R-006",
    step: "Doctor registration",
    rule: "Doctor registration number must be present and match an accepted registration-number format.",
    scope: "Documents",
    outcome: "Reject or flag when doctor registration is missing or invalid.",
  },
  {
    id: "R-007",
    step: "Patient and date consistency",
    rule: "Patient name, member ID, and treatment dates should be consistent across uploaded documents.",
    scope: "Documents",
    outcome: "Reject or flag mismatched patient/date details.",
  },
  {
    id: "R-008",
    step: "Policy exclusions",
    rule: "Excluded treatments such as cosmetic procedures, weight loss, infertility, experimental treatment, and non-covered supplements are not payable.",
    scope: "Coverage",
    outcome: "Deduct excluded items; reject only if all payable items are excluded.",
  },
  {
    id: "R-009",
    step: "Service coverage",
    rule: "Line items must fall under covered OPD categories such as consultation, pharmacy, diagnostics, dental, vision, or listed alternatives.",
    scope: "Coverage",
    outcome: "Deduct unsupported services and partially approve valid mixed claims.",
  },
  {
    id: "R-010",
    step: "Pharmacy matching",
    rule: "Medicines or pharmacy items billed must match medicines/items prescribed by the doctor.",
    scope: "Coverage",
    outcome: "Deduct bill items that are not present in the prescription.",
  },
  {
    id: "R-011",
    step: "Diagnostic matching",
    rule: "Diagnostic bills must match tests prescribed by the doctor. A matching diagnostic invoice is accepted even without a separate lab report.",
    scope: "Coverage",
    outcome: "Deduct diagnostic tests that were not prescribed or not supported by invoice/report evidence.",
  },
  {
    id: "R-012",
    step: "Pre-authorization",
    rule: "MRI and CT scan claims require pre-authorization evidence when those tests are claimed.",
    scope: "Coverage",
    outcome: "Reject MRI/CT claims when pre-authorization is missing.",
  },
  {
    id: "R-013",
    step: "Claim limits",
    rule: "Payable amount is capped by per-claim, category sub-limit, and annual OPD limit.",
    scope: "Limits",
    outcome: "Partially approve and deduct amounts above policy limits.",
  },
  {
    id: "R-014",
    step: "Co-payment",
    rule: "Apply the configured co-pay percentage to payable OPD amounts.",
    scope: "Limits",
    outcome: "Deduct co-pay from the final payable amount.",
  },
  {
    id: "R-015",
    step: "Medical necessity",
    rule: "Diagnosis must exist and claimed medicines, tests, or procedures must reasonably align with the diagnosis.",
    scope: "Medical review",
    outcome: "Route low-confidence or irrelevant items to manual review.",
  },
  {
    id: "R-016",
    step: "Duplicate and fraud pattern",
    rule: "Stored previous claims are checked for duplicate, same-day, high-frequency, or suspicious repeat patterns.",
    scope: "Process review",
    outcome: "Route suspicious claims to manual review.",
  },
  {
    id: "R-017",
    step: "Final decision",
    rule: "Return APPROVED, REJECTED, PARTIAL, or MANUAL_REVIEW with amount, reasons, confidence, notes, next steps, and audit trail.",
    scope: "Output",
    outcome: "Admin can finalize approve/reject once; finalized decisions are locked.",
  },
];

export default function Rules() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <TopNav />
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        <h1 className="text-2xl font-display font-bold mb-1">Rules Engine</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Clear rule flow used to turn extracted document data into an explainable claim decision.
        </p>
        <div className="bg-white border border-border rounded-xl overflow-hidden divide-y divide-border">
          {rules.map((r) => (
            <section key={r.id} className="grid gap-4 px-5 py-4 md:grid-cols-[120px_1fr_220px] hover:bg-background/40 transition-colors">
              <div>
                <div className="font-mono text-xs text-accent">{r.id}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{r.scope}</div>
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">{r.step}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{r.rule}</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-3 text-sm leading-6 text-muted-foreground">
                {r.outcome}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
