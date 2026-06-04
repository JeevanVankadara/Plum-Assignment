// Format: [State Code]/[Number]/[Year], with an optional council prefix for AYUSH docs.
const REG_RE = /^([A-Z]{2,5}\/)?[A-Z]{2,3}\/\d{3,6}\/(19|20)\d{2}$/;

export function isValidDoctorReg(reg) {
  if (!reg || typeof reg !== 'string') return false;
  return REG_RE.test(reg.trim());
}
