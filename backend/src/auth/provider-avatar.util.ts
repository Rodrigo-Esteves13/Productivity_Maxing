// Fotos de perfil que vêm dos providers OAuth (Google/GitHub/Discord).
//
// Duas regras de segurança/consistência, sem precisar de coluna nova:
//  1. Só se guardam URLs https de hosts conhecidos de cada provider - um
//     `photo` vindo do provider nunca vira um URL arbitrário no <img> do
//     cliente.
//  2. Sincronizar a foto no login só substitui uma foto que JÁ veio do mesmo
//     provider (host do mesmo provider). Uma foto carregada pelo utilizador
//     (bucket próprio) ou vinda de outro provider nunca é sobrescrita.

export type ProviderAvatarOrigin = 'google' | 'github' | 'discord';

const HOST_MATCHERS: Record<ProviderAvatarOrigin, (host: string) => boolean> = {
  google: (host) =>
    host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com'),
  github: (host) => host === 'avatars.githubusercontent.com',
  discord: (host) => host === 'cdn.discordapp.com',
};

// null = não é uma foto de provider conhecido (ex: o nosso bucket, ou um
// URL inválido/http).
export function providerAvatarOrigin(
  url: string | null | undefined,
): ProviderAvatarOrigin | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  for (const origin of Object.keys(HOST_MATCHERS) as ProviderAvatarOrigin[]) {
    if (HOST_MATCHERS[origin](host)) return origin;
  }
  return null;
}

// A foto do provider só é aceite se for de um host conhecido.
export function trustedProviderAvatar(
  url: string | null | undefined,
): string | null {
  return providerAvatarOrigin(url) ? (url ?? null) : null;
}

// Decide se o login deve gravar `incoming` como avatar do utilizador:
// - sem avatar atual: sim (se a foto nova for de confiança);
// - avatar atual do MESMO provider e diferente: sim (a pessoa mudou a foto
//   no Google/GitHub/Discord, acompanhamos);
// - avatar carregado pelo utilizador ou de outro provider: nunca.
export function shouldSyncProviderAvatar(
  current: string | null | undefined,
  incoming: string | null | undefined,
): boolean {
  const incomingOrigin = providerAvatarOrigin(incoming);
  if (!incomingOrigin) return false;
  if (!current) return true;
  if (current === incoming) return false;
  return providerAvatarOrigin(current) === incomingOrigin;
}
