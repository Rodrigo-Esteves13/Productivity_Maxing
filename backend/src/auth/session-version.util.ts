/**
 * O token ainda vale? So se a versao que traz for a versao atual do
 * utilizador. Tokens emitidos antes de existir `tv` nao a trazem e contam
 * como versao 0 (a versao inicial de toda a gente), por isso a mudanca nao
 * deslogou ninguem; o primeiro logout ou troca de password e que os invalida.
 */
export function isSessionCurrent(
  tokenVersionInJwt: number | undefined,
  currentVersion: number,
): boolean {
  return (tokenVersionInJwt ?? 0) === currentVersion;
}
