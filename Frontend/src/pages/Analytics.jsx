import { TopNav } from "../components/TopNav.jsx";
import { Footer } from "../components/Footer.jsx";

export default function Analytics() {
  const stats = [
    { label: "Claims Today", value: "248", delta: "+12%" },
    { label: "Auto-Approve Rate", value: "76%", delta: "+3.4%" },
    { label: "Avg. Adjudication Time", value: "4.2s", delta: "-0.8s" },
    { label: "Pending Review", value: "14", delta: "—" },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <TopNav />
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        <h1 className="text-2xl font-display font-bold mb-1">Analytics</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Live operational metrics across the adjudication pipeline.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className="text-3xl font-display font-bold mt-2">{s.value}</p>
              <p className="text-xs font-mono text-success mt-1">{s.delta}</p>
            </div>
          ))}
        </div>
        <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Charts and decision-mix breakdowns will appear here once live data is wired up.
        </div>
      </main>
      <Footer />
    </div>
  );
}
