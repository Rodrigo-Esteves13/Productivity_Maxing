// Geradores OSPF: custo, router ID, DR/BDR e correspondencia mais longa.

import type { Rand } from './quizGeneratorIds';
import { randInt, pickOne, shuffleWith } from './quizGeneratorRandom';
import {
  OCTET_COUNT,
  OCTET_VALUES,
  OCTET_MAX,
  PRIVATE_10,
  PRIVATE_172,
  PRIVATE_172_MIN,
  PRIVATE_172_MAX,
  ipToNumber,
  blockSize,
  networkOf,
  KBPS_PER_MBPS,
  ospfCost,
  type DrCandidate,
  electDrBdr,
} from './quizGeneratorNet';
import { type Generator, choice, typed } from './quizGeneratorDraft';
import { DISTRACTORS } from './quizGeneratorSubnetting';

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

export const genOspfCost: Generator = (r, t) => {
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

export const genRouterId: Generator = (r, t) => {
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

export const genDrBdr: Generator = (r, t) => {
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

export const genLongestMatch: Generator = (r, t) => {
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
