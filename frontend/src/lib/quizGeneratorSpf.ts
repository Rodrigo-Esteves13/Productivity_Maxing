// Gerador do caminho SPF (com figura).

import type { DiagramLabel, DiagramLink, DiagramNode, QuizDiagram } from './quizDiagram';
import type { Translate, Rand } from './quizGeneratorIds';
import { HALF, randInt, shuffleWith } from './quizGeneratorRandom';
import { type Generator, choice, typed } from './quizGeneratorDraft';
import { DISTRACTORS } from './quizGeneratorSubnetting';

// ---------------------------------------------------------------------------
// spfPath: caminho de menor custo de A para F numa topologia com custos.
type SpfNode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
const SPF_START: SpfNode = 'A';
const SPF_END: SpfNode = 'F';
const SPF_POSITIONS: Record<SpfNode, [number, number]> = {
  A: [60, 150],
  B: [220, 60],
  C: [220, 240],
  D: [400, 60],
  E: [400, 240],
  F: [560, 150],
};
export const SPF_EDGES: readonly [SpfNode, SpfNode][] = [
  ['A', 'B'],
  ['A', 'C'],
  ['C', 'B'],
  ['B', 'D'],
  ['C', 'E'],
  ['D', 'F'],
  ['E', 'F'],
  ['D', 'E'],
];
// Custos do diagrama original (rede de seguranca se nenhuma tentativa servir).
const SPF_DEFAULT_WEIGHTS = [10, 2, 3, 4, 15, 3, 2, 2];
const SPF_WEIGHT_MIN = 1;
const SPF_WEIGHT_MAX = 15;
const SPF_ATTEMPTS = 300;
// Distratores tirados dos caminhos 2..10 (os mais parecidos com o melhor).
const SPF_CANDIDATES = 10;
const SPF_FIGURE_W = 620;
const SPF_FIGURE_H = 300;
const SPF_NOTE_Y = 292;
const PATH_SEPARATOR = ' -> ';

export interface SpfPath {
  path: string[];
  cost: number;
}

// Todos os caminhos simples de A para F, do mais barato para o mais caro.
export function spfPaths(weights: readonly number[]): SpfPath[] {
  const adj = new Map<string, [string, number][]>();
  SPF_EDGES.forEach(([a, b], i) => {
    adj.set(a, [...(adj.get(a) ?? []), [b, weights[i]]]);
    adj.set(b, [...(adj.get(b) ?? []), [a, weights[i]]]);
  });
  const out: SpfPath[] = [];
  const walk = (node: string, visited: Set<string>, path: string[], cost: number) => {
    if (node === SPF_END) {
      out.push({ path: [...path], cost });
      return;
    }
    (adj.get(node) ?? []).forEach(([next, w]) => {
      if (visited.has(next)) return;
      visited.add(next);
      path.push(next);
      walk(next, visited, path, cost + w);
      path.pop();
      visited.delete(next);
    });
  };
  walk(SPF_START, new Set<string>([SPF_START]), [SPF_START], 0);
  return out.sort((x, y) => x.cost - y.cost);
}

// Melhor caminho unico e 3 distratores com custos todos diferentes.
function pickSpf(r: Rand, weights: readonly number[]): { paths: SpfPath[]; wrong: SpfPath[] } | null {
  const paths = spfPaths(weights);
  if (paths[0].cost === paths[1].cost) return null;
  const costs = new Set([paths[0].cost]);
  const wrong: SpfPath[] = [];
  shuffleWith(r, paths.slice(1, SPF_CANDIDATES)).forEach((p) => {
    if (wrong.length >= DISTRACTORS || costs.has(p.cost)) return;
    costs.add(p.cost);
    wrong.push(p);
  });
  return wrong.length === DISTRACTORS ? { paths, wrong } : null;
}

function spfFigure(weights: readonly number[], t: Translate): QuizDiagram {
  const nodes: DiagramNode[] = (Object.keys(SPF_POSITIONS) as SpfNode[]).map((id) => ({
    id,
    kind: 'router',
    x: SPF_POSITIONS[id][0],
    y: SPF_POSITIONS[id][1],
    label: id,
    sub: '',
    tone: 'default',
    highlight: false,
  }));
  const links: DiagramLink[] = SPF_EDGES.map(([from, to], i) => ({
    from,
    to,
    label: String(weights[i]),
    style: 'solid',
    weight: 'normal',
    tone: 'accent',
    arrow: 'none',
    bend: 0,
  }));
  const labels: DiagramLabel[] = [
    { x: SPF_FIGURE_W / 2, y: SPF_NOTE_Y, text: t('quizGen.figure.costNote'), tone: 'muted', size: 'sm', anchor: 'middle', mono: false },
  ];
  return { w: SPF_FIGURE_W, h: SPF_FIGURE_H, nodes, links, labels, areas: [] };
}

const pathText = (p: SpfPath) => p.path.join(PATH_SEPARATOR);

export const genSpfPath: Generator = (r, t) => {
  let weights = SPF_DEFAULT_WEIGHTS;
  let picked: ReturnType<typeof pickSpf> = null;
  for (let g = 0; g < SPF_ATTEMPTS && !picked; g += 1) {
    const tryWeights = SPF_EDGES.map(() => randInt(r, SPF_WEIGHT_MIN, SPF_WEIGHT_MAX));
    picked = pickSpf(r, tryWeights);
    if (picked) weights = tryWeights;
  }
  if (!picked) picked = pickSpf(r, SPF_DEFAULT_WEIGHTS);
  // SPF_DEFAULT_WEIGHTS tem sempre melhor caminho unico (ver testes).
  const { paths, wrong } = picked as NonNullable<typeof picked>;
  const [best, second] = paths;
  const explanation = t('quizGen.spfPath.explain', { best: pathText(best), cost: best.cost, second: pathText(second), secondCost: second.cost });
  const figure = spfFigure(weights, t);
  if (r() < HALF) {
    return { ...choice(r, [pathText(best)], wrong.map(pathText), t('quizGen.spfPath.promptPath'), explanation), figure };
  }
  return { ...typed(t('quizGen.spfPath.promptCost'), [String(best.cost)], explanation), figure };
};
