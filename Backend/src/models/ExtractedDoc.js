import mongoose from 'mongoose';

const extractedDocSchema = new mongoose.Schema({
  claimId: { type: String, index: true },
  filename: String,
  originalName: String,
  mimetype: String,
  path: String,
  documentType: String,
  extractedFields: mongoose.Schema.Types.Mixed,
  rawLlmResponse: String,
  legibilityScore: Number,
}, { timestamps: true });

export default mongoose.model('ExtractedDoc', extractedDocSchema);
