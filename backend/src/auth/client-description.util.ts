// Leitura simples do User-Agent para descrever um dispositivo ("Chrome on
// Windows") no alerta de novo dispositivo. Espelha o parser do frontend
// (lib/userAgent.ts). Nao precisa de ser perfeita: o que nao reconhece fica
// 'Unknown', e dois UAs da mesma familia (so muda a versao) contam como o
// mesmo dispositivo.

export const UNKNOWN_CLIENT_LABEL = 'Unknown';

export interface ClientDescription {
  browser: string;
  os: string;
}

// Ordem importa: Edge e Opera tambem dizem "Chrome", e o Chrome diz "Safari".
const BROWSERS: { name: string; pattern: RegExp }[] = [
  { name: 'Edge', pattern: /Edg(e|A|iOS)?\// },
  { name: 'Opera', pattern: /(OPR|Opera)\// },
  { name: 'Samsung Internet', pattern: /SamsungBrowser\// },
  { name: 'Firefox', pattern: /(Firefox|FxiOS)\// },
  { name: 'Chrome', pattern: /(Chrome|CriOS)\// },
  { name: 'Safari', pattern: /Version\/[\d.]+.*Safari\// },
];

const SYSTEMS: { name: string; pattern: RegExp }[] = [
  { name: 'iPadOS', pattern: /iPad/ },
  { name: 'iOS', pattern: /iPhone|iPod/ },
  { name: 'Android', pattern: /Android/ },
  { name: 'Windows', pattern: /Windows/ },
  { name: 'ChromeOS', pattern: /CrOS/ },
  { name: 'macOS', pattern: /Mac OS X|Macintosh/ },
  { name: 'Linux', pattern: /Linux/ },
];

function firstMatch(
  list: { name: string; pattern: RegExp }[],
  userAgent: string,
): string {
  return (
    list.find((entry) => entry.pattern.test(userAgent))?.name ??
    UNKNOWN_CLIENT_LABEL
  );
}

export function describeClient(
  userAgent: string | null | undefined,
): ClientDescription {
  const ua = userAgent ?? '';
  return {
    browser: firstMatch(BROWSERS, ua),
    os: firstMatch(SYSTEMS, ua),
  };
}
