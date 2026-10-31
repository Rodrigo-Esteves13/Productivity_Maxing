// O backend guarda o IP so com o inicio (IPv4 "a.b.c.x", IPv6 "a:b:c::x").
// O loopback aparece em dev/proxy local como "127.0.0.x" (IPv4) ou "0:0:0::x"
// (::1). Mostra-se sempre "localhost" (nome tecnico, igual em todos os
// idiomas, por isso sem chave i18n). Qualquer outro valor segue como veio:
// nunca se reconstroi nem se alarga um IP.
const LOOPBACK_V4_MASKED = /^127\.\d{1,3}\.\d{1,3}\.x$/;
const LOOPBACK_V6_MASKED = '0:0:0::x';
export const LOOPBACK_LABEL = 'localhost';

export function displayMaskedIp(masked: string): string {
  return LOOPBACK_V4_MASKED.test(masked) || masked === LOOPBACK_V6_MASKED ? LOOPBACK_LABEL : masked;
}
