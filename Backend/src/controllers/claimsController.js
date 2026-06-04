import crypto from 'node:crypto';
import Claim from '../models/Claim.js';
import ExtractedDoc from '../models/ExtractedDoc.js';
import AuditTrail from '../models/AuditTrail.js';
import { extractFromDocument } from '../services/geminiService.js';
import { adjudicate } from '../services/adjudicationService.js';

function newClaimId() {
  return 'CLM_' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

const CATEGORY_ALIASES = {
  consultation_fee: 'consultation',
  consultation_fees: 'consultation',
  medicines: 'pharmacy',
  medicine: 'pharmacy',
  drug: 'pharmacy',
  drugs: 'pharmacy',
  lab: 'diagnostic',
  lab_report: 'diagnostic',
  diagnostic_tests: 'diagnostic',
  diagnostics: 'diagnostic',
  tests: 'diagnostic',
  ayurveda: 'alternative',
  homeopathy: 'alternative',
  unani: 'alternative',
};

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeDocType(type) {
  const value = cleanString(type)?.toLowerCase();
  if (!value) return 'other';
  if (value.includes('prescription')) return 'prescription';
  if (value.includes('bill') || value.includes('receipt') || value.includes('invoice')) return 'bill';
  if (value.includes('lab') || value.includes('report') || value.includes('diagnostic')) return 'lab_report';
  return value;
}

function normalizeCategory(category, description = '') {
  const raw = cleanString(category)?.toLowerCase();
  if (raw && CATEGORY_ALIASES[raw]) return CATEGORY_ALIASES[raw];
  if (['consultation', 'pharmacy', 'diagnostic', 'dental', 'vision', 'alternative', 'other'].includes(raw)) {
    return raw;
  }

  const text = `${raw || ''} ${description}`.toLowerCase();
  if (/consult|doctor|opd/.test(text)) return 'consultation';
  if (/medicine|tablet|capsule|drug|pharmacy|rx/.test(text)) return 'pharmacy';
  if (/test|scan|x-?ray|mri|ct|cbc|ecg|ultrasound|lab/.test(text)) return 'diagnostic';
  if (/dental|tooth|teeth|root canal|filling|extraction/.test(text)) return 'dental';
  if (/eye|vision|glasses|lens|lasik/.test(text)) return 'vision';
  if (/ayurveda|homeopathy|unani|panchakarma/.test(text)) return 'alternative';
  return 'other';
}

function normalizeLineItem(item = {}) {
  const description = cleanString(item.description || item.name || item.item || item.procedure || 'Claim item') || 'Claim item';
  return {
    description,
    amount: Number(item.amount ?? item.total ?? item.price ?? 0) || 0,
    category: normalizeCategory(item.category, description),
    payable: item.payable !== false,
    rejectionReason: item.rejectionReason || null,
  };
}

function isNonClaimCharge(item) {
  return /gst|cgst|sgst|igst|tax|round\s*off|rounding|service charge/i.test(item.description || '');
}

function asTextArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function testNamesFromDoc(fields = {}) {
  return [
    ...asTextArray(fields.tests_prescribed),
    ...(Array.isArray(fields.lineItems)
      ? fields.lineItems
        .map(normalizeLineItem)
        .filter(item => item.category === 'diagnostic' && !isNonClaimCharge(item))
        .map(item => item.description)
      : []),
  ];
}

function fieldText(fields = {}) {
  return [
    fields.diagnosis,
    fields.treatment,
    fields.notes,
    ...(Array.isArray(fields.prescription) ? fields.prescription : []),
    ...(Array.isArray(fields.procedures) ? fields.procedures : []),
    ...(Array.isArray(fields.tests_prescribed) ? fields.tests_prescribed : []),
    ...(Array.isArray(fields.lineItems) ? fields.lineItems.map(i => `${i.description || ''} ${i.category || ''}`) : []),
  ].filter(Boolean).join(' ');
}

function mergeExtracted(docs, fallbackMemberId, fallbackSubmissionDate) {
  const fields = docs.map(d => d.extractedFields || {});
  const pick = (...keys) => {
    for (const key of keys) {
      const found = fields.map(f => f[key]).find(Boolean);
      if (found) return cleanString(found);
    }
    return undefined;
  };

  const documentTypes = [...new Set(fields.map(f => normalizeDocType(f.documentType)).filter(Boolean))];
  const lineItems = fields.flatMap(f => Array.isArray(f.lineItems) ? f.lineItems.map(normalizeLineItem).filter(item => !isNonClaimCharge(item)) : []);
  const lineTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const docTotal = fields.reduce((sum, f) => sum + (Number(f.totalAmount) || 0), 0);
  const prescribedTests = fields
    .filter(f => normalizeDocType(f.documentType) === 'prescription')
    .flatMap(testNamesFromDoc);
  const diagnosticInvoiceTests = fields
    .filter(f => normalizeDocType(f.documentType) !== 'prescription')
    .flatMap(testNamesFromDoc);
  const hasDiagnosticClaim = lineItems.some(item => item.payable !== false && item.category === 'diagnostic');

  return {
    memberId: cleanString(fallbackMemberId) || pick('memberId') || 'UNKNOWN',
    patient: pick('patientName', 'patient', 'memberName'),
    age: Number(pick('age')) || null,
    doctor: pick('doctorName', 'doctor'),
    docRegNo: pick('doctorRegNo', 'doctor_reg', 'doctorRegistrationNumber'),
    provider: pick('provider', 'hospital', 'clinic'),
    serviceDate: pick('serviceDate', 'treatmentDate', 'treatment_date'),
    submissionDate: cleanString(fallbackSubmissionDate) || pick('submissionDate', 'submittedDate'),
    diagnosis: pick('diagnosis'),
    department: documentTypes.join(', ') || 'OPD',
    documentTypes,
    prescribedTests: [...new Set(prescribedTests)],
    diagnosticInvoiceTests: [...new Set(diagnosticInvoiceTests)],
    hasDiagnosticClaim,
    preAuthObtained: fields.some(f => f.preAuthObtained === true || f.pre_authorization === true),
    lineItems,
    claimed: lineTotal || docTotal,
    evidenceText: fields.map(fieldText).filter(Boolean).join(' '),
  };
}

function toDecisionDto(claimDoc) {
  const claim = typeof claimDoc.toObject === 'function' ? claimDoc.toObject() : claimDoc;
  const documents = claim.documents || [];
  const auditTrail = (claim.trail || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    id: claim._id,
    _id: claim._id,
    claim_id: claim.claimId,
    claimId: claim.claimId,
    member_id: claim.memberId,
    memberId: claim.memberId,
    patient: claim.patient,
    age: claim.age,
    provider: claim.provider,
    doctor: claim.doctor,
    docRegNo: claim.docRegNo,
    serviceDate: claim.serviceDate,
    submissionDate: claim.submissionDate,
    department: claim.department,
    diagnosis: claim.diagnosis,
    lineItems: claim.lineItems || [],
    documentTypes: claim.documentTypes || [],
    prescribedTests: claim.prescribedTests || [],
    diagnosticInvoiceTests: claim.diagnosticInvoiceTests || [],
    hasDiagnosticClaim: claim.hasDiagnosticClaim || false,
    claimed_amount: claim.claimed || 0,
    claimed: claim.claimed || 0,
    decision: claim.decision,
    status: claim.decision,
    approved_amount: claim.approved || 0,
    approved: claim.approved || 0,
    deductions: claim.deductions || 0,
    copay: claim.copay || 0,
    rejection_reasons: claim.rejectionReasons || [],
    rejectionReasons: claim.rejectionReasons || [],
    rejected_items: claim.rejectedItems || [],
    rejectedItems: claim.rejectedItems || [],
    fraud_flags: claim.fraudFlags || [],
    confidence_score: claim.confidence || 0,
    confidence: claim.confidence || 0,
    notes: claim.notes,
    next_steps: claim.nextSteps,
    nextSteps: claim.nextSteps,
    documents: documents.map(d => ({
      id: d._id,
      filename: d.filename,
      originalName: d.originalName,
      mimetype: d.mimetype,
      documentType: d.documentType,
      legibilityScore: d.legibilityScore,
      extractedFields: d.extractedFields,
    })),
    audit_trail: auditTrail,
    auditTrail,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

export async function createClaim(req, res, next) {
  try {
    const files = req.files || [];
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
        documentType: normalizeDocType(parsed.documentType),
        extractedFields: parsed,
        rawLlmResponse: raw,
        legibilityScore: parsed.legibilityScore ?? 0.7,
      });
      extractedDocs.push(doc);
      avgLegibility += doc.legibilityScore;
    }
    avgLegibility /= extractedDocs.length;

    const claimDraft = {
      claimId,
      ...mergeExtracted(extractedDocs, req.body.memberId, req.body.submissionDate),
    };
    const previousClaims = claimDraft.memberId && claimDraft.memberId !== 'UNKNOWN'
      ? await Claim.find({ memberId: claimDraft.memberId }).sort({ createdAt: -1 }).limit(25)
      : [];

    const result = adjudicate({
      claim: claimDraft,
      extractedDocs,
      llmConfidence: avgLegibility,
      previousClaims,
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
      rejectedItems: result.rejectedItems,
      fraudFlags: result.fraudFlags,
      notes: result.notes,
      nextSteps: result.nextSteps,
      confidence: result.confidence,
      documents: extractedDocs.map(d => d._id),
      trail: trailDocs.map(t => t._id),
    });

    res.status(201).json(toDecisionDto(await populated(claim._id)));
  } catch (err) { next(err); }
}

export async function listClaims(_req, res, next) {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 }).limit(50);
    res.json(claims.map(toDecisionDto));
  } catch (err) { next(err); }
}

export async function getClaim(req, res, next) {
  try {
    const claim = await populated(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json(toDecisionDto(claim));
  } catch (err) { next(err); }
}

export async function overrideDecision(req, res, next) {
  try {
    const { decision, reason, notes } = req.body;
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
      detail: reason || notes || `Reviewer set decision to ${decision}`,
      order: claim.trail.length,
    });
    claim.trail.push(trail._id);
    await claim.save();

    res.json(toDecisionDto(await populated(claim._id)));
  } catch (err) { next(err); }
}

async function populated(id) {
  return Claim.findById(id).populate('documents').populate('trail');
}
