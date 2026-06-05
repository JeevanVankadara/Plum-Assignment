import { TopNav } from "../components/TopNav";
import { Footer } from "../components/Footer";

interface RuleRow {
  id: string;
  label: string;
  scope: string;
  hits: number;
}

const rules: RuleRow[] = [
  { id: "R-001", label: "Member Eligibility", scope: "All claims", hits: 248 },
  { id: "R-042", label: "Doctor Credentials", scope: "All claims", hits: 248 },
  { id: "R-055", label: "Network Provider", scope: "All claims", hits: 248 },
  { id: "R-070", label: "Amount within Sub-limit", scope: "Specialist OPD", hits: 142 },
  { id: "R-088", label: "Billing Consistency", scope: "Pharmacy bills", hits: 96 },
  { id: "R-101", label: "Diagnostic Justification", scope: "Lab orders", hits: 58 },
  { id: "R-109", label: "Excluded Items", scope: "All claims", hits: 248 },
];

export default function Rules() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <TopNav />
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        <h1 className="text-2xl font-display font-bold mb-1">Rules Engine</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Deterministic policy rules evaluated on every claim before LLM review.
        </p>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/60 border-b border-border">
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-3">Rule ID</th>
                <th className="px-5 py-3">Label</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3 text-right">Evaluations (24h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-accent">{r.id}</td>
                  <td className="px-5 py-3 font-medium">{r.label}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.scope}</td>
                  <td className="px-5 py-3 text-right font-mono">{r.hits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}
