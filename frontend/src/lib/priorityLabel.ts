// As prioridades vem do catalogo gerido pelo admin (/task-types), com o
// rotulo guardado em ingles. As tres que a migracao criou (LOW/MEDIUM/HIGH)
// sao traduzidas enquanto o admin nao lhes mudar o nome; uma prioridade nova
// ou renomeada mostra exatamente o texto que o admin escreveu.
const SEEDED_LABEL: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

/** Chave i18n da prioridade se for uma das semeadas e com o nome original; senao null. */
export function seededPriorityKey(key: string, label: string | null | undefined): string | null {
  if (!Object.hasOwn(SEEDED_LABEL, key)) return null;
  return !label || label === SEEDED_LABEL[key] ? `priority.${key}` : null;
}
