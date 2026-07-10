/**
 * Deriva a `key` técnica (estável, usada pelo código - ver comentário em
 * schema.prisma) a partir do `label` que o admin escreve. O admin nunca
 * mais vê nem edita a key: só o `label` (o "nome") é que é livremente
 * editável a qualquer momento; a key fica a viver por trás como o
 * identificador imutável, tal como o `id` - só que a key é legível
 * (usada em comparações no código, ex: "ACADEMICO"), o `id` é só a PK.
 */
export function slugifyToKey(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos: "Física" -> "Fisica"
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');

  if (!base) return 'TIPO';

  // A coluna exige começar por uma letra (mesma regra que os DTOs antigos
  // pediam ao utilizador, mantida aqui só que agora é automática).
  return /^[A-Z]/.test(base) ? base : `T_${base}`;
}
