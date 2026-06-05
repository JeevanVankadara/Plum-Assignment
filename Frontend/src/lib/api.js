const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function handle(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => fetch(`${BASE}/api/health`).then(handle),
  list: () => fetch(`${BASE}/api/claims`).then(handle),
  get: (id) => fetch(`${BASE}/api/claims/${id}`).then(handle),
  create: ({ memberId, files }) => {
    const fd = new FormData();
    if (memberId) fd.append("memberId", memberId);
    for (const f of files) fd.append("files", f);
    return fetch(`${BASE}/api/claims`, { method: "POST", body: fd }).then(handle);
  },
  decide: (id, decision, review = {}) =>
    fetch(`${BASE}/api/claims/${id}/decision`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(typeof review === "string" ? { decision, notes: review } : { decision, ...review }),
    }).then(handle),
};

const STATUS_MAP = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PARTIAL: "PARTIAL",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  PROCESSING: "MANUAL_REVIEW",
  PENDING: "PENDING",
};

function fmtDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date)) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ruleState(s) {
  if (s === "pass") return "pass";
  if (s === "warn") return "warn";
  return "fail";
}

function pct(value) {
  const n = Number(value) || 0;
  return Math.round(n <= 1 ? n * 100 : n);
}

function amount(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return Number(value) || 0;
  }
  return 0;
}

function decisionOf(c) {
  const decision = c.decision || c.status || "PENDING";
  return STATUS_MAP[decision] || decision;
}

export function adaptClaimSummary(c) {
  return {
    id: c._id || c.id,
    claimNo: c.claim_id || c.claimId,
    patient: c.patient || "-",
    memberId: c.member_id || c.memberId || "-",
    provider: c.provider || "-",
    department: c.department || c.diagnosis || "OPD",
    claimed: amount(c.claimed_amount, c.claimed),
    approved: amount(c.approved_amount, c.approved),
    confidence: pct(c.confidence_score ?? c.confidence),
    status: decisionOf(c),
  };
}

export function adaptClaimDetail(c) {
  const claimed = amount(c.claimed_amount, c.claimed);
  const approved = amount(c.approved_amount, c.approved);
  const copay = amount(c.copay);
  const deductions = amount(c.deductions, Math.max(claimed - approved - copay, 0));
  const auditTrail = c.audit_trail || c.auditTrail || c.trail || [];

  return {
    id: c._id || c.id,
    claimNo: c.claim_id || c.claimId,
    patient: c.patient || "-",
    memberId: c.member_id || c.memberId || "-",
    provider: c.provider || "Unknown provider",
    doctor: c.doctor || "-",
    docRegNo: c.docRegNo || "-",
    serviceDate: fmtDate(c.serviceDate),
    department: c.diagnosis || "OPD",
    claimed,
    deductions,
    copay,
    approved,
    confidence: pct(c.confidence_score ?? c.confidence),
    status: decisionOf(c),
    rules: auditTrail.map((t) => ({
      id: t.ruleId || t._id,
      label: t.label || t.ruleId || t.category || "Rule",
      state: ruleState(t.status),
      detail: t.detail || "",
    })),
    rejectionReasons: c.rejection_reasons || c.rejectionReasons || [],
    rejectedItems: c.rejected_items || c.rejectedItems || [],
    irrelevantTests: c.irrelevant_tests || c.irrelevantTests || [],
    nextSteps: c.next_steps || c.nextSteps || "",
  };
}
