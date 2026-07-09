import { formatEnumLabel } from './formatEnumLabel';

interface KeyedOption {
  key: string;
  label: string;
}

// TaskType e AcademicTaskType deixaram de ser enum fixo (ver schema.prisma):
// `key` é o identificador estável usado no código, `label` é o texto que o
// admin edita livremente para a UI. Mostrar a `key` diretamente (ex: via
// formatEnumLabel) é sempre errado para estes dois casos - só serve para
// enums a sério como Difficulty/ProgressStatus, que continuam fixos e em
// inglês na BD.
//
// O fallback para formatEnumLabel(key) só existe para o caso raro de a key
// já não corresponder a nenhuma opção carregada (ex: dados a meio de um
// refresh), para nunca mostrar um ecrã em branco.
export function resolveOptionLabel(
  key: string | null | undefined,
  options: KeyedOption[],
): string | null {
  if (!key) return null;
  return options.find((o) => o.key === key)?.label ?? formatEnumLabel(key);
}
