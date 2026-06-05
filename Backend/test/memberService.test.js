import test from 'node:test';
import assert from 'node:assert/strict';
import Member from '../src/models/Member.js';
import { adjustMemberSpendForOverride, isTrackableMemberId, recordMemberClaim } from '../src/services/memberService.js';

function patchMemberModel(t, patches) {
  const originals = {};
  for (const [key, value] of Object.entries(patches)) {
    originals[key] = Member[key];
    Member[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(originals)) {
      Member[key] = value;
    }
  });
}

test('tracks only real member ids', () => {
  assert.equal(isTrackableMemberId('MEM-1000001'), true);
  assert.equal(isTrackableMemberId('UNKNOWN'), false);
  assert.equal(isTrackableMemberId(''), false);
  assert.equal(isTrackableMemberId(null), false);
});

test('creates a member record for the first claim', async (t) => {
  let created;
  patchMemberModel(t, {
    findOne: async () => null,
    create: async (doc) => {
      created = doc;
      return { _id: 'member-1', ...doc };
    },
  });

  const member = await recordMemberClaim({
    claimId: 'CLM_001',
    memberId: 'MEM-1000001',
    patient: 'Neha Kapoor',
    approved: 970,
  });

  assert.equal(member._id, 'member-1');
  assert.equal(created.memberId, 'MEM-1000001');
  assert.equal(created.name, 'Neha Kapoor');
  assert.equal(created.totalSpent, 970);
  assert.equal(created.claimCount, 1);
  assert.deepEqual(created.claimIds, ['CLM_001']);
});

test('updates an existing member with claim id and approved spend', async (t) => {
  let saved = false;
  const existing = {
    memberId: 'MEM-1000001',
    name: 'Neha Kapoor',
    totalSpent: 970,
    claimCount: 1,
    claimIds: ['CLM_001'],
    claims: [],
    save: async () => { saved = true; },
  };
  patchMemberModel(t, {
    findOne: async () => existing,
  });

  const member = await recordMemberClaim({
    claimId: 'CLM_002',
    claimObjectId: 'claim-object-2',
    memberId: 'MEM-1000001',
    patient: 'Neha Kapoor',
    approved: 400,
  });

  assert.equal(member.totalSpent, 1370);
  assert.equal(member.claimCount, 2);
  assert.deepEqual(member.claimIds, ['CLM_001', 'CLM_002']);
  assert.deepEqual(member.claims, ['claim-object-2']);
  assert.equal(saved, true);
});

test('manual override adjusts member spend by approved amount difference', async (t) => {
  let saved = false;
  const existing = {
    _id: 'member-1',
    memberId: 'MEM-1000001',
    name: 'Neha Kapoor',
    totalSpent: 1000,
    claimCount: 1,
    claimIds: ['CLM_001'],
    claims: ['claim-object-1'],
    save: async () => { saved = true; },
  };
  patchMemberModel(t, {
    findById: async () => existing,
    findOne: async () => existing,
  });

  await adjustMemberSpendForOverride({
    claim: {
      _id: 'claim-object-1',
      member: 'member-1',
      memberId: 'MEM-1000001',
      claimId: 'CLM_001',
      patient: 'Neha Kapoor',
    },
    previousApproved: 1000,
    nextApproved: 600,
  });

  assert.equal(existing.totalSpent, 600);
  assert.equal(existing.claimCount, 1);
  assert.equal(saved, true);
});
