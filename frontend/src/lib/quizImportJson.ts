// Leitura do JSON (puro ou dentro de um bloco de chat) e limites de estrutura.

import { QUIZ_MAX_DEPTH } from './quizFormat';
import { stripUnsafeChars } from './quizText';
import { FORBIDDEN_KEYS, isObject } from './quizImportShared';

// Bloco ```json de uma resposta de chat (procurado com indexOf, sem regex).
const FENCE = '```';
const FENCE_LANG = 'json';
const CLOSING_FENCE = `\n${FENCE}`;
const WHITESPACE = /\s/;

export function depthOk(value: unknown, depth = 0): boolean {
  if (depth > QUIZ_MAX_DEPTH) return false;
  if (Array.isArray(value)) return value.every((v) => depthOk(v, depth + 1));
  if (isObject(value)) return Object.values(value).every((v) => depthOk(v, depth + 1));
  return true;
}

export function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!isObject(value)) return false;
  return Object.keys(value).some((k) => FORBIDDEN_KEYS.has(k) || hasForbiddenKey(value[k]));
}

// Conteudo do primeiro bloco ```json (ou ```) com quebra de linha depois da
// abertura, ate ao proximo "\n```". Linear: cada parte do texto e lida uma vez
// (um regex com [\s\S]*? voltava a percorrer o texto a cada abertura).
function fencedBlock(text: string): string | null {
  for (let open = text.indexOf(FENCE); open !== -1; open = text.indexOf(FENCE, open + 1)) {
    let i = open + FENCE.length;
    const lang = text.slice(i, i + FENCE_LANG.length);
    if (lang.toLowerCase() === FENCE_LANG) i += FENCE_LANG.length;
    // O conteudo comeca depois da ultima quebra de linha dos espacos seguintes.
    let start = -1;
    for (; i < text.length && WHITESPACE.test(text[i]); i += 1) if (text[i] === '\n') start = i + 1;
    if (start !== -1) {
      // Sem fecho depois desta abertura tambem nao ha depois das seguintes.
      const end = text.indexOf(CLOSING_FENCE, start);
      return end === -1 ? null : text.slice(start, end);
    }
  }
  return null;
}

// JSON puro, ou dentro de um bloco ```json (resposta colada de um chat).
export function parseQuizJson(text: string): unknown {
  const clean = stripUnsafeChars(text).trim();
  try {
    return JSON.parse(clean);
  } catch {
    const fenced = fencedBlock(clean);
    if (fenced === null) return undefined;
    try {
      return JSON.parse(fenced);
    } catch {
      return undefined;
    }
  }
}
