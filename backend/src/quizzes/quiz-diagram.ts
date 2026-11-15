// Diagramas dos quizzes como DADOS, nunca markup. A IA descreve nos, ligacoes,
// etiquetas e areas com valores de listas fechadas; a app desenha tudo com os
// seus proprios componentes (frontend/src/components/Quizzes/QuizDiagram.tsx). Nao existe
// nenhum caminho por onde SVG, HTML, CSS ou URLs vindos do JSON cheguem ao ecra.
// Copia de frontend/src/lib/quizDiagram.ts: manter as duas iguais.
//
// CONTRATO (partilhado por validador, renderer, prompt e conversor):
//   QuizDiagram = { w, h, nodes, links, labels, areas }
//   - w, h: inteiros, DIAGRAM_MIN_W..DIAGRAM_MAX_W e DIAGRAM_MIN_H..DIAGRAM_MAX_H.
//   - coordenadas: numeros finitos dentro de [0, w] x [0, h], arredondados a 1 casa.
//   - ids: DIAGRAM_ID (letras, digitos, _ e -), unicos dentro do diagrama.
//   - links.from / links.to: ids de nodes existentes e diferentes.
//   - textos: texto simples (sem markdown nem HTML), limpo e cortado ao maximo.
//   - enums: so os valores das listas abaixo; outro valor = elemento recusado.
//   - chaves desconhecidas sao ignoradas; a saida canonica so tem as chaves abaixo,
//     por esta ordem, e os opcionais em falta ficam com o valor por omissao.

import { cleanQuizText } from './quiz-text';

export const DIAGRAM_MIN_W = 120;
export const DIAGRAM_MAX_W = 1200;
export const DIAGRAM_MIN_H = 60;
export const DIAGRAM_MAX_H = 800;
export const DIAGRAM_MAX_NODES = 40;
export const DIAGRAM_MAX_LINKS = 80;
export const DIAGRAM_MAX_LABELS = 80;
export const DIAGRAM_MAX_AREAS = 12;
export const DIAGRAM_LABEL_MAX = 60;
export const DIAGRAM_TEXT_MAX = 120;
export const DIAGRAM_ID = /^[A-Za-z0-9_-]{1,24}$/;
// Curvatura de uma ligacao: deslocamento do ponto de controlo em px (0 = reta).
export const DIAGRAM_MAX_BEND = 400;

export const DIAGRAM_NODE_KINDS = [
  'router',
  'switch',
  'pc',
  'server',
  'cloud',
  'firewall',
  'box',
  'pill',
  'circle',
  'dot',
  'packet',
  'cross',
] as const;
export const DIAGRAM_TONES = [
  'default',
  'muted',
  'accent',
  'blue',
  'purple',
  'red',
  'amber',
] as const;
export const DIAGRAM_LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;
export const DIAGRAM_WEIGHTS = ['thin', 'normal', 'thick'] as const;
export const DIAGRAM_TEXT_SIZES = ['sm', 'md', 'lg'] as const;
export const DIAGRAM_ANCHORS = ['start', 'middle', 'end'] as const;
export const DIAGRAM_ARROWS = ['none', 'end', 'both'] as const;

export type DiagramNodeKind = (typeof DIAGRAM_NODE_KINDS)[number];
export type DiagramTone = (typeof DIAGRAM_TONES)[number];
export type DiagramLineStyle = (typeof DIAGRAM_LINE_STYLES)[number];
export type DiagramWeight = (typeof DIAGRAM_WEIGHTS)[number];
export type DiagramTextSize = (typeof DIAGRAM_TEXT_SIZES)[number];
export type DiagramAnchor = (typeof DIAGRAM_ANCHORS)[number];
export type DiagramArrow = (typeof DIAGRAM_ARROWS)[number];

// Canonico: todas as chaves presentes, por esta ordem.
export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  x: number;
  y: number;
  // Texto por baixo (dispositivos) ou dentro (box, pill, circle). '' = sem texto.
  label: string;
  // Segunda linha, mais pequena (ex.: "RID 1.1.1.1"). '' = sem texto.
  sub: string;
  tone: DiagramTone;
  // Destaque (contorno mais forte), ex.: o estado escondido numa sequencia.
  highlight: boolean;
}

export interface DiagramLink {
  from: string;
  to: string;
  // Etiqueta no meio da ligacao (ex.: rede, custo). '' = sem etiqueta.
  label: string;
  style: DiagramLineStyle;
  weight: DiagramWeight;
  tone: DiagramTone;
  arrow: DiagramArrow;
  // Ver DIAGRAM_MAX_BEND. Positivo curva para a esquerda do sentido from -> to.
  bend: number;
}

export interface DiagramLabel {
  x: number;
  y: number;
  text: string;
  tone: DiagramTone;
  size: DiagramTextSize;
  anchor: DiagramAnchor;
  mono: boolean;
}

// Retangulo a tracejado para agrupar (area OSPF, VLAN, LAN...).
export interface DiagramArea {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tone: DiagramTone;
}

export interface QuizDiagram {
  w: number;
  h: number;
  nodes: DiagramNode[];
  links: DiagramLink[];
  labels: DiagramLabel[];
  areas: DiagramArea[];
}

export interface QuizDiagramResult {
  diagram: QuizDiagram | null;
  // Elementos recusados (enum invalido, fora dos limites, ligacao orfa...).
  removed: number;
}

// ---------------------------------------------------------------------------
// Validacao: qualquer valor (JSON de uma IA) -> diagrama canonico ou null.
// Estrito: numeros so como numeros finitos (nunca "12"), enums exatos, textos
// so como strings; um campo invalido recusa o elemento inteiro (conta em
// removed). Textos com HTML perigoso ficam limpos e tambem contam em removed.
// Idempotente: sanitizeQuizDiagram(saida) devolve a mesma saida e removed 0.

// Chaves que nunca podem aparecer (poluicao de prototipos), nem como ids.
const DIAGRAM_FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
// Coordenadas arredondadas a 1 casa decimal.
const DIAGRAM_DECIMAL_SCALE = 10;
const PLAIN_TEXT = { multiline: false, markdown: false } as const;

type DiagramJson = Record<string, unknown>;
interface DiagramTally {
  dangerous: boolean;
}

const isDiagramObject = (v: unknown): v is DiagramJson =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
// So propriedades proprias: um Object.prototype poluido nunca entra no diagrama.
const own = (obj: DiagramJson, key: string): unknown =>
  Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
const hasForbiddenKey = (obj: DiagramJson) =>
  Object.keys(obj).some((k) => DIAGRAM_FORBIDDEN_KEYS.has(k));
const isMissing = (v: unknown) => v === undefined || v === null;

const toTenths = (v: number) => Math.round(v * DIAGRAM_DECIMAL_SCALE);
// Arredonda a 1 casa; -0 passa a 0 (JSON escreve os dois como 0).
function roundTenth(v: number): number {
  const rounded = toTenths(v) / DIAGRAM_DECIMAL_SCALE;
  return rounded === 0 ? 0 : rounded;
}

// Numero finito, arredondado, dentro de [min, max]; undefined se invalido.
function readNumber(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const rounded = roundTenth(v);
  return rounded >= min && rounded <= max ? rounded : undefined;
}

// Valor da lista; em falta = fallback (sem fallback e obrigatorio).
function readEnum<T extends string>(
  list: readonly T[],
  v: unknown,
  fallback?: T,
): T | undefined {
  if (isMissing(v)) return fallback;
  return typeof v === 'string' && (list as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

function readBool(v: unknown): boolean | undefined {
  if (isMissing(v)) return false;
  return typeof v === 'boolean' ? v : undefined;
}

function readText(
  v: unknown,
  max: number,
  tally: DiagramTally,
): string | undefined {
  if (isMissing(v)) return '';
  if (typeof v !== 'string') return undefined;
  const { text, dangerous } = cleanQuizText(v, max, PLAIN_TEXT);
  if (dangerous) tally.dangerous = true;
  return text;
}

const isDiagramId = (v: unknown): v is string =>
  typeof v === 'string' && DIAGRAM_ID.test(v) && !DIAGRAM_FORBIDDEN_KEYS.has(v);

function readNode(
  raw: unknown,
  w: number,
  h: number,
  seen: Set<string>,
  tally: DiagramTally,
): DiagramNode | null {
  if (!isDiagramObject(raw) || hasForbiddenKey(raw)) return null;
  const id = own(raw, 'id');
  if (!isDiagramId(id) || seen.has(id)) return null;
  const kind = readEnum(DIAGRAM_NODE_KINDS, own(raw, 'kind'));
  const x = readNumber(own(raw, 'x'), 0, w);
  const y = readNumber(own(raw, 'y'), 0, h);
  const label = readText(own(raw, 'label'), DIAGRAM_LABEL_MAX, tally);
  const sub = readText(own(raw, 'sub'), DIAGRAM_LABEL_MAX, tally);
  const tone = readEnum(DIAGRAM_TONES, own(raw, 'tone'), 'default');
  const highlight = readBool(own(raw, 'highlight'));
  if (
    kind === undefined ||
    x === undefined ||
    y === undefined ||
    label === undefined ||
    sub === undefined
  )
    return null;
  if (tone === undefined || highlight === undefined) return null;
  seen.add(id);
  return { id, kind, x, y, label, sub, tone, highlight };
}

function readLink(
  raw: unknown,
  nodeIds: Set<string>,
  tally: DiagramTally,
): DiagramLink | null {
  if (!isDiagramObject(raw) || hasForbiddenKey(raw)) return null;
  const from = own(raw, 'from');
  const to = own(raw, 'to');
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    from === to ||
    !nodeIds.has(from) ||
    !nodeIds.has(to)
  )
    return null;
  const label = readText(own(raw, 'label'), DIAGRAM_LABEL_MAX, tally);
  const style = readEnum(DIAGRAM_LINE_STYLES, own(raw, 'style'), 'solid');
  const weight = readEnum(DIAGRAM_WEIGHTS, own(raw, 'weight'), 'normal');
  const tone = readEnum(DIAGRAM_TONES, own(raw, 'tone'), 'default');
  const arrow = readEnum(DIAGRAM_ARROWS, own(raw, 'arrow'), 'none');
  const rawBend = own(raw, 'bend');
  const bend = isMissing(rawBend)
    ? 0
    : readNumber(rawBend, -DIAGRAM_MAX_BEND, DIAGRAM_MAX_BEND);
  if (
    label === undefined ||
    style === undefined ||
    weight === undefined ||
    tone === undefined
  )
    return null;
  if (arrow === undefined || bend === undefined) return null;
  return { from, to, label, style, weight, tone, arrow, bend };
}

function readLabel(
  raw: unknown,
  w: number,
  h: number,
  tally: DiagramTally,
): DiagramLabel | null {
  if (!isDiagramObject(raw) || hasForbiddenKey(raw)) return null;
  const x = readNumber(own(raw, 'x'), 0, w);
  const y = readNumber(own(raw, 'y'), 0, h);
  const text = readText(own(raw, 'text'), DIAGRAM_TEXT_MAX, tally);
  const tone = readEnum(DIAGRAM_TONES, own(raw, 'tone'), 'default');
  const size = readEnum(DIAGRAM_TEXT_SIZES, own(raw, 'size'), 'md');
  const anchor = readEnum(DIAGRAM_ANCHORS, own(raw, 'anchor'), 'middle');
  const mono = readBool(own(raw, 'mono'));
  // Uma etiqueta sem texto nao desenha nada.
  if (x === undefined || y === undefined || !text || tone === undefined)
    return null;
  if (size === undefined || anchor === undefined || mono === undefined)
    return null;
  return { x, y, text, tone, size, anchor, mono };
}

function readArea(
  raw: unknown,
  w: number,
  h: number,
  tally: DiagramTally,
): DiagramArea | null {
  if (!isDiagramObject(raw) || hasForbiddenKey(raw)) return null;
  const x = readNumber(own(raw, 'x'), 0, w);
  const y = readNumber(own(raw, 'y'), 0, h);
  const areaW = readNumber(own(raw, 'w'), 0, w);
  const areaH = readNumber(own(raw, 'h'), 0, h);
  const label = readText(own(raw, 'label'), DIAGRAM_LABEL_MAX, tally);
  const tone = readEnum(DIAGRAM_TONES, own(raw, 'tone'), 'default');
  if (
    x === undefined ||
    y === undefined ||
    areaW === undefined ||
    areaH === undefined
  )
    return null;
  if (label === undefined || tone === undefined || areaW <= 0 || areaH <= 0)
    return null;
  // Tem de caber no desenho; contas em decimas (inteiros), sem erros de virgula flutuante.
  const scale = DIAGRAM_DECIMAL_SCALE;
  if (
    toTenths(x) + toTenths(areaW) > w * scale ||
    toTenths(y) + toTenths(areaH) > h * scale
  )
    return null;
  return { x, y, w: areaW, h: areaH, label, tone };
}

// Le uma lista: invalidos e os que passam do limite saem e contam em removed.
function readList<T>(
  raw: unknown,
  cap: number,
  read: (item: unknown, tally: DiagramTally) => T | null,
  result: QuizDiagramResult,
): T[] {
  if (isMissing(raw)) return [];
  if (!Array.isArray(raw)) {
    result.removed += 1;
    return [];
  }
  const out: T[] = [];
  (raw as unknown[]).forEach((item) => {
    if (out.length >= cap) {
      result.removed += 1;
      return;
    }
    const tally: DiagramTally = { dangerous: false };
    const value = read(item, tally);
    if (value === null) {
      result.removed += 1;
      return;
    }
    if (tally.dangerous) result.removed += 1;
    out.push(value);
  });
  return out;
}

const isSize = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

// Diagrama de uma IA -> diagrama canonico (todas as chaves, ordem do contrato).
export function sanitizeQuizDiagram(raw: unknown): QuizDiagramResult {
  const result: QuizDiagramResult = { diagram: null, removed: 0 };
  if (!isDiagramObject(raw) || hasForbiddenKey(raw)) return result;
  const w = own(raw, 'w');
  const h = own(raw, 'h');
  if (
    !isSize(w, DIAGRAM_MIN_W, DIAGRAM_MAX_W) ||
    !isSize(h, DIAGRAM_MIN_H, DIAGRAM_MAX_H)
  )
    return result;

  const seen = new Set<string>();
  const nodes = readList(
    own(raw, 'nodes'),
    DIAGRAM_MAX_NODES,
    (item, tally) => readNode(item, w, h, seen, tally),
    result,
  );
  const nodeIds = new Set(nodes.map((n) => n.id));
  const links = readList(
    own(raw, 'links'),
    DIAGRAM_MAX_LINKS,
    (item, tally) => readLink(item, nodeIds, tally),
    result,
  );
  const labels = readList(
    own(raw, 'labels'),
    DIAGRAM_MAX_LABELS,
    (item, tally) => readLabel(item, w, h, tally),
    result,
  );
  const areas = readList(
    own(raw, 'areas'),
    DIAGRAM_MAX_AREAS,
    (item, tally) => readArea(item, w, h, tally),
    result,
  );
  // Sem nos, etiquetas nem areas nao ha nada para desenhar (ligacoes precisam de nos).
  if (nodes.length === 0 && labels.length === 0 && areas.length === 0)
    return result;
  result.diagram = { w, h, nodes, links, labels, areas };
  return result;
}
