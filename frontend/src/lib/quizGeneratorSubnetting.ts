// Geradores de enderecamento: wildcard, comandos network, sub-redes, resumo e binario.

import { HALF, randInt, pickOne, shuffleWith } from './quizGeneratorRandom';
import {
  IPV4_BITS,
  OCTET_BITS,
  OCTET_COUNT,
  OCTET_VALUES,
  OCTET_MAX,
  numberToIp,
  prefixMask,
  prefixWildcard,
  blockSize,
  networkOf,
  matchesWildcard,
  octetAt,
  toBinaryOctet,
  randomPrivate,
  summarizeNetworks,
} from './quizGeneratorNet';
import { type Generator, choice, typed, prefixAnswers, cmd, networkCommand } from './quizGeneratorDraft';

// ---------------------------------------------------------------------------
// wildcard: wildcard <-> mascara/prefixo (escrita).
const WILDCARD_PREFIX_MIN = 16;
const WILDCARD_PREFIX_MAX = 30;
const WILDCARD_ASK_WILDCARD_CHANCE = 0.65;

export const genWildcard: Generator = (r, t) => {
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
export const DISTRACTORS = 3;
// Erros tipicos: sub-rede vizinha (1 ou 2 blocos ao lado) ou wildcard de um prefixo mais longo.
const NEIGHBOR_STEP = 1;
const FAR_STEP = 2;
const LONGER_ONE = 1;
const LONGER_TWO = 2;

export const genNetworkCmd: Generator = (r, t) => {
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

export const genNetworkMatch: Generator = (r, t) => {
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
// subnetInfo: rede, broadcast, primeiro e ultimo host de um IP/prefixo (escrita).
const SUBNET_PREFIXES = [20, 21, 22, 23, 24, 24, 25, 26, 26, 27, 27, 28, 28, 29, 30];
const SUBNET_FIELDS = ['network', 'broadcast', 'first', 'last'] as const;

export const genSubnetInfo: Generator = (r, t) => {
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

export const genUsableHosts: Generator = (r, t) => {
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

export const genSummarize: Generator = (r, t) => {
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

export const genBinaryDecimal: Generator = (r, t) => {
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
