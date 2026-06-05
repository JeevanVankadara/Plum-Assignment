import { useEffect, useMemo, useState } from "react";
import { TopNav } from "../components/TopNav.jsx";
import { Footer } from "../components/Footer.jsx";
import { api } from "../lib/api.js";

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function money(value) {
  return `Rs.${Number(value || 0).toLocaleString("en-IN")}`;
}

function percent(value) {
  return `${Math.round(value || 0)}%`;
}

function statusLabel(status) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "PARTIAL") return "Partial";
  if (status === "MANUAL_REVIEW") return "Manual Review";
  return status || "Pending";
}

function metricColor(status) {
  if (status === "APPROVED") return "bg-success";
  if (status === "REJECTED") return "bg-error";
  if (status === "PARTIAL") return "bg-warning";
  if (status === "MANUAL_REVIEW") return "bg-accent";
  return "bg-muted-foreground";
}

function computeAnalytics(claims) {
  const total = claims.length;
  const approved = claims.filter((c) => c.decision === "APPROVED").length;
  const rejected = claims.filter((c) => c.decision === "REJECTED").length;
  const partial = claims.filter((c) => c.decision === "PARTIAL").length;
  const manual = claims.filter((c) => c.decision === "MANUAL_REVIEW").length;
  const today = claims.filter((c) => isToday(c.createdAt)).length;
  const claimedTotal = claims.reduce((sum, c) => sum + (Number(c.claimed_amount ?? c.claimed) || 0), 0);
  const approvedTotal = claims.reduce((sum, c) => sum + (Number(c.approved_amount ?? c.approved) || 0), 0);
  const avgConfidence = total
    ? claims.reduce((sum, c) => sum + (Number(c.confidence_score ?? c.confidence) || 0), 0) / total
    : 0;

  return {
    total,
    today,
    approved,
    rejected,
    partial,
    manual,
    claimedTotal,
    approvedTotal,
    avgConfidence,
    approvalRate: total ? (approved / total) * 100 : 0,
    reviewRate: total ? ((manual + partial) / total) * 100 : 0,
    decisionMix: [
      { status: "APPROVED", count: approved },
      { status: "REJECTED", count: rejected },
      { status: "PARTIAL", count: partial },
      { status: "MANUAL_REVIEW", count: manual },
    ],
  };
}

export default function Analytics() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .list()
      .then((data) => {
        if (!cancelled) setClaims(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const analytics = useMemo(() => computeAnalytics(claims), [claims]);
  const stats = [
    { label: "Claims Today", value: analytics.today, detail: `${analytics.total} total claims` },
    { label: "Auto-Approve Rate", value: percent(analytics.approvalRate), detail: `${analytics.approved} approved` },
    { label: "Avg. Confidence", value: percent(analytics.avgConfidence * 100), detail: "Across processed claims" },
    { label: "Pending Review", value: analytics.manual, detail: `${analytics.reviewRate.toFixed(1)}% partial/manual` },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <TopNav />
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        <h1 className="text-2xl font-display font-bold mb-1">Analytics</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Live operational metrics across the adjudication pipeline.
        </p>

        {error && (
          <div className="mb-6 text-xs font-mono text-error bg-error/5 border border-error/20 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className="text-3xl font-display font-bold mt-2">
                {loading ? "-" : s.value}
              </p>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {loading ? "Loading..." : s.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-sm font-display font-bold mb-5">Decision Mix</h2>
            <div className="space-y-4">
              {analytics.decisionMix.map((item) => {
                const width = analytics.total ? (item.count / analytics.total) * 100 : 0;
                return (
                  <div key={item.status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{statusLabel(item.status)}</span>
                      <span className="font-mono text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-background overflow-hidden">
                      <div
                        className={`h-full ${metricColor(item.status)}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-sm font-display font-bold mb-5">Financial Summary</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Claimed Amount</span>
                <span className="font-mono font-semibold">{loading ? "-" : money(analytics.claimedTotal)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Approved Amount</span>
                <span className="font-mono font-semibold text-success">
                  {loading ? "-" : money(analytics.approvedTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rejected/Unpaid Amount</span>
                <span className="font-mono font-semibold text-error">
                  {loading ? "-" : money(Math.max(0, analytics.claimedTotal - analytics.approvedTotal))}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
