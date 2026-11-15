import type { MouseEvent } from 'react';

// Ctrl+clique (Cmd+clique no Mac) num link escrito numa caixa de texto abre-o
// num separador novo, como nos editores de codigo. So http(s): nada de
// javascript:, data: ou ficheiros locais.
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);
const WWW_PREFIX = 'www.';
// Pontuacao que costuma colar-se ao fim de um link numa frase.
const TRAILING_PUNCTUATION = /[).,;:!?'"\]>]+$/;
const LEADING_PUNCTUATION = /^[(<["']+/;

// Link (normalizado) na posicao `index` do texto, ou null.
export function linkAt(text: string, index: number): string | null {
  if (index < 0 || index > text.length) return null;
  let start = index;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  let end = index;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  const token = text.slice(start, end).replace(LEADING_PUNCTUATION, '').replace(TRAILING_PUNCTUATION, '');
  if (!token) return null;
  const candidate = token.toLowerCase().startsWith(WWW_PREFIX) ? `https://${token}` : token;
  try {
    const url = new URL(candidate);
    return SAFE_PROTOCOLS.has(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

export function openLinkOnModClick(event: MouseEvent<HTMLTextAreaElement | HTMLInputElement>): boolean {
  if (!(event.ctrlKey || event.metaKey)) return false;
  const field = event.currentTarget;
  const url = linkAt(field.value, field.selectionStart ?? -1);
  if (!url) return false;
  event.preventDefault();
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
