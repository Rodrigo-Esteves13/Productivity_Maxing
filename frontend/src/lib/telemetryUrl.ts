// URL seguro para telemetria (web-vitals, crash reports): so o caminho, sem
// query nem hash, e sem os segmentos que sao segredos. O link de reset de
// password traz o token de recuperacao no hash (#access_token=...), e os links
// de partilha/pacotes trazem o token no proprio caminho - nada disso pode ir
// parar aos logs do servidor.
const SECRET_SEGMENT_PATTERNS: RegExp[] = [/^(\/shared\/)[^/]+/, /^(\/packs\/)[^/]+/];

export function telemetryUrl(location: Pick<Location, 'pathname'> = window.location): string {
  return SECRET_SEGMENT_PATTERNS.reduce(
    (path, pattern) => path.replace(pattern, '$1[redacted]'),
    location.pathname,
  );
}
