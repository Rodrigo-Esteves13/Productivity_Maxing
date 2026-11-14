// "Quebra" de uma task em passos a partir dos topicos que o user escreveu:
// um passo por topico. Puro, sem rede.
export const MAX_TOPIC_STEPS = 12;
export const MAX_STEP_LENGTH = 80;
export const MIN_TOPICS_FOR_SUGGESTION = 2;

export function topicsToSteps(topics: string): string[] {
  const seen = new Set<string>();
  const steps: string[] = [];
  for (const raw of topics.split(/[\n,;]+/)) {
    const step = raw.trim().slice(0, MAX_STEP_LENGTH).trim();
    const key = step.toLowerCase();
    if (!step || seen.has(key)) continue;
    seen.add(key);
    steps.push(step);
    if (steps.length >= MAX_TOPIC_STEPS) break;
  }
  return steps;
}

/** Texto novo da checklist com os passos que ainda la nao estao (um por linha). */
export function mergeStepsIntoChecklist(current: string, steps: readonly string[]): string {
  const existing = current
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
  const missing = steps.filter((step) => !existing.includes(step.toLowerCase()));
  if (missing.length === 0) return current;
  const base = current.trimEnd();
  return base ? `${base}\n${missing.join('\n')}` : missing.join('\n');
}
