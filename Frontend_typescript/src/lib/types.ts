export type ClaimDecision = "APPROVED" | "REJECTED" | "PARTIAL" | "MANUAL_REVIEW" | "PENDING";
export type RuleState = "pass" | "warn" | "fail";

export interface IrrelevantTest {
  testName: string;
  amount: number;
  reason?: string;
  excluded?: boolean;
}

export interface IrrelevantTestOverride {
  testName: string;
  amount: number;
  excluded: boolean;
}

export interface ReviewDecisionPayload {
  approved?: number;
  deductions?: number;
  irrelevantTestOverrides?: IrrelevantTestOverride[];
  notes?: string;
}

export interface BackendAuditTrailItem {
  _id?: string;
  ruleId?: string;
  label?: string;
  category?: string;
  status?: string;
  detail?: string;
}

export interface BackendClaimDto {
  _id?: string;
  id?: string;
  claim_id?: string;
  claimId?: string;
  member_id?: string;
  memberId?: string;
  patient?: string;
  provider?: string;
  doctor?: string;
  docRegNo?: string;
  serviceDate?: string;
  department?: string;
  diagnosis?: string;
  claimed_amount?: number;
  claimed?: number;
  approved_amount?: number;
  approved?: number;
  deductions?: number;
  copay?: number;
  confidence_score?: number;
  confidence?: number;
  decision?: ClaimDecision | string;
  status?: ClaimDecision | string;
  audit_trail?: BackendAuditTrailItem[];
  auditTrail?: BackendAuditTrailItem[];
  trail?: BackendAuditTrailItem[];
  rejection_reasons?: string[];
  rejectionReasons?: string[];
  rejected_items?: string[];
  rejectedItems?: string[];
  irrelevant_tests?: IrrelevantTest[];
  irrelevantTests?: IrrelevantTest[];
  next_steps?: string;
  nextSteps?: string;
  createdAt?: string;
}

export interface ClaimRule {
  id: string;
  label: string;
  state: RuleState;
  detail: string;
}

export interface ClaimSummary {
  id: string;
  claimNo?: string;
  patient: string;
  memberId: string;
  provider: string;
  department: string;
  claimed: number;
  approved: number;
  confidence: number;
  status: ClaimDecision | string;
}

export interface ClaimDetailModel extends ClaimSummary {
  doctor: string;
  docRegNo: string;
  serviceDate: string;
  deductions: number;
  copay: number;
  rules: ClaimRule[];
  rejectionReasons: string[];
  rejectedItems: string[];
  irrelevantTests: IrrelevantTest[];
  nextSteps: string;
}

export interface UploadPayload {
  memberId: string;
  files: File[];
}
