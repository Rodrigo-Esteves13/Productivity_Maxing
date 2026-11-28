// Calculo IPv4 e OSPF.

import type { Rand } from './quizGeneratorIds';
import { UINT32_RANGE, randInt } from './quizGeneratorRandom';

// ---------------------------------------------------------------------------
// IPv4 como numeros sem sinal (0..2^32-1).
export const IPV4_BITS = 32;
export const OCTET_BITS = 8;
export const OCTET_COUNT = 4;
export const OCTET_VALUES = 256;
export const OCTET_MAX = OCTET_VALUES - 1;
const ALL_ONES = UINT32_RANGE - 1;
// Bases privadas (RFC 1918).
export const PRIVATE_10 = 10;
export const PRIVATE_172 = 172;
export const PRIVATE_172_MIN = 16;
export const PRIVATE_172_MAX = 31;
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
export const octetAt = (ip: number, index: number) => (ip >>> (OCTET_BITS * (OCTET_COUNT - 1 - index))) & OCTET_MAX;
export const toBinaryOctet = (value: number): string => value.toString(2).padStart(OCTET_BITS, '0');

// Endereco privado aleatorio (10/8, 172.16/12 ou 192.168/16).
export function randomPrivate(r: Rand): number {
  const kind = randInt(r, 0, PRIVATE_KINDS - 1);
  const any = () => randInt(r, 0, OCTET_MAX);
  if (kind === 0) return ipToNumber(`${PRIVATE_10}.${any()}.${any()}.${any()}`);
  if (kind === 1) return ipToNumber(`${PRIVATE_172}.${randInt(r, PRIVATE_172_MIN, PRIVATE_172_MAX)}.${any()}.${any()}`);
  return ipToNumber(`${PRIVATE_192}.${PRIVATE_168}.${any()}.${any()}`);
}

// Custo OSPF: referencia / largura de banda, parte inteira, no minimo 1.
export const OSPF_COST_MIN = 1;
export const OSPF_COST_MAX = 65535;
export const KBPS_PER_MBPS = 1000;
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
