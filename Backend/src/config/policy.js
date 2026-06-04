import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

let policy = null;
let rulesDoc = '';

export function loadPolicy() {
  policy = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'policy_terms.json'), 'utf-8'));
  rulesDoc = fs.readFileSync(path.join(DATA_DIR, 'adjudication_rules.md'), 'utf-8');
  console.log('Policy loaded:', policy.policy_id);
  return policy;
}

export function getPolicy() {
  if (!policy) loadPolicy();
  return policy;
}

export function getRulesDoc() {
  if (!rulesDoc) loadPolicy();
  return rulesDoc;
}
