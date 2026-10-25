/**
 * Nome a mostrar em pushes e avisos: User.name e opcional (contas criadas
 * por email/password podem nao ter), por isso cai para a parte local do
 * email, como ja faziam os avisos do caderno. Nunca devolve so espacos.
 */
export function pushDisplayName(
  user: { name?: string | null; email?: string | null } | null | undefined,
): string {
  const name = user?.name?.trim();
  if (name) return name;
  return user?.email?.split('@')[0]?.trim() ?? '';
}
