import type {
  AdminTextPayload,
  BackendClaimDto,
  ClaimDecision,
  ClaimDetailModel,
  ClaimSummary,
  ReviewDecisionPayload,
  RuleState,
  UploadPayload,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (): Promise<unknown> => fetch(`${BASE}/api/health`).then((res) => handle<unknown>(res)),
  list: (): Promise<BackendClaimDto[]> => fetch(`${BASE}/api/claims`).then((res) => handle<BackendClaimDto[]>(res)),
  get: (id: string): Promise<BackendClaimDto> => fetch(`${BASE}/api/claims/${id}`).then((res) => handle<BackendClaimDto>(res)),
  create: ({ memberId, files }: UploadPayload): Promise<BackendClaimDto> => {
    const fd = new FormData();
    if (memberId) fd.append("memberId", memberId);
    for (const f of files) fd.append("files", f);
    return fetch(`${BASE}/api/claims`, { method: "POST", body: fd }).then((res) => handle<BackendClaimDto>(res));
  },
  decide: (id: string, decision: ClaimDecision, review: ReviewDecisionPayload | string = {}): Promise<BackendClaimDto> =>
    fetch(`${BASE}/api/claims/${id}/decision`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(typeof review === "string" ? { decision, notes: review } : { decision, ...review }),
    }).then((res) => handle<BackendClaimDto>(res)),
  saveAdminText: (id: string, payload: AdminTextPayload): Promise<BackendClaimDto> =>
    fetch(`${BASE}/api/claims/${id}/admin-text`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((res) => handle<BackendClaimDto>(res)),
};

const STATUS_MAP: Record<string, ClaimDecision> = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PARTIAL: "PARTIAL",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  PROCESSING: "MANUAL_REVIEW",
  PENDING: "PENDING",
};

function fmtDate(d?: string): string {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ruleState(s?: string): RuleState {
  if (s === "pass") return "pass";
  if (s === "warn") return "warn";
  return "fail";
}

function pct(value: unknown): number {
  const n = Number(value) || 0;
  return Math.round(n <= 1 ? n * 100 : n);
}

function amount(...values: unknown[]): number {
  for (const value of values) {
    if (value !== undefined && value !== null) return Number(value) || 0;
  }
  return 0;
}

function decisionOf(c: BackendClaimDto): ClaimDecision | string {
  const decision = c.decision || c.status || "PENDING";
  return STATUS_MAP[decision] || decision;
}

export function adaptClaimSummary(c: BackendClaimDto): ClaimSummary {
  return {
    id: c._id || c.id || "",
    claimNo: c.claim_id || c.claimId,
    patient: c.patient || "-",
    memberId: c.member_id || c.memberId || "-",
    provider: c.provider || "-",
    department: c.department || c.diagnosis || "OPD",
    claimed: amount(c.claimed_amount, c.claimed),
    approved: amount(c.approved_amount, c.approved),
    confidence: pct(c.confidence_score ?? c.confidence),
    status: decisionOf(c),
    adminFinalized: c.adminFinalized === true,
    adminDecision: c.adminDecision || null,
  };
}

export function adaptClaimDetail(c: BackendClaimDto): ClaimDetailModel {
  const claimed = amount(c.claimed_amount, c.claimed);
  const approved = amount(c.approved_amount, c.approved);
  const copay = amount(c.copay);
  const deductions = amount(c.deductions, Math.max(claimed - approved - copay, 0));
  const auditTrail = c.audit_trail || c.auditTrail || c.trail || [];

  return {
    id: c._id || c.id || "",
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
    adminFinalized: c.adminFinalized === true,
    adminDecision: c.adminDecision || null,
    rules: auditTrail.map((t) => ({
      id: t.ruleId || t._id || "RULE",
      label: t.label || t.ruleId || t.category || "Rule",
      state: ruleState(t.status),
      detail: t.detail || "",
    })),
    rejectionReasons: c.rejection_reasons || c.rejectionReasons || [],
    rejectedItems: c.rejected_items || c.rejectedItems || [],
    irrelevantTests: c.irrelevant_tests || c.irrelevantTests || [],
    nextSteps: c.next_steps || c.nextSteps || "",
    notes: c.notes || "",
    systemNotes: c.system_notes || c.systemNotes || "",
    systemNextSteps: c.system_next_steps || c.systemNextSteps || "",
    adminDecisionAt: c.adminDecisionAt || null,
    adminNotes: c.adminNotes || null,
    adminNextSteps: c.adminNextSteps || null,
  };
}
