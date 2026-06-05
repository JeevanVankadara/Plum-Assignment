import mongoose from 'mongoose';

const auditTrailSchema = new mongoose.Schema({
  claimId: { type: String, index: true },
  memberId: { type: String, index: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  step: String,         // eligibility | documents | coverage | limits | medical | process
  ruleId: String,       // e.g. DOCTOR_REG_INVALID
  label: String,
  status: { type: String, enum: ['pass','warn','fail'] },
  detail: String,
  evidence: mongoose.Schema.Types.Mixed,
  order: Number,
}, { timestamps: true });

export default mongoose.model('AuditTrail', auditTrailSchema);
