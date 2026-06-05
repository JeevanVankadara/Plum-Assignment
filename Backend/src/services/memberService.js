import Member from '../models/Member.js';

export function isTrackableMemberId(memberId) {
  const value = typeof memberId === 'string' ? memberId.trim() : '';
  return value.length > 0 && value.toUpperCase() !== 'UNKNOWN';
}

function approvedAmount(value) {
  return Math.max(0, Number(value) || 0);
}

function hasObjectId(list = [], id) {
  const target = String(id);
  return list.some(item => String(item?._id || item) === target);
}

export async function recordMemberClaim({ claimId, claimObjectId, memberId, patient, approved }) {
  if (!isTrackableMemberId(memberId)) return null;

  const spent = approvedAmount(approved);
  let member = await Member.findOne({ memberId });

  if (!member) {
    member = await Member.create({
      memberId,
      name: patient || null,
      totalSpent: spent,
      claimCount: 1,
      claimIds: [claimId],
      claims: claimObjectId ? [claimObjectId] : [],
      lastClaimAt: new Date(),
    });
    return member;
  }

  if (patient && !member.name) member.name = patient;
  if (!Array.isArray(member.claimIds)) member.claimIds = [];
  if (!Array.isArray(member.claims)) member.claims = [];

  if (!member.claimIds.includes(claimId)) {
    member.claimIds.push(claimId);
    member.claimCount = member.claimIds.length;
    member.totalSpent = approvedAmount(member.totalSpent) + spent;
  }

  if (claimObjectId && !hasObjectId(member.claims, claimObjectId)) {
    member.claims.push(claimObjectId);
  }

  member.lastClaimAt = new Date();
  await member.save();
  return member;
}

export async function linkClaimObjectToMember(member, claimObjectId) {
  if (!member || !claimObjectId) return null;
  if (!Array.isArray(member.claims)) member.claims = [];
  if (hasObjectId(member.claims, claimObjectId)) return member;

  member.claims.push(claimObjectId);
  await member.save();
  return member;
}

export async function adjustMemberSpendForOverride({ claim, previousApproved, nextApproved }) {
  if (!isTrackableMemberId(claim?.memberId)) return null;

  const delta = approvedAmount(nextApproved) - approvedAmount(previousApproved);
  const memberRef = claim.member?._id || claim.member;
  let member = memberRef ? await Member.findById(memberRef) : await Member.findOne({ memberId: claim.memberId });

  if (!member) {
    return recordMemberClaim({
      claimId: claim.claimId,
      claimObjectId: claim._id,
      memberId: claim.memberId,
      patient: claim.patient,
      approved: nextApproved,
    });
  }

  if (claim.patient && !member.name) member.name = claim.patient;
  if (!Array.isArray(member.claimIds)) member.claimIds = [];
  if (!Array.isArray(member.claims)) member.claims = [];
  if (!member.claimIds.includes(claim.claimId)) member.claimIds.push(claim.claimId);
  if (claim._id && !hasObjectId(member.claims, claim._id)) member.claims.push(claim._id);

  member.claimCount = member.claimIds.length;
  member.totalSpent = Math.max(0, approvedAmount(member.totalSpent) + delta);
  member.lastClaimAt = new Date();
  await member.save();
  return member;
}
