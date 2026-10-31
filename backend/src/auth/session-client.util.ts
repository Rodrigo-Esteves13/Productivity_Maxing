import { isIP } from 'net';
import { USER_AGENT_MAX_LENGTH } from './session.constants';

// Quantos blocos do inicio de um IPv6 se mostram (/48 = 3 blocos de 16 bits:
// chega para "mesma rede/operador", nunca identifica a casa nem o aparelho).
const IPV6_KEPT_GROUPS = 3;
const IPV6_TOTAL_GROUPS = 8;
const IPV4_MAPPED_PREFIX = '::ffff:';
// Caracteres de controlo nunca vao para a BD nem para a lista de dispositivos.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function maskIpv4(ip: string): string {
  const octets = ip.split('.');
  return `${octets.slice(0, 3).join('.')}.x`;
}

// Expande "::" para os 8 blocos, para cortar sempre no mesmo sitio.
function expandIpv6(ip: string): string[] {
  const withoutZone = ip.split('%')[0];
  const [head, tail] = withoutZone.split('::');
  const headGroups = head ? head.split(':') : [];
  if (tail === undefined) return headGroups;
  const tailGroups = tail ? tail.split(':') : [];
  const missing = IPV6_TOTAL_GROUPS - headGroups.length - tailGroups.length;
  return [...headGroups, ...Array<string>(missing).fill('0'), ...tailGroups];
}

function maskIpv6(ip: string): string {
  const kept = expandIpv6(ip)
    .slice(0, IPV6_KEPT_GROUPS)
    .map((group) => group.toLowerCase().replace(/^0+(?=.)/, ''));
  return `${kept.join(':')}::x`;
}

/**
 * IP so com o inicio (IPv4 /24, IPv6 /48), para a lista de dispositivos
 * mostrar "de onde" sem guardar um dado pessoal completo. null se o valor
 * nao for um IP (ex: req.ip undefined atras de um proxy mal configurado).
 */
export function maskIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  const unmapped = trimmed.toLowerCase().startsWith(IPV4_MAPPED_PREFIX)
    ? trimmed.slice(IPV4_MAPPED_PREFIX.length)
    : trimmed;
  const version = isIP(unmapped);
  if (version === 4) return maskIpv4(unmapped);
  if (version === 6) return maskIpv6(unmapped);
  return null;
}

/** User-Agent sem caracteres de controlo e com tamanho maximo fixo. */
export function truncateUserAgent(
  userAgent: string | undefined | null,
): string | null {
  if (!userAgent) return null;
  const clean = userAgent.replace(CONTROL_CHARS, '').trim();
  return clean ? clean.slice(0, USER_AGENT_MAX_LENGTH) : null;
}
