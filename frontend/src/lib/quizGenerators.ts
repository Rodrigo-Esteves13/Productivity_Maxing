// Geradores de perguntas de calculo (sub-redes, wildcards, OSPF). Codigo da
// app, nunca texto de uma IA: cada pergunta e reconstruida de forma
// deterministica a partir de (tipo, seed), como os GEN do quiz de exemplo
// (ccna_ospf_quiz.html), portados e alargados. O quiz so guarda que tipos de
// gerador estao ligados. Todo o texto passa por `t` (chaves quizGen.<tipo>.*).
import type { QuizKind, QuizQuestion } from './quizFormat';
import type { DiagramLabel, DiagramLink, DiagramNode, QuizDiagram } from './quizDiagram';

export const GENERATOR_KINDS = [
  'wildcard',
  'networkCmd',
  'networkMatch',
  'ospfCost',
  'spfPath',
  'routerId',
  'drBdr',
  'longestMatch',
  'subnetInfo',
  'usableHosts',
  'summarize',
  'binaryDecimal',
] as const;
export type GeneratorKind = (typeof GENERATOR_KINDS)[number];
export type Translate = (key: string, params?: Record<string, string | number>) => string;
export type Rand = () => number;

export interface GeneratedQuestion {
  question: QuizQuestion;
  figure: QuizDiagram | null;
}

// Seeds validas: inteiros 1..2^31-1.
export const GENERATOR_MIN_SEED = 1;
export const GENERATOR_MAX_SEED = 2 ** 31 - 1;
const GENERATED_ID_PREFIX = 'gen';
const GENERATED_ID = /^gen-([A-Za-z]+)-([1-9]\d*)$/;

export const isGeneratorKind = (v: unknown): v is GeneratorKind =>
  typeof v === 'string' && (GENERATOR_KINDS as readonly string[]).includes(v);
export const generatedId = (kind: GeneratorKind, seed: number) => `${GENERATED_ID_PREFIX}-${kind}-${seed}`;
export const generatorStatKey = (kind: GeneratorKind) => `${GENERATED_ID_PREFIX}-${kind}`;

// Estrito: so aceita exatamente o que generatedId produz.
export function parseGeneratedId(id: string): { kind: GeneratorKind; seed: number } | null {
  const m = GENERATED_ID.exec(id);
  if (!m || !isGeneratorKind(m[1])) return null;
  const seed = Number(m[2]);
  if (!Number.isSafeInteger(seed) || seed < GENERATOR_MIN_SEED || seed > GENERATOR_MAX_SEED) return null;
  return generatedId(m[1], seed) === id ? { kind: m[1], seed } : null;
}

// gen-<tipo>-<seed> -> gen-<tipo> (estatisticas por gerador); outro id fica igual.
export const statKeyOf = (questionId: string): string => {
  const parsed = parseGeneratedId(questionId);
  return parsed ? generatorStatKey(parsed.kind) : questionId;
};

export function newSeed(rand: Rand = Math.random): number {
  const seed = GENERATOR_MIN_SEED + Math.floor(rand() * GENERATOR_MAX_SEED);
  return Math.min(GENERATOR_MAX_SEED, Math.max(GENERATOR_MIN_SEED, seed));
}

// ---------------------------------------------------------------------------
// Aleatorio com seed (mulberry32, igual ao `rng` do quiz de exemplo).
// Constantes do proprio algoritmo.
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFT_A = 15;
const MULBERRY_SHIFT_B = 7;
const MULBERRY_SHIFT_C = 14;
const MULBERRY_ODD = 61;
const UINT32_RANGE = 2 ** 32;

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + MULBERRY_INCREMENT) | 0;
    let x = Math.imul(a ^ (a >>> MULBERRY_SHIFT_A), 1 | a);
    x = (x + Math.imul(x ^ (x >>> MULBERRY_SHIFT_B), MULBERRY_ODD | x)) ^ x;
    return ((x ^ (x >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_RANGE;
  };
}

const HALF = 0.5;
export const randInt = (r: Rand, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
export const pickOne = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)];

export function shuffleWith<T>(r: Rand, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// IPv4 como numeros sem sinal (0..2^32-1).
export const IPV4_BITS = 32;
const OCTET_BITS = 8;
const OCTET_COUNT = 4;
const OCTET_VALUES = 256;
const OCTET_MAX = OCTET_VALUES - 1;
const ALL_ONES = UINT32_RANGE - 1;
// Bases privadas (RFC 1918).
const PRIVATE_10 = 10;
const PRIVATE_172 = 172;
const PRIVATE_172_MIN = 16;
const PRIVATE_172_MAX = 31;
const PRIVATE_192 = 192;
const PRIVATE_168 = 168;
const PRIVATE_KINDS = 3;

export const ipToNumber = (ip: string): number => ip.split('.').reduce((acc, octet) => acc * OCTET_VALUES + Number(octet), 0);

export function numberToIp(n: number): string {
  const v = n >>> 0;
  return Array.from({ length: OCTET_COUNT }, (_, i) => (v >>> (OCTET_BITS * (OCTET_COUNT - 1 - i))) & OCTET_MAX).join('.');
}

export const prefixMask = (prefix: number): number => (prefix <= 0 ? 0 : UINT32_RANGE - 2 ** (IPV4_BITS - prefix));
export const prefixWildcard = (prefix: number): number => ALL_ONES - prefixMask(prefix);
export const blockSize = (prefix: number): number => 2 ** (IPV4_BITS - prefix);
export const networkOf = (ip: number, prefix: number): number => (ip & prefixMask(prefix)) >>> 0;
export const matchesWildcard = (ip: number, network: number, wildcard: number): boolean => ((ip & ~wildcard) >>> 0) === ((network & ~wildcard) >>> 0);
const octetAt = (ip: number, index: number) => (ip >>> (OCTET_BITS * (OCTET_COUNT - 1 - index))) & OCTET_MAX;
export const toBinaryOctet = (value: number): string => value.toString(2).padStart(OCTET_BITS, '0');

// Endereco privado aleatorio (10/8, 172.16/12 ou 192.168/16).
function randomPrivate(r: Rand): number {
  const kind = randInt(r, 0, PRIVATE_KINDS - 1);
  const any = () => randInt(r, 0, OCTET_MAX);
  if (kind === 0) return ipToNumber(`${PRIVATE_10}.${any()}.${any()}.${any()}`);
  if (kind === 1) return ipToNumber(`${PRIVATE_172}.${randInt(r, PRIVATE_172_MIN, PRIVATE_172_MAX)}.${any()}.${any()}`);
  return ipToNumber(`${PRIVATE_192}.${PRIVATE_168}.${any()}.${any()}`);
}

// Custo OSPF: referencia / largura de banda, parte inteira, no minimo 1.
export const OSPF_COST_MIN = 1;
export const OSPF_COST_MAX = 65535;
const KBPS_PER_MBPS = 1000;
export const ospfCost = (referenceMbps: number, bandwidthKbps: number): number =>
  Math.min(OSPF_COST_MAX, Math.max(OSPF_COST_MIN, Math.floor((referenceMbps * KBPS_PER_MBPS) / bandwidthKbps)));

// Sumario mais especifico que cobre todas as redes (cada uma com `prefix`).
export function summarizeNetworks(networks: readonly number[], prefix: number): { network: number; prefix: number } {
  const low = Math.min(...networks);
  const high = Math.max(...networks) + blockSize(prefix) - 1;
  let length = prefix;
  while (length > 0 && networkOf(low, length) !== networkOf(high, length)) length -= 1;
  return { network: networkOf(low, length), prefix: length };
}

// Eleicao DR/BDR: prioridade 0 fica de fora; prioridade mais alta e depois RID mais alto.
export interface DrCandidate {
  name: string;
  routerId: string;
  priority: number;
}

export function electDrBdr(routers: readonly DrCandidate[]): DrCandidate[] {
  return routers.filter((x) => x.priority > 0).sort((a, b) => b.priority - a.priority || ipToNumber(b.routerId) - ipToNumber(a.routerId));
}

// ---------------------------------------------------------------------------
// Rascunho de cada gerador; generateQuestion completa o resto.
interface Draft {
  kind: QuizKind;
  prompt: string;
  code?: string;
  options?: string[];
  answer?: number[];
  accepted?: string[];
  explanation: string;
  figure?: QuizDiagram;
}

type Generator = (r: Rand, t: Translate) => Draft;

// Escolha: certas e erradas baralhadas com a seed (o indice certo varia).
function choice(r: Rand, right: readonly string[], wrong: readonly string[], prompt: string, explanation: string): Draft {
  const all = shuffleWith(r, [...right.map((text) => ({ text, ok: true })), ...wrong.map((text) => ({ text, ok: false }))]);
  return {
    kind: right.length > 1 ? 'multi' : 'single',
    prompt,
    options: all.map((o) => o.text),
    answer: all.flatMap((o, i) => (o.ok ? [i] : [])),
    explanation,
  };
}

const typed = (prompt: string, accepted: string[], explanation: string, code?: string): Draft => ({
  kind: 'typed',
  prompt,
  accepted: [...new Set(accepted)],
  explanation,
  code,
});

const prefixAnswers = (prefix: number) => [`/${prefix}`, String(prefix), numberToIp(prefixMask(prefix))];
const cmd = (text: string) => `\`${text}\``;
const OSPF_AREA = 0;
const networkCommand = (network: number, wildcard: number) => `network ${numberToIp(network)} ${numberToIp(wildcard)} area ${OSPF_AREA}`;

// ---------------------------------------------------------------------------
// wildcard: wildcard <-> mascara/prefixo (escrita).
const WILDCARD_PREFIX_MIN = 16;
const WILDCARD_PREFIX_MAX = 30;
const WILDCARD_ASK_WILDCARD_CHANCE = 0.65;

const genWildcard: Generator = (r, t) => {
  const prefix = randInt(r, WILDCARD_PREFIX_MIN, WILDCARD_PREFIX_MAX);
  const wildcard = numberToIp(prefixWildcard(prefix));
  const mask = numberToIp(prefixMask(prefix));
  if (r() < WILDCARD_ASK_WILDCARD_CHANCE) {
    const value = r() < HALF ? mask : `/${prefix}`;
    return typed(t('quizGen.wildcard.promptToWildcard', { value }), [wildcard], t('quizGen.wildcard.explainToWildcard', { mask, wildcard, prefix }));
  }
  return typed(t('quizGen.wildcard.promptToPrefix', { wildcard }), prefixAnswers(prefix), t('quizGen.wildcard.explainToPrefix', { wildcard, mask, prefix }));
};

// ---------------------------------------------------------------------------
// networkCmd: comando network certo para o IP de uma interface.
const NETWORK_CMD_PREFIXES = [22, 23, 24, 25, 26, 27, 28, 29, 29, 30, 30, 30];
const SHORT_INTERFACES = ['G0/0/0', 'G0/0/1', 'G0/0/2', 'S0/1/0', 'S0/1/1'];
const DISTRACTORS = 3;
// Erros tipicos: sub-rede vizinha (1 ou 2 blocos ao lado) ou wildcard de um prefixo mais longo.
const NEIGHBOR_STEP = 1;
const FAR_STEP = 2;
const LONGER_ONE = 1;
const LONGER_TWO = 2;

const genNetworkCmd: Generator = (r, t) => {
  const prefix = pickOne(r, NETWORK_CMD_PREFIXES);
  const size = blockSize(prefix);
  const network = networkOf(randomPrivate(r), prefix);
  const host = network + randInt(r, 1, size - 2);
  const wildcard = prefixWildcard(prefix);
  const longer = (extra: number) => prefixWildcard(Math.min(IPV4_BITS, prefix + extra));
  const candidates = shuffleWith(r, [
    [network + NEIGHBOR_STEP * size, wildcard],
    [network - NEIGHBOR_STEP * size, wildcard],
    [network + FAR_STEP * size, wildcard],
    [network - FAR_STEP * size, wildcard],
    [network, longer(LONGER_ONE)],
    [network, longer(LONGER_TWO)],
    [network + size, longer(LONGER_ONE)],
  ]);
  const right = networkCommand(network, wildcard);
  const seen = new Set([right]);
  const wrong: string[] = [];
  candidates.forEach(([net, wc]) => {
    const text = networkCommand(net, wc);
    if (wrong.length >= DISTRACTORS || seen.has(text) || matchesWildcard(host, net, wc)) return;
    seen.add(text);
    wrong.push(text);
  });
  const params = { iface: pickOne(r, SHORT_INTERFACES), address: `${numberToIp(host)}/${prefix}` };
  const explanation = t('quizGen.networkCmd.explain', {
    host: numberToIp(host),
    mask: numberToIp(prefixMask(prefix)),
    network: numberToIp(network),
    prefix,
    wildcard: numberToIp(wildcard),
  });
  return choice(r, [cmd(right)], wrong.map(cmd), t('quizGen.networkCmd.prompt', params), explanation);
};

// ---------------------------------------------------------------------------
// networkMatch: que IPs de interface um comando network apanha.
const MATCH_PREFIX_MIN = 22;
const MATCH_PREFIX_MAX = 29;
const MATCH_OPTIONS = 5;
const MATCH_IN_MIN = 1;
const MATCH_IN_MAX = 3;
const MATCH_OUT_ATTEMPTS = 400;
const MATCH_OUT_KINDS = 3;
const MATCH_FAR_MIN = 2;
const MATCH_FAR_MAX = 5;
// Um IP de interface nunca acaba em .0 nem .255 (pareceria um erro).
const looksLikeHost = (ip: number) => {
  const last = ip & OCTET_MAX;
  return last !== 0 && last !== OCTET_MAX;
};

const genNetworkMatch: Generator = (r, t) => {
  const prefix = randInt(r, MATCH_PREFIX_MIN, MATCH_PREFIX_MAX);
  const size = blockSize(prefix);
  const network = networkOf(randomPrivate(r), prefix);
  const wildcard = prefixWildcard(prefix);
  const count = randInt(r, MATCH_IN_MIN, MATCH_IN_MAX);
  const used = new Set<number>();
  const inside: number[] = [];
  while (inside.length < count) {
    const h = network + randInt(r, 1, size - 2);
    if (!used.has(h)) {
      used.add(h);
      inside.push(h);
    }
  }
  const outside: number[] = [];
  const addOutside = (h: number) => {
    if (outside.length >= MATCH_OPTIONS - count || used.has(h) || !looksLikeHost(h) || matchesWildcard(h, network, wildcard)) return;
    used.add(h);
    outside.push(h);
  };
  // Erros tipicos: logo a seguir ao bloco, logo antes, ou uns blocos mais a frente.
  const limit = Math.min(size, OCTET_MAX);
  for (let g = 0; g < MATCH_OUT_ATTEMPTS && outside.length < MATCH_OPTIONS - count; g += 1) {
    const kind = randInt(r, 0, MATCH_OUT_KINDS - 1);
    if (kind === 0) addOutside(network + size + randInt(r, 0, limit - 1));
    else if (kind === 1) addOutside(network - randInt(r, 1, limit));
    else addOutside(network + size * randInt(r, MATCH_FAR_MIN, MATCH_FAR_MAX) + randInt(r, 1, Math.max(1, size - 2)));
  }
  // Rede de seguranca (nunca acontece na pratica): hosts dos blocos seguintes.
  for (let k = 1; outside.length < MATCH_OPTIONS - count; k += 1) addOutside(network + size * k + 1);
  const command = cmd(networkCommand(network, wildcard));
  const prompt = count > 1 ? t('quizGen.networkMatch.promptMulti', { command, count }) : t('quizGen.networkMatch.promptSingle', { command });
  const explanation = t('quizGen.networkMatch.explain', {
    wildcard: numberToIp(wildcard),
    prefix,
    first: numberToIp(network),
    last: numberToIp(network + size - 1),
    inside: [...inside].sort((x, y) => x - y).map(numberToIp).join(', '),
  });
  return choice(r, inside.map(numberToIp), outside.map(numberToIp), prompt, explanation);
};

// ---------------------------------------------------------------------------
// ospfCost: custo de uma interface com a largura de banda de referencia (escrita).
const COST_INTERFACES: readonly [string, number][] = [
  ['serialT1', 1544],
  ['serialE1', 2048],
  ['serial512', 512],
  ['serial256', 256],
  ['ethernet', 10_000],
  ['fastEthernet', 100_000],
  ['gigabit', 1_000_000],
  ['tenGigabit', 10_000_000],
];
export const OSPF_DEFAULT_REFERENCE_MBPS = 100;
const COST_REFERENCES = [OSPF_DEFAULT_REFERENCE_MBPS, OSPF_DEFAULT_REFERENCE_MBPS, 1000, 10_000];
const RATIO_DECIMALS = 2;
const formatNumber = (v: number) => String(Number(v.toFixed(RATIO_DECIMALS)));

const genOspfCost: Generator = (r, t) => {
  const [ifaceKey, bandwidth] = pickOne(r, COST_INTERFACES);
  const reference = pickOne(r, COST_REFERENCES);
  const cost = ospfCost(reference, bandwidth);
  const iface = t(`quizGen.ospfCost.iface.${ifaceKey}`);
  const prompt =
    reference === OSPF_DEFAULT_REFERENCE_MBPS
      ? t('quizGen.ospfCost.promptDefault', { iface, reference })
      : t('quizGen.ospfCost.promptCustom', { iface, reference });
  const explanation = t('quizGen.ospfCost.explain', {
    reference,
    bandwidth: formatNumber(bandwidth / KBPS_PER_MBPS),
    ratio: formatNumber((reference * KBPS_PER_MBPS) / bandwidth),
    cost,
  });
  return typed(prompt, [String(cost)], explanation);
};

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

const genSpfPath: Generator = (r, t) => {
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

// ---------------------------------------------------------------------------
// routerId: eleicao do router ID OSPF a partir de uma tabela de interfaces.
const RID_FIRST_OCTETS = [10, 64, 172, 192, 198, 203, 209];
const RID_PHYSICAL_MIN = 2;
const RID_PHYSICAL_MAX = 4;
const RID_LOOPBACK_COUNTS = [0, 0, 1, 1, 2];
const RID_DOWN_CHANCE = 0.3;
const RID_CONFIG_CHANCE = 0.25;
const RID_CONFIGURED = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4', '5.5.5.5', '9.9.9.9'];
// Respostas erradas classicas quando a tabela nao chega para 3 distratores.
const RID_FILLERS = ['0.0.0.0', '1.1.1.1', '127.0.0.1'];
const PHYSICAL_PORTS = ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'Serial0/1/0', 'Serial0/1/1'];
const LOOPBACK = 'Loopback';
const OSPF_PROCESS_ID = 10;
const RID_ROUTER = 'R5';
const HOST_MIN = 1;
const HOST_MAX = 254;
// Colunas do `show ip interface brief`.
const COL_IFACE = 23;
const COL_ADDRESS = 16;
const COL_OK = 4;
const COL_METHOD = 7;
const COL_STATUS = 22;
const STATUS_UP = 'up';
const STATUS_ADMIN_DOWN = 'administratively down';
const STATUS_DOWN = 'down';

interface InterfaceRow {
  name: string;
  address: string;
  up: boolean;
  loopback: boolean;
}

const byAddressDesc = (a: InterfaceRow, b: InterfaceRow) => ipToNumber(b.address) - ipToNumber(a.address);
const highest = (rows: readonly InterfaceRow[]) => [...rows].sort(byAddressDesc)[0];
const tableLine = (cells: string[], widths: number[]) => cells.map((c, i) => (i < widths.length ? c.padEnd(widths[i]) : c)).join('').trimEnd();

function interfaceBrief(rows: readonly InterfaceRow[], configured: string | null): string {
  const widths = [COL_IFACE, COL_ADDRESS, COL_OK, COL_METHOD, COL_STATUS];
  const lines = [
    `${RID_ROUTER}# show ip interface brief`,
    tableLine(['Interface', 'IP-Address', 'OK?', 'Method', 'Status', 'Protocol'], widths),
    ...rows.map((x) => tableLine([x.name, x.address, 'YES', 'manual', x.up ? STATUS_UP : STATUS_ADMIN_DOWN, x.up ? STATUS_UP : STATUS_DOWN], widths)),
  ];
  if (configured) lines.push('', `${RID_ROUTER}# show running-config | section router ospf`, `router ospf ${OSPF_PROCESS_ID}`, ` router-id ${configured}`);
  return lines.join('\n');
}

const genRouterId: Generator = (r, t) => {
  const used = new Set<string>();
  const address = () => {
    let ip = '';
    do {
      ip = `${pickOne(r, RID_FIRST_OCTETS)}.${randInt(r, 0, OCTET_MAX)}.${randInt(r, 0, OCTET_MAX)}.${randInt(r, HOST_MIN, HOST_MAX)}`;
    } while (used.has(ip));
    used.add(ip);
    return ip;
  };
  const physical = randInt(r, RID_PHYSICAL_MIN, RID_PHYSICAL_MAX);
  const loopbacks = pickOne(r, RID_LOOPBACK_COUNTS);
  const rows: InterfaceRow[] = [];
  for (let i = 0; i < physical; i += 1) rows.push({ name: PHYSICAL_PORTS[i], address: address(), up: r() >= RID_DOWN_CHANCE, loopback: false });
  if (!rows.some((x) => x.up)) rows[0].up = true;
  for (let j = 0; j < loopbacks; j += 1) rows.push({ name: `${LOOPBACK}${j}`, address: address(), up: true, loopback: true });
  const configured = r() < RID_CONFIG_CHANCE ? pickOne(r, RID_CONFIGURED) : null;

  const top = highest(rows);
  const loops = rows.filter((x) => x.loopback);
  const active = rows.filter((x) => !x.loopback && x.up);
  let answer: string;
  let explanation: string;
  if (configured) {
    answer = configured;
    explanation = t('quizGen.routerId.explainConfigured');
  } else if (loops.length > 0) {
    const win = highest(loops);
    answer = win.address;
    const note = top.address !== answer ? ` ${t('quizGen.routerId.explainLoopbackNote', { iface: top.name })}` : '';
    explanation = `${t('quizGen.routerId.explainLoopback', { iface: win.name, address: answer })}${note}`;
  } else {
    const win = highest(active);
    answer = win.address;
    const note = !top.up ? ` ${t('quizGen.routerId.explainDownNote', { iface: top.name })}` : '';
    explanation = `${t('quizGen.routerId.explainPhysical', { iface: win.name, address: answer })}${note}`;
  }
  const wrong = [...rows].sort(byAddressDesc).map((x) => x.address).filter((x) => x !== answer).slice(0, DISTRACTORS);
  RID_FILLERS.forEach((f) => {
    if (wrong.length < DISTRACTORS && f !== answer && !wrong.includes(f)) wrong.push(f);
  });
  const prompt = configured ? t('quizGen.routerId.promptConfigured') : t('quizGen.routerId.promptElected');
  return { ...choice(r, [answer], wrong, prompt, explanation), code: interfaceBrief(rows, configured) };
};

// ---------------------------------------------------------------------------
// drBdr: eleicao DR/BDR a partir de prioridades e RIDs.
const DR_ROUTERS = 4;
const DR_RID_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DR_PRIORITIES = [0, 1, 1, 1, 1, 10, 50, 100, 200, 255];
const DR_MIN_ELIGIBLE = 2;
const DR_ATTEMPTS = 100;
const DR_FALLBACK_PRIORITY = 1;
const COL_ROUTER = 8;
const COL_RID = 12;
const ORDER_SEPARATOR = ' > ';

function drRouters(r: Rand): DrCandidate[] {
  let routers: DrCandidate[] = [];
  for (let g = 0; g < DR_ATTEMPTS; g += 1) {
    routers = shuffleWith(r, DR_RID_DIGITS)
      .slice(0, DR_ROUTERS)
      .map((d, i) => ({ name: `R${i + 1}`, routerId: Array(OCTET_COUNT).fill(d).join('.'), priority: pickOne(r, DR_PRIORITIES) }));
    if (electDrBdr(routers).length >= DR_MIN_ELIGIBLE) return routers;
  }
  // Rede de seguranca: os primeiros passam a elegiveis.
  return routers.map((x, i) => (i < DR_MIN_ELIGIBLE && x.priority === 0 ? { ...x, priority: DR_FALLBACK_PRIORITY } : x));
}

const genDrBdr: Generator = (r, t) => {
  const routers = drRouters(r);
  const elected = electDrBdr(routers);
  const [dr, bdr] = elected;
  const label = (a: DrCandidate, b: DrCandidate) => t('quizGen.drBdr.option', { dr: a.name, bdr: b.name });
  const right = label(dr, bdr);
  // Erros tipicos: trocar DR e BDR, so olhar para o RID (esquece a prioridade
  // e o 0), desempatar pelo RID mais baixo, e depois pares ao acaso.
  const ridDesc = (a: DrCandidate, b: DrCandidate) => ipToNumber(b.routerId) - ipToNumber(a.routerId);
  const byRid = [...routers].sort(ridDesc);
  const byPriority = [...routers].sort((a, b) => b.priority - a.priority || -ridDesc(a, b));
  const pairs = routers.flatMap((a) => routers.filter((b) => b !== a).map((b) => label(a, b)));
  const wrong: string[] = [];
  [label(bdr, dr), label(byRid[0], byRid[1]), label(byPriority[0], byPriority[1]), ...shuffleWith(r, pairs)].forEach((c) => {
    if (c !== right && !wrong.includes(c) && wrong.length < DISTRACTORS) wrong.push(c);
  });
  const zero = routers.filter((x) => x.priority === 0).map((x) => x.name);
  const zeroText =
    zero.length === 0
      ? ''
      : zero.length === 1
        ? `${t('quizGen.drBdr.explainZeroOne', { router: zero[0] })} `
        : `${t('quizGen.drBdr.explainZeroMany', { routers: zero.join(', ') })} `;
  const order = elected.map((x) => `${x.name} (${x.priority} / ${x.routerId})`).join(ORDER_SEPARATOR);
  const explanation = `${zeroText}${t('quizGen.drBdr.explainOrder', { order, dr: dr.name, bdr: bdr.name })}`;
  const widths = [COL_ROUTER, COL_RID];
  const code = [
    tableLine([t('quizGen.table.router'), t('quizGen.table.routerId'), t('quizGen.table.priority')], widths),
    ...routers.map((x) => tableLine([x.name, x.routerId, String(x.priority)], widths)),
  ].join('\n');
  return { ...choice(r, [right], wrong, t('quizGen.drBdr.prompt'), explanation), code };
};

// ---------------------------------------------------------------------------
// longestMatch: prefixo mais longo numa tabela de encaminhamento.
const NEXT_HOPS: readonly [string, string][] = [
  ['172.16.3.2', 'Serial0/0/0'],
  ['192.168.10.6', 'Serial0/0/1'],
  ['10.1.1.6', 'GigabitEthernet0/0/0'],
  ['10.1.1.13', 'GigabitEthernet0/0/1'],
  ['192.168.1.2', 'GigabitEthernet0/0'],
];
const LPM_ROUTES = 4;
const LPM_SECOND_10_MAX = 250;
const LPM_PREFIXES = [25, 26, 27, 28, 29];
const LPM_SUMMARY_PREFIX = 16;
const LPM_SUBNET_PREFIX = 24;
const LPM_SUMMARY_METRIC_MIN = 66;
const LPM_SUMMARY_METRIC_MAX = 200;
const LPM_METRIC_MIN = 2;
const LPM_METRIC_MAX = 130;
const LPM_DEFAULT_METRIC = 1;
const OSPF_AD = 110;
const DEFAULT_ROUTE = '0.0.0.0/0';
const DEFAULT_NETWORK = '0.0.0.0';
const CODE_OSPF = 'O   ';
const CODE_DEFAULT = 'O*E2';
const COL_ROUTE_PREFIX = 19;
// Caso do destino -> rota que ganha (indices de routes abaixo).
const LPM_CASES = 4;
const LPM_WINNER = [2, 1, 0, 3];
const MINUTES = 60;
const TIME_PAD = 2;

interface Route {
  prefix: string;
  hop: readonly [string, string];
  code: string;
  metric: number;
}

const genLongestMatch: Generator = (r, t) => {
  const a = pickOne(r, [PRIVATE_10, PRIVATE_172]);
  const b = a === PRIVATE_10 ? randInt(r, 0, LPM_SECOND_10_MAX) : randInt(r, PRIVATE_172_MIN, PRIVATE_172_MAX);
  const c = randInt(r, 0, OCTET_MAX);
  const prefix = pickOne(r, LPM_PREFIXES);
  const size = blockSize(prefix);
  const d0 = randInt(r, 0, OCTET_VALUES / size - 1) * size;
  const hops = shuffleWith(r, NEXT_HOPS).slice(0, LPM_ROUTES);
  const routes: Route[] = [
    { prefix: `${a}.${b}.0.0/${LPM_SUMMARY_PREFIX}`, hop: hops[0], code: CODE_OSPF, metric: randInt(r, LPM_SUMMARY_METRIC_MIN, LPM_SUMMARY_METRIC_MAX) },
    { prefix: `${a}.${b}.${c}.0/${LPM_SUBNET_PREFIX}`, hop: hops[1], code: CODE_OSPF, metric: randInt(r, LPM_METRIC_MIN, LPM_METRIC_MAX) },
    { prefix: `${a}.${b}.${c}.${d0}/${prefix}`, hop: hops[2], code: CODE_OSPF, metric: randInt(r, LPM_METRIC_MIN, LPM_METRIC_MAX) },
    { prefix: DEFAULT_ROUTE, hop: hops[3], code: CODE_DEFAULT, metric: LPM_DEFAULT_METRIC },
  ];
  const kind = randInt(r, 0, LPM_CASES - 1);
  let destination: string;
  if (kind === 0) destination = `${a}.${b}.${c}.${d0 + randInt(r, 1, size - 2)}`;
  else if (kind === 1) {
    let x: number;
    do {
      x = randInt(r, HOST_MIN, HOST_MAX);
    } while (x >= d0 && x < d0 + size);
    destination = `${a}.${b}.${c}.${x}`;
  } else if (kind === 2) {
    let y: number;
    do {
      y = randInt(r, 0, OCTET_MAX);
    } while (y === c);
    destination = `${a}.${b}.${y}.${randInt(r, HOST_MIN, HOST_MAX)}`;
  } else {
    let y: number;
    do {
      y = a === PRIVATE_10 ? randInt(r, 0, OCTET_MAX) : randInt(r, PRIVATE_172_MIN, PRIVATE_172_MAX);
    } while (y === b);
    destination = `${a}.${y}.${randInt(r, 0, OCTET_MAX)}.${randInt(r, HOST_MIN, HOST_MAX)}`;
  }
  const win = routes[LPM_WINNER[kind]];
  const time = () => `00:${String(randInt(r, 0, MINUTES - 1)).padStart(TIME_PAD, '0')}:${String(randInt(r, 0, MINUTES - 1)).padStart(TIME_PAD, '0')}`;
  const line = (x: Route) => `${x.code} ${x.prefix.padEnd(COL_ROUTE_PREFIX)}[${OSPF_AD}/${x.metric}] via ${x.hop[0]}, ${time()}, ${x.hop[1]}`;
  const code = [
    'R1# show ip route',
    `Gateway of last resort is ${routes[LPM_ROUTES - 1].hop[0]} to network ${DEFAULT_NETWORK}`,
    '',
    ...shuffleWith(r, routes.slice(0, LPM_ROUTES - 1)).map(line),
    line(routes[LPM_ROUTES - 1]),
  ].join('\n');
  const dest = ipToNumber(destination);
  const matches = routes.filter((x) => {
    const [net, len] = x.prefix.split('/');
    return networkOf(dest, Number(len)) === ipToNumber(net);
  });
  const option = (x: Route) => t('quizGen.longestMatch.option', { prefix: x.prefix, nextHop: x.hop[0] });
  const explanation = t('quizGen.longestMatch.explain', { matches: matches.map((x) => x.prefix).join(', '), prefix: win.prefix });
  const draft = choice(r, [option(win)], routes.filter((x) => x !== win).map(option), t('quizGen.longestMatch.prompt', { destination }), explanation);
  return { ...draft, code };
};

// ---------------------------------------------------------------------------
// subnetInfo: rede, broadcast, primeiro e ultimo host de um IP/prefixo (escrita).
const SUBNET_PREFIXES = [20, 21, 22, 23, 24, 24, 25, 26, 26, 27, 27, 28, 28, 29, 30];
const SUBNET_FIELDS = ['network', 'broadcast', 'first', 'last'] as const;

const genSubnetInfo: Generator = (r, t) => {
  const prefix = pickOne(r, SUBNET_PREFIXES);
  const size = blockSize(prefix);
  const network = networkOf(randomPrivate(r), prefix);
  const host = network + randInt(r, 1, size - 2);
  const field = pickOne(r, SUBNET_FIELDS);
  const values = { network, broadcast: network + size - 1, first: network + 1, last: network + size - 2 };
  const answer = numberToIp(values[field]);
  // Octeto interessante: onde a mascara deixa de ser 255; as redes andam em passos de `step`.
  const octet = Math.ceil(prefix / OCTET_BITS);
  const step = 2 ** (OCTET_BITS * octet - prefix);
  const mask = numberToIp(prefixMask(prefix));
  const address = numberToIp(host);
  const explanation = [
    t('quizGen.subnetInfo.explainAnd', { address, mask, prefix, network: numberToIp(network) }),
    t('quizGen.subnetInfo.explainStep', { octet, step }),
    t('quizGen.subnetInfo.explainRange', {
      size,
      broadcast: numberToIp(values.broadcast),
      first: numberToIp(values.first),
      last: numberToIp(values.last),
    }),
    t('quizGen.common.answer', { answer }),
  ].join(' ');
  const accepted = field === 'network' ? [answer, `${answer}/${prefix}`] : [answer];
  return typed(t(`quizGen.subnetInfo.prompt.${field}`, { address, prefix }), accepted, explanation);
};

// ---------------------------------------------------------------------------
// usableHosts: hosts num prefixo, ou o prefixo mais longo para N hosts (escrita).
const RESERVED_ADDRESSES = 2;
const HOSTS_PREFIX_MIN = 16;
const HOSTS_PREFIX_MAX = 30;
const HOST_BITS_MIN = 2;
const HOST_BITS_MAX = 12;
// Valores no limite (2^h - 2 e 2^(h-1) - 1) apanham quem esquece o "- 2".
const HOSTS_EDGE_CHANCE = 0.4;
const usable = (bits: number) => Math.max(0, 2 ** bits - RESERVED_ADDRESSES);
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
const groupThousands = (n: number) => String(n).replace(THOUSANDS, ',');

const genUsableHosts: Generator = (r, t) => {
  if (r() < HALF) {
    const prefix = randInt(r, HOSTS_PREFIX_MIN, HOSTS_PREFIX_MAX);
    const bits = IPV4_BITS - prefix;
    const hosts = usable(bits);
    return typed(
      t('quizGen.usableHosts.promptCount', { prefix }),
      [String(hosts), groupThousands(hosts)],
      t('quizGen.usableHosts.explainCount', { prefix, bits, hosts }),
    );
  }
  const bits = randInt(r, HOST_BITS_MIN, HOST_BITS_MAX);
  const low = Math.max(RESERVED_ADDRESSES, usable(bits - 1) + 1);
  const high = usable(bits);
  const hosts = r() < HOSTS_EDGE_CHANCE ? pickOne(r, [low, high]) : randInt(r, low, high);
  const prefix = IPV4_BITS - bits;
  const explanation = t('quizGen.usableHosts.explainPrefix', {
    hosts,
    bits,
    fit: high,
    fewer: bits - 1,
    small: usable(bits - 1),
    prefix,
    mask: numberToIp(prefixMask(prefix)),
  });
  return typed(t('quizGen.usableHosts.promptPrefix', { hosts }), prefixAnswers(prefix), explanation);
};

// ---------------------------------------------------------------------------
// summarize: rota sumario de 2..4 redes contiguas (escrita).
const SUMMARY_PREFIXES = [20, 22, 23, 24, 24, 24, 24, 25, 26];
const SUMMARY_COUNT_MIN = 2;
const SUMMARY_COUNT_MAX = 4;
// O sumario nunca fica mais de 4 bits acima das redes (evita /8 por atravessar 10.255 -> 11.0).
const SUMMARY_MAX_SPAN = 4;
const SUMMARY_ATTEMPTS = 100;
// Metade das vezes o inicio fica alinhado a um grupo de 4 (sumario "limpo").
const SUMMARY_ALIGNED_CHANCE = 0.5;
const SUMMARY_ALIGN_BITS = 2;

const genSummarize: Generator = (r, t) => {
  let prefix = SUMMARY_PREFIXES[0];
  let networks: number[] = [];
  let summary = { network: 0, prefix: 0 };
  for (let g = 0; g < SUMMARY_ATTEMPTS; g += 1) {
    prefix = pickOne(r, SUMMARY_PREFIXES);
    const count = randInt(r, SUMMARY_COUNT_MIN, SUMMARY_COUNT_MAX);
    const size = blockSize(prefix);
    const base = randomPrivate(r);
    const aligned = r() < SUMMARY_ALIGNED_CHANCE;
    const start = aligned ? networkOf(base, prefix - SUMMARY_ALIGN_BITS) : networkOf(base, prefix);
    networks = Array.from({ length: count }, (_, i) => start + i * size);
    summary = summarizeNetworks(networks, prefix);
    if (prefix - summary.prefix <= SUMMARY_MAX_SPAN) break;
  }
  const first = networks[0];
  const last = networks[networks.length - 1];
  const octet = Math.min(OCTET_COUNT - 1, Math.floor(summary.prefix / OCTET_BITS));
  const network = numberToIp(summary.network);
  const mask = numberToIp(prefixMask(summary.prefix));
  const extra = 2 ** (prefix - summary.prefix) - networks.length;
  const explanation = [
    t('quizGen.summarize.explain', {
      octet: octet + 1,
      firstBits: toBinaryOctet(octetAt(first, octet)),
      lastBits: toBinaryOctet(octetAt(last, octet)),
      first: numberToIp(first),
      last: numberToIp(last),
      prefix: summary.prefix,
      summary: `${network}/${summary.prefix}`,
      mask,
    }),
    ...(extra === 1 ? [t('quizGen.summarize.explainExtraOne', { prefix })] : []),
    ...(extra > 1 ? [t('quizGen.summarize.explainExtra', { count: extra, prefix })] : []),
  ].join(' ');
  const code = networks.map((n) => `${numberToIp(n)}/${prefix}`).join('\n');
  const accepted = [`${network}/${summary.prefix}`, `${network} /${summary.prefix}`, `${network} ${mask}`];
  return typed(t('quizGen.summarize.prompt'), accepted, explanation, code);
};

// ---------------------------------------------------------------------------
// binaryDecimal: octeto binario <-> decimal (escrita).
const PLACE_VALUES = Array.from({ length: OCTET_BITS }, (_, i) => 2 ** (OCTET_BITS - 1 - i));
// Octetos de mascara (0, 128, 192, ... 255) aparecem mais vezes: sao os que mais se usam.
const MASK_OCTETS = Array.from({ length: OCTET_BITS + 1 }, (_, i) => OCTET_VALUES - 2 ** (OCTET_BITS - i));
const MASK_OCTET_CHANCE = 0.3;
const NIBBLE = 4;
const PLUS = ' + ';

const genBinaryDecimal: Generator = (r, t) => {
  const value = r() < MASK_OCTET_CHANCE ? pickOne(r, MASK_OCTETS) : randInt(r, 0, OCTET_MAX);
  const binary = toBinaryOctet(value);
  const parts = PLACE_VALUES.filter((p) => (value & p) !== 0);
  const sum = parts.length > 0 ? parts.join(PLUS) : '0';
  if (r() < HALF) {
    return typed(t('quizGen.binaryDecimal.promptToDecimal', { binary }), [String(value)], t('quizGen.binaryDecimal.explainToDecimal', { sum, value }));
  }
  const accepted = [binary, `${binary.slice(0, NIBBLE)} ${binary.slice(NIBBLE)}`, value.toString(2)];
  return typed(t('quizGen.binaryDecimal.promptToBinary', { value }), accepted, t('quizGen.binaryDecimal.explainToBinary', { sum, value, binary }));
};

// ---------------------------------------------------------------------------
const GENERATORS: Record<GeneratorKind, Generator> = {
  wildcard: genWildcard,
  networkCmd: genNetworkCmd,
  networkMatch: genNetworkMatch,
  ospfCost: genOspfCost,
  spfPath: genSpfPath,
  routerId: genRouterId,
  drBdr: genDrBdr,
  longestMatch: genLongestMatch,
  subnetInfo: genSubnetInfo,
  usableHosts: genUsableHosts,
  summarize: genSummarize,
  binaryDecimal: genBinaryDecimal,
};

// Mesma (tipo, seed, lingua) -> mesma pergunta.
export function generateQuestion(kind: GeneratorKind, seed: number, t: Translate): GeneratedQuestion {
  const draft = GENERATORS[kind](mulberry32(seed), t);
  const id = generatedId(kind, seed);
  const question: QuizQuestion = {
    id,
    topic: t(`quizGen.${kind}.name`),
    kind: draft.kind,
    prompt: draft.prompt,
    code: draft.code ?? null,
    figure: draft.figure ? id : null,
    options: draft.options ?? [],
    answer: draft.answer ?? [],
    accepted: draft.accepted ?? [],
    items: [],
    left: [],
    right: [],
    pairs: [],
    explanation: draft.explanation,
    sources: [],
  };
  return { question, figure: draft.figure ?? null };
}
