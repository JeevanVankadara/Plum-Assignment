import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  memberId: { type: String, unique: true, index: true },
  name: String,
  totalSpent: { type: Number, default: 0 },
  claimCount: { type: Number, default: 0 },
  claimIds: [String],
  claims: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Claim' }],
  lastClaimAt: Date,
}, { timestamps: true });

export default mongoose.model('Member', memberSchema);
