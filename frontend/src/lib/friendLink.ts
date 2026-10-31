import type { FriendLink, FriendLinkParams } from '../api/socialService';

// Link de amizade: /social/add/<codigo>?e=<expira>&t=<assinatura>. Com a
// assinatura valida quem o abre fica logo amigo; sem ela (ou expirada) e um
// pedido normal.
export const FRIEND_LINK_BASE = '/social/add';

export function friendLinkPath(link: FriendLink): string {
  const params = new URLSearchParams({ e: String(link.expires), t: link.token });
  return `${FRIEND_LINK_BASE}/${encodeURIComponent(link.code)}?${params.toString()}`;
}

export function friendLinkUrl(link: FriendLink, origin: string = window.location.origin): string {
  return `${origin}${friendLinkPath(link)}`;
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * Le um link colado (ou so o codigo) no campo "adicionar amigo". Devolve
 * null para texto que nao e nem um codigo nem um link de amizade.
 */
export function parseFriendInput(input: string): FriendLinkParams | null {
  const value = input.trim();
  if (CODE_PATTERN.test(value)) return { friendCode: value };
  let url: URL;
  try {
    url = new URL(value, 'https://placeholder.invalid');
  } catch {
    return null;
  }
  const match = url.pathname.match(/\/social\/add\/([A-Za-z0-9_-]{1,32})\/?$/);
  if (!match) return null;
  const expires = Number(url.searchParams.get('e'));
  const token = url.searchParams.get('t') ?? undefined;
  return {
    friendCode: match[1],
    ...(Number.isFinite(expires) && expires > 0 && token ? { expires, token } : {}),
  };
}
