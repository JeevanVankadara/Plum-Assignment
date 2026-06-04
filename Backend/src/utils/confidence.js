export function aggregateConfidence(trail, llmConfidence = 0.9) {
  if (!trail.length) return llmConfidence;
  const passes = trail.filter(t => t.status === 'pass').length;
  const warns = trail.filter(t => t.status === 'warn').length;
  const ruleScore = (passes + warns * 0.5) / trail.length;
  return Math.round(((ruleScore * 0.6 + llmConfidence * 0.4)) * 100) / 100;
}
