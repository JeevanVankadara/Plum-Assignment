import { useEffect, useMemo, useState } from "react";
import { IrrelevantItemsReview, irrelevantItemKey } from "./IrrelevantItemsReview";
import type { ClaimDecision, ClaimDetailModel, ReviewDecisionPayload } from "../lib/types";

interface ClaimDetailProps {
  claim: ClaimDetailModel;
  onDecision: (id: string, decision: ClaimDecision, review?: ReviewDecisionPayload) => Promise<void> | void;
  onSaveAdminText?: (id: string, notes: string, nextSteps: string) => Promise<void> | void;
}

function statusBadge(status: string): string {
  if (status === "APPROVED") return "bg-success/10 text-success ring-success/20";
  if (status === "REJECTED") return "bg-error/10 text-error ring-error/20";
  return "bg-warning/10 text-warning ring-warning/20";
}

function confidenceColor(confidence: number): string {
  if (confidence >= 90) return "bg-success";
  if (confidence >= 70) return "bg-warning";
  return "bg-error";
}

function valueOrDash(value?: string): string {
  return value && value !== "Unknown provider" ? value : "-";
}

function systemSuggestion(status: string): string {
  if (status === "APPROVED") return "System suggestion: approve";
  if (status === "REJECTED") return "System suggestion: reject";
  if (status === "PARTIAL") return "Review needed: partial approval";
  if (status === "MANUAL_REVIEW") return "Review needed";
  return "System suggestion pending";
}

function finalDecisionLabel(decision?: string | null): string {
  if (decision === "APPROVED") return "Finalized by admin: approved";
  if (decision === "REJECTED") return "Finalized by admin: rejected";
  return "Finalized by admin";
}

function money(value: number): string {
  return `Rs.${(Number(value) || 0).toLocaleString("en-IN")}.00`;
}

export function ClaimDetail({ claim, onDecision, onSaveAdminText }: ClaimDetailProps) {
  const providerName = valueOrDash(claim.provider).split(",")[0];
  const irrelevantTests = claim.irrelevantTests || [];
  const [excludedMap, setExcludedMap] = useState<Record<string, boolean>>({});
  const [editableNotes, setEditableNotes] = useState(claim.notes || "");
  const [editableNextSteps, setEditableNextSteps] = useState(claim.nextSteps || "");
  const [savingText, setSavingText] = useState(false);

  useEffect(() => {
    setExcludedMap(
      Object.fromEntries(
        irrelevantTests.map((item, index) => [
          irrelevantItemKey(item, index),
          item.excluded !== false,
        ])
      )
    );
  }, [irrelevantTests]);

  useEffect(() => {
    setEditableNotes(claim.notes || "");
    setEditableNextSteps(claim.nextSteps || "");
  }, [claim.id, claim.notes, claim.nextSteps]);

  const reviewTotals = useMemo(() => {
    const delta = irrelevantTests.reduce((sum, item, index) => {
      const key = irrelevantItemKey(item, index);
      const amount = Number(item.amount) || 0;
      const initiallyExcluded = item.excluded !== false;
      const currentlyExcluded = excludedMap[key] !== false;
      if (initiallyExcluded && !currentlyExcluded) return sum + amount;
      if (!initiallyExcluded && currentlyExcluded) return sum - amount;
      return sum;
    }, 0);
    const maxApproved = Math.max(0, claim.claimed - claim.copay);
    const approved = Math.min(maxApproved, Math.max(0, claim.approved + delta));
    return {
      approved,
      deductions: Math.max(0, claim.deductions - delta),
    };
  }, [claim.approved, claim.claimed, claim.copay, claim.deductions, excludedMap, irrelevantTests]);

  const irrelevantOverrides = irrelevantTests.map((item, index) => ({
    testName: item.testName,
    amount: Number(item.amount) || 0,
    excluded: excludedMap[irrelevantItemKey(item, index)] !== false,
  }));
  const hasIrrelevantReview = irrelevantTests.length > 0;
  const isFinalized = claim.adminFinalized;
  const fallbackApproval = Math.max(0, claim.claimed - claim.copay);
  const finalApprovalAmount = claim.status === "REJECTED" && reviewTotals.approved === 0
    ? fallbackApproval
    : reviewTotals.approved;
  const finalApprovalDeductions = Math.max(0, claim.claimed - finalApprovalAmount);
  const primaryApproveLabel = claim.status === "REJECTED"
    ? "Approve Anyway"
    : claim.status === "APPROVED"
      ? "Finalize Approval"
      : hasIrrelevantReview
        ? "Approve Reviewed Amount"
        : "Approve Final";
  const rejectLabel = claim.status === "REJECTED" ? "Finalize Rejection" : "Reject Claim";
  const decisionApprovedAmount = isFinalized || claim.status !== "REJECTED" ? reviewTotals.approved : finalApprovalAmount;
  const confidenceDecimal = Math.max(0, Math.min(1, claim.confidence / 100)).toFixed(2);
  const decisionNotes = editableNotes || "-";
  const decisionNextSteps = editableNextSteps || "-";
  const rejectionReasonsJson = JSON.stringify(claim.rejectionReasons, null, 2).replace(/\n/g, "\n  ");

  async function saveAdminText(): Promise<void> {
    if (!onSaveAdminText || savingText) return;
    setSavingText(true);
    try {
      await onSaveAdminText(claim.id, editableNotes, editableNextSteps);
    } finally {
      setSavingText(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden shadow-md font-sans">
      <div className="p-6 border-b border-border flex justify-between items-start bg-white">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-display font-bold text-foreground">
              Claim #{claim.claimNo || claim.id}
            </h1>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ring-1 ${statusBadge(String(claim.status))}`}>
              {claim.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Patient: <span className="text-foreground font-medium">{claim.patient}</span>{" "}
            - ID: <span className="font-mono">{claim.memberId}</span>
          </p>
          <p className={`text-[11px] font-bold mt-2 ${isFinalized ? "text-success" : "text-muted-foreground"}`}>
            {isFinalized ? finalDecisionLabel(claim.adminDecision) : systemSuggestion(String(claim.status))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
            Confidence Score
          </p>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full ${confidenceColor(claim.confidence)}`}
                style={{ width: `${claim.confidence}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-foreground">
              {claim.confidence}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px]">
        <div className="bg-background p-6 border-r border-border">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Extracted Context
          </h3>
          <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Patient</p>
                <p className="mt-1 font-semibold text-foreground">{valueOrDash(claim.patient)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Date</p>
                <p className="mt-1 font-mono text-foreground">{valueOrDash(claim.serviceDate)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Provider</p>
                <p className="mt-1 font-semibold text-foreground">{providerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Doctor</p>
                <p className="mt-1 font-semibold text-foreground">{valueOrDash(claim.doctor)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Reg. No</p>
                <p className="mt-1 font-mono text-foreground">{valueOrDash(claim.docRegNo)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Diagnosis</p>
                <p className="mt-1 text-muted-foreground leading-relaxed">{claim.department || "-"}</p>
              </div>
            </div>
          </div>

          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-6 mb-4">
            Decision Output
          </h3>
          <div className="rounded-lg border border-border bg-white p-4 shadow-sm overflow-hidden min-w-0">
            <pre className="max-w-full text-[11px] leading-6 font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden">
{`{
  "claim_id": "${claim.claimNo || claim.id}",
  "decision": "${claim.status}",
  "approved_amount": ${Math.round(decisionApprovedAmount)},
  "rejection_reasons": ${rejectionReasonsJson},
  "confidence_score": ${confidenceDecimal},
  "notes": `}
            </pre>
            <textarea
              value={editableNotes}
              onChange={(event) => setEditableNotes(event.target.value)}
              rows={3}
              className="w-full max-w-full rounded border border-border bg-background px-3 py-2 text-[11px] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <pre className="max-w-full text-[11px] leading-6 font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden">
{`,
  "next_steps": `}
            </pre>
            <textarea
              value={editableNextSteps}
              onChange={(event) => setEditableNextSteps(event.target.value)}
              rows={3}
              className="w-full max-w-full rounded border border-border bg-background px-3 py-2 text-[11px] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <pre className="max-w-full text-[11px] leading-6 font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden">
{`}`}
            </pre>
            <button
              type="button"
              onClick={saveAdminText}
              disabled={savingText}
              className="mt-3 w-full rounded bg-white border border-border py-2 text-xs font-bold text-foreground hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingText ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Adjudication Trail
          </h3>
          <div className="space-y-5 max-h-[420px] overflow-y-auto pr-2">
            {claim.rules.map((rule) => {
              const isPass = rule.state === "pass";
              const isWarn = rule.state === "warn";
              const dotBg = isPass ? "bg-success" : isWarn ? "bg-warning" : "bg-error";
              const ring = isPass ? "" : isWarn ? "ring-4 ring-warning/10" : "ring-4 ring-error/10";
              const wrap = isPass
                ? ""
                : isWarn
                  ? "border border-warning/20 bg-warning/[0.03] p-3 rounded-lg"
                  : "border border-error/20 bg-error/[0.03] p-3 rounded-lg";
              return (
                <div key={`${rule.id}-${rule.label}`} className="flex gap-4">
                  <div className={`mt-1 size-5 rounded-full ${dotBg} ${ring} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-[10px] font-bold">
                      {isPass ? "OK" : isWarn ? "!" : "X"}
                    </span>
                  </div>
                  <div className={`flex-1 ${wrap}`}>
                    <div className="flex justify-between gap-3">
                      <p className="text-xs font-bold text-foreground">{rule.label}</p>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {rule.id}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {rule.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <IrrelevantItemsReview
              items={irrelevantTests}
              excludedMap={excludedMap}
              disabled={isFinalized}
              onToggle={(key) =>
                setExcludedMap((current) => ({
                  ...current,
                  [key]: !(current[key] !== false),
                }))
              }
            />

            <div className="flex justify-between py-1 text-xs">
              <span className="text-muted-foreground">Claimed Amount</span>
              <span className="font-mono text-foreground">{money(claim.claimed)}</span>
            </div>
            <div className="flex justify-between py-1 text-xs">
              <span className="text-muted-foreground">System Deductions</span>
              <span className="font-mono text-error">-{money(reviewTotals.deductions)}</span>
            </div>
            <div className="flex justify-between py-1 text-xs">
              <span className="text-muted-foreground">Copay</span>
              <span className="font-mono text-error">-{money(claim.copay)}</span>
            </div>
            <div className="flex justify-between pt-4 mt-2 border-t border-border">
              <span className="font-bold text-sm uppercase text-foreground">
                Approved Amount
              </span>
              <span className="font-mono font-bold text-lg text-success">
                {money(reviewTotals.approved)}
              </span>
            </div>
          </div>

          {isFinalized ? (
            <div className="mt-6 rounded border border-success/20 bg-success/5 px-3 py-2 text-xs font-bold text-success">
              {finalDecisionLabel(claim.adminDecision)}
            </div>
          ) : (
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => onDecision(claim.id, "REJECTED", {
                  approved: 0,
                  deductions: claim.claimed,
                  irrelevantTestOverrides: irrelevantOverrides,
                  notes: editableNotes,
                  nextSteps: editableNextSteps,
                })}
                className="flex-1 bg-white border border-border py-2 rounded text-xs font-bold text-foreground hover:bg-background transition-colors"
              >
                {rejectLabel}
              </button>
              <button
                onClick={() => {
                  const confirmed = window.confirm("Do you confirm approving this claim?");
                  if (!confirmed) return;
                  onDecision(claim.id, "APPROVED", {
                    approved: finalApprovalAmount,
                    deductions: claim.status === "REJECTED" ? finalApprovalDeductions : reviewTotals.deductions,
                    irrelevantTestOverrides: irrelevantOverrides,
                    notes: editableNotes,
                    nextSteps: editableNextSteps,
                  });
                }}
                className="flex-1 bg-accent text-accent-foreground py-2 rounded text-xs font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/10"
              >
                {primaryApproveLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
