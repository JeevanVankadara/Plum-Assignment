// Format: [State Code]/[Number]/[Year] e.g. MH/12345/2010
const REG_RE = /^[A-Z]{2,3}\/\d{3,6}\/(19|20)\d{2}$/;

export function isValidDoctorReg(reg) {
  if (!reg || typeof reg !== 'string') return false;
  return REG_RE.test(reg.trim());
}
