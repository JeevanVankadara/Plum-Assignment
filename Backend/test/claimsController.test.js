import test from 'node:test';
import assert from 'node:assert/strict';
import Claim from '../src/models/Claim.js';
import AuditTrail from '../src/models/AuditTrail.js';
import Member from '../src/models/Member.js';
import { overrideDecision, updateAdminText } from '../src/controllers/claimsController.js';

function patchModel(t, model, patches) {
  const originals = {};
  for (const [key, value] of Object.entries(patches)) {
    originals[key] = model[key];
    model[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(originals)) {
      model[key] = value;
    }
  });
}

function responseRecorder() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('finalizes an unfinalized claim once and returns finalization fields', async (t) => {
  const claim = {
    _id: 'claim-object-1',
    claimId: 'CLM_LOCK',
    memberId: 'MEM-LOCK',
    patient: 'Neha Kapoor',
    claimed: 1000,
    approved: 700,
    deductions: 300,
    decision: 'PARTIAL',
    adminFinalized: false,
    irrelevantTests: [],
    trail: [],
    saveCount: 0,
    async save() {
      this.saveCount += 1;
    },
  };
  const member = {
    _id: 'member-1',
    memberId: 'MEM-LOCK',
    totalSpent: 700,
    claimIds: ['CLM_LOCK'],
    claims: ['claim-object-1'],
    async save() {},
  };
  let findByIdCalls = 0;

  patchModel(t, Claim, {
    findById: () => {
      findByIdCalls += 1;
      if (findByIdCalls === 1) return Promise.resolve(claim);
      return {
        populate() {
          return {
            populate() {
              return {
                populate() {
                  return Promise.resolve({
                    ...claim,
                    member,
                    documents: [],
                    trail: [],
                  });
                },
              };
            },
          };
        },
      };
    },
  });
  patchModel(t, Member, {
    findOne: async () => member,
    findById: async () => member,
  });
  patchModel(t, AuditTrail, {
    create: async () => ({ _id: 'trail-1' }),
  });

  const req = {
    params: { id: 'claim-object-1' },
    body: {
      decision: 'APPROVED',
      approved: 900,
      deductions: 100,
      notes: 'Admin approved final amount',
      nextSteps: 'Pay claimant after final audit.',
    },
  };
  const res = responseRecorder();

  await overrideDecision(req, res, (err) => { throw err; });

  assert.equal(res.statusCode, 200);
  assert.equal(claim.decision, 'APPROVED');
  assert.equal(claim.approved, 900);
  assert.equal(claim.deductions, 100);
  assert.equal(claim.adminFinalized, true);
  assert.equal(claim.adminDecision, 'APPROVED');
  assert.equal(claim.adminNotes, 'Admin approved final amount');
  assert.equal(claim.adminNextSteps, 'Pay claimant after final audit.');
  assert.ok(claim.adminDecisionAt instanceof Date);
  assert.equal(res.body.adminFinalized, true);
  assert.equal(res.body.adminDecision, 'APPROVED');
  assert.equal(res.body.notes, 'Admin approved final amount');
  assert.equal(res.body.next_steps, 'Pay claimant after final audit.');
});

test('rejects a second admin finalization attempt with 409', async (t) => {
  patchModel(t, Claim, {
    findById: async () => ({
      _id: 'claim-object-1',
      adminFinalized: true,
    }),
  });

  const req = {
    params: { id: 'claim-object-1' },
    body: { decision: 'REJECTED' },
  };
  const res = responseRecorder();

  await overrideDecision(req, res, (err) => { throw err; });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'Claim decision is already finalized');
});

test('saves admin notes and next steps without changing finalized decision', async (t) => {
  const claim = {
    _id: 'claim-object-2',
    claimId: 'CLM_TEXT',
    memberId: 'MEM-TEXT',
    member: 'member-2',
    decision: 'REJECTED',
    approved: 0,
    claimed: 1000,
    adminFinalized: true,
    adminDecision: 'REJECTED',
    adminNotes: 'Old notes',
    adminNextSteps: 'Old next steps',
    trail: [],
    async save() {},
  };
  let findByIdCalls = 0;

  patchModel(t, Claim, {
    findById: () => {
      findByIdCalls += 1;
      if (findByIdCalls === 1) return Promise.resolve(claim);
      return {
        populate() {
          return {
            populate() {
              return {
                populate() {
                  return Promise.resolve({
                    ...claim,
                    documents: [],
                    trail: [],
                  });
                },
              };
            },
          };
        },
      };
    },
  });
  patchModel(t, AuditTrail, {
    create: async () => ({ _id: 'trail-text' }),
  });

  const req = {
    params: { id: 'claim-object-2' },
    body: {
      notes: 'Updated notes',
      nextSteps: 'Updated next steps',
    },
  };
  const res = responseRecorder();

  await updateAdminText(req, res, (err) => { throw err; });

  assert.equal(res.statusCode, 200);
  assert.equal(claim.decision, 'REJECTED');
  assert.equal(claim.adminFinalized, true);
  assert.equal(claim.adminNotes, 'Updated notes');
  assert.equal(claim.adminNextSteps, 'Updated next steps');
  assert.equal(res.body.notes, 'Updated notes');
  assert.equal(res.body.next_steps, 'Updated next steps');
});
