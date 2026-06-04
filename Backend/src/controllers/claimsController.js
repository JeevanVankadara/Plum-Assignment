import crypto from 'node:crypto';
import Claim from '../models/Claim.js';
import ExtractedDoc from '../models/ExtractedDoc.js';
import AuditTrail from '../models/AuditTrail.js';
import { extractFromDocument } from '../services/geminiService.js';
import { adjudicate } from '../services/adjudicationService.js';

function newClaimId() {
  return 'CLM_' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function mergeExtracted(docs) {
  const pick = (key) => docs.map(d => d.extractedFields?.[key]).find(Boolean);
  const lineItems = docs.flatMap(d => d.extractedFields?.lineItems || []);
  const total = lineItems.reduce((s, li) => s + (li.amount || 0), 0) ||
    docs.reduce((s, d) => s + (d.extractedFields?.totalAmount || 0), 0);
  return {
    patient: pick('patientName'),
    age: pick('age'),
    doctor: pick('doctorName'),
    docRegNo: pick('doctorRegNo'),
    provider: pick('provider'),
    serviceDate: pick('serviceDate'),
    diagnosis: pick('diagnosis'),
    department: pick('documentType'),
    lineItems,
    claimed: total,
  };
}

export async function createClaim(req, res, next) {
  try {
    const files = req.files || [];
    const memberId = req.body.memberId || 'UNKNOWN';
    const claimId = newClaimId();

    if (!files.length) return res.status(400).json({ error: 'At least one file required' });

    const extractedDocs = [];
    let avgLegibility = 0;
    for (const file of files) {
      const { parsed, raw } = await extractFromDocument(file);
      const doc = await ExtractedDoc.create({
        claimId,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        path: file.path,
        documentType: parsed.documentType,
        extractedFields: parsed,
        rawLlmResponse: raw,
        legibilityScore: parsed.legibilityScore ?? 0.7,
      });
      extractedDocs.push(doc);
      avgLegibility += doc.legibilityScore;
    }
    avgLegibility /= extractedDocs.length;

    const merged = mergeExtracted(extractedDocs);
    const claimDraft = { claimId, memberId, ...merged };

    const result = adjudicate({
      claim: claimDraft,
      extractedDocs,
      llmConfidence: avgLegibility,
    });

    const trailDocs = await AuditTrail.insertMany(
      result.trail.map(t => ({ ...t, claimId }))
    );

    const claim = await Claim.create({
      ...claimDraft,
      deductions: result.deductions,
      copay: result.copay,
      approved: result.approved,
      decision: result.decision,
      rejectionReasons: result.rejectionReasons,
      notes: result.notes,
      nextSteps: result.nextSteps,
      confidence: result.confidence,
      documents: extractedDocs.map(d => d._id),
      trail: trailDocs.map(t => t._id),
    });

    res.status(201).json(await populated(claim._id));
  } catch (err) { next(err); }
}

export async function listClaims(_req, res, next) {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 }).limit(50);
    res.json(claims);
  } catch (err) { next(err); }
}

export async function getClaim(req, res, next) {
  try {
    const claim = await populated(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json(claim);
  } catch (err) { next(err); }
}

export async function overrideDecision(req, res, next) {
  try {
    const { decision, reason } = req.body;
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    claim.decision = decision;
    if (decision === 'REJECTED') claim.approved = 0;
    await claim.save();

    const trail = await AuditTrail.create({
      claimId: claim.claimId,
      step: 'manual',
      ruleId: 'MANUAL_OVERRIDE',
      label: 'Manual reviewer decision',
      status: decision === 'APPROVED' ? 'pass' : 'fail',
      detail: reason || `Reviewer set decision to ${decision}`,
      order: claim.trail.length,
    });
    claim.trail.push(trail._id);
    await claim.save();

    res.json(await populated(claim._id));
  } catch (err) { next(err); }
}

async function populated(id) {
  return Claim.findById(id).populate('documents').populate('trail');
}
