// Junta texto colado/escrito a uma lista de bloqueio (processos, dominios).
// Aceita varios valores separados por virgula ou mudanca de linha; devolve a
// lista nova e o que ficou de fora (duplicado ou invalido) para avisar.

export type BlockListRejectReason = 'invalid' | 'duplicate';

export interface BlockListReject {
  value: string;
  reason: BlockListRejectReason;
}

export interface BlockListAddResult {
  next: string[];
  added: string[];
  rejected: BlockListReject[];
}

const LIST_SEPARATOR = /[,\n\r]+/;

export function hasListSeparator(raw: string): boolean {
  return LIST_SEPARATOR.test(raw.trim());
}

export function addToBlockList(
  items: readonly string[],
  raw: string,
  normalize?: (value: string) => string | null,
): BlockListAddResult {
  const seen = new Set(items);
  const added: string[] = [];
  const rejected: BlockListReject[] = [];
  for (const part of raw.split(LIST_SEPARATOR)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const value = normalize ? normalize(trimmed) : trimmed;
    if (!value) {
      rejected.push({ value: trimmed, reason: 'invalid' });
    } else if (seen.has(value)) {
      rejected.push({ value, reason: 'duplicate' });
    } else {
      seen.add(value);
      added.push(value);
    }
  }
  return { next: [...items, ...added], added, rejected };
}
