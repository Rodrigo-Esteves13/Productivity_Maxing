// Topicos, fontes e figuras do quiz importado.

import {
  QUIZ_FIGURE_ID_MAX,
  QUIZ_MAX_FIGURES,
  QUIZ_MAX_SOURCES,
  QUIZ_MAX_TOPICS,
  QUIZ_SOURCE_TITLE_MAX,
  QUIZ_TOPIC_MAX,
  QUIZ_URL_MAX,
  type QuizSource,
} from './quizFormat';
import { sanitizeQuizDiagram } from './quizDiagram';
import {
  isReservedId,
  type Counters,
  type Figures,
  type Json,
  isObject,
  pick,
  sanitizeQuizText,
} from './quizImportShared';

// So https: http (sem TLS) conta como ligacao recusada.
const SAFE_PROTOCOL = 'https:';

function safeUrl(raw: unknown, counters: Counters): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol === SAFE_PROTOCOL && url.href.length <= QUIZ_URL_MAX) return url.href;
  } catch {
    // Cai para o contador abaixo.
  }
  counters.badLinks += 1;
  return null;
}

export function readTopics(raw: unknown, counters: Counters): Map<string, string> {
  const map = new Map<string, string>();
  const add = (id: unknown, name: unknown) => {
    const label = sanitizeQuizText(name ?? id, QUIZ_TOPIC_MAX, counters, false);
    if (label && map.size < QUIZ_MAX_TOPICS) map.set(String(id), label);
  };
  if (Array.isArray(raw)) {
    raw.forEach((t) => (isObject(t) ? add(pick(t, 'id', 'name'), pick(t, 'name', 'label', 'id')) : add(t, t)));
  } else if (isObject(raw)) {
    Object.entries(raw).forEach(([id, name]) => add(id, name));
  }
  return map;
}

export function readSources(raw: unknown, counters: Counters): QuizSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, QUIZ_MAX_SOURCES).flatMap((s): QuizSource[] => {
    const url = safeUrl(isObject(s) ? pick(s, 'url', 'href') : s, counters);
    const title = sanitizeQuizText(isObject(s) ? pick(s, 'title', 'name') : '', QUIZ_SOURCE_TITLE_MAX, counters, false);
    if (!url && !title) return [];
    // Sem titulo fica o dominio, limpo como os outros textos (pode passar do maximo).
    return [{ title: title || sanitizeQuizText(url ? new URL(url).hostname : '', QUIZ_SOURCE_TITLE_MAX, counters, false), url }];
  });
}

// Id vazio (recusado) se o resultado fosse uma chave proibida (ex.: "__proto__!").
function figureId(raw: string): string {
  const id = raw.replace(/[^\w-]/g, '').slice(0, QUIZ_FIGURE_ID_MAX);
  return isReservedId(id) ? '' : id;
}

// Id livre para uma figura inline: nunca substitui uma figura ja lida.
function freeFigureId(figures: Figures, base: string): string {
  let id = base;
  for (let n = 2; figures.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

function addFigure(figures: Figures, id: string, raw: unknown, counters: Counters): string | null {
  if (!id || figures.size >= QUIZ_MAX_FIGURES) {
    counters.badFigures += 1;
    return null;
  }
  const { diagram, removed } = sanitizeQuizDiagram(raw);
  counters.badFigures += removed + (diagram ? 0 : 1);
  if (!diagram) return null;
  figures.set(id, diagram);
  return id;
}

export function readFigures(raw: unknown, counters: Counters): Figures {
  const figures: Figures = new Map();
  if (isObject(raw)) Object.entries(raw).forEach(([id, diagram]) => addFigure(figures, figureId(id), diagram, counters));
  return figures;
}

// "figure": id de uma figura, o proprio diagrama (objeto), ou ["id"] como no quiz de exemplo.
export function readFigureRef(q: Json, index: number, figures: Figures, counters: Counters): string | null {
  // 'd' so conta como figura quando e uma lista (formato de exemplo); "d": "hard" e dificuldade.
  const rawD = Array.isArray(q.d) ? q.d : undefined;
  const raw = pick(q, 'figure', 'fig') ?? rawD;
  const ref: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  if (ref === undefined || ref === null || ref === '') return null;
  if (isObject(ref)) return addFigure(figures, freeFigureId(figures, `q${index + 1}-figure`), ref, counters);
  const id = typeof ref === 'string' ? figureId(ref) : '';
  if (figures.has(id)) return id;
  counters.badFigures += 1;
  return null;
}
