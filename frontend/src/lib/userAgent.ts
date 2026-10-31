// Leitura simples do User-Agent para a pagina Devices ("Chrome em Windows").
// Nao precisa de ser perfeita, so de reconhecer os browsers e sistemas
// comuns; o que nao reconhece fica null e a pagina mostra "Unknown".

export type DeviceKind = 'desktop' | 'mobile' | 'tablet';

export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  kind: DeviceKind;
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

// iPadOS 13+ diz "Macintosh"; sem toque nao da para distinguir, fica macOS.
const SYSTEMS: { name: string; pattern: RegExp }[] = [
  { name: 'iPadOS', pattern: /iPad/ },
  { name: 'iOS', pattern: /iPhone|iPod/ },
  { name: 'Android', pattern: /Android/ },
  { name: 'Windows', pattern: /Windows/ },
  { name: 'ChromeOS', pattern: /CrOS/ },
  { name: 'macOS', pattern: /Mac OS X|Macintosh/ },
  { name: 'Linux', pattern: /Linux/ },
];

const TABLET_PATTERN = /iPad|Tablet|Android(?!.*Mobile)/;
const MOBILE_PATTERN = /Mobi|iPhone|iPod|Android.*Mobile/;

function firstMatch(list: { name: string; pattern: RegExp }[], ua: string): string | null {
  return list.find((entry) => entry.pattern.test(ua))?.name ?? null;
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = userAgent ?? '';
  const kind: DeviceKind = TABLET_PATTERN.test(ua) ? 'tablet' : MOBILE_PATTERN.test(ua) ? 'mobile' : 'desktop';
  return { browser: firstMatch(BROWSERS, ua), os: firstMatch(SYSTEMS, ua), kind };
}
