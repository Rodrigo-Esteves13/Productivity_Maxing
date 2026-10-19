// URLs vindos do browser (web-vitals, crash reports) antes de irem para os
// logs: so o caminho, sem query nem hash, e sem segmentos que sao segredos.
// O frontend ja limpa (lib/telemetryUrl.ts), mas um cliente antigo em cache
// ou um pedido forjado nao pode meter um token nos logs: o link de reset de
// password traz o token de recuperacao no hash, e /shared/:token e
// /packs/:code dao acesso a quem tem o link.
const CLIENT_SECRET_SEGMENTS: RegExp[] = [
  /^(\/shared\/)[^/]+/,
  /^(\/packs\/)[^/]+/,
];
// Base so para o parser aceitar caminhos relativos; nunca aparece no output.
const PARSE_BASE = 'http://client.invalid';

export function sanitizeClientUrl(raw: string): string {
  let pathname: string;
  try {
    pathname = new URL(raw, PARSE_BASE).pathname;
  } catch {
    return '[invalid url]';
  }
  return CLIENT_SECRET_SEGMENTS.reduce(
    (path, pattern) => path.replace(pattern, '$1[redacted]'),
    pathname,
  );
}
