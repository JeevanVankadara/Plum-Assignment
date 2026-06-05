import type { ClaimDetailModel } from "../lib/types";

export const mockClaims: ClaimDetailModel[] = [
  {
    id: "OPD-88291",
    patient: "Ananya Gupta",
    memberId: "MEM-44910",
    provider: "Max Healthcare, Saket",
    doctor: "Dr. Sanjay Verma",
    docRegNo: "12883-MCI",
    serviceDate: "24 Oct 2025",
    department: "General Medicine",
    claimed: 2840,
    deductions: 450,
    copay: 239,
    approved: 2151,
    confidence: 84,
    status: "MANUAL_REVIEW",
    adminFinalized: false,
    adminDecision: null,
    rules: [
      { id: "R-001", label: "Member Eligibility", state: "pass", detail: "Policy active until 12/2025. OPD cover limit: Rs.10,000/yr." },
      { id: "R-042", label: "Doctor Credentials", state: "pass", detail: "Dr. Sanjay Verma listed provider." },
      { id: "R-088", label: "Billing Consistency", state: "warn", detail: "Prescribed Cefixime 200mg but bill shows Cefixime 400mg." },
    ],
    rejectionReasons: [],
    rejectedItems: [],
    irrelevantTests: [],
    notes: "Claim requires reviewer attention.",
    nextSteps: "",
    systemNotes: "Claim requires reviewer attention.",
    systemNextSteps: "",
  },
];
