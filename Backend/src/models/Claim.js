import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  description: String,
  amount: Number,
  category: String,
  payable: { type: Boolean, default: true },
  rejectionReason: String,
}, { _id: false });

const claimSchema = new mongoose.Schema({
  claimId: { type: String, unique: true, index: true },
  memberId: String,
  patient: String,
  age: Number,
  provider: String,
  doctor: String,
  docRegNo: String,
  department: String,
  diagnosis: String,
  serviceDate: String,
  submissionDate: String,
  documentTypes: [String],
  preAuthObtained: { type: Boolean, default: false },
  lineItems: [lineItemSchema],
  claimed: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  copay: { type: Number, default: 0 },
  approved: { type: Number, default: 0 },
  decision: { type: String, enum: ['APPROVED','REJECTED','PARTIAL','MANUAL_REVIEW','PENDING'], default: 'PENDING' },
  rejectionReasons: [String],
  rejectedItems: [String],
  fraudFlags: [String],
  notes: String,
  nextSteps: String,
  confidence: { type: Number, default: 0 },
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ExtractedDoc' }],
  trail: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AuditTrail' }],
}, { timestamps: true });

export default mongoose.model('Claim', claimSchema);
