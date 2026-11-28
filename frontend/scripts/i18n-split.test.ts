import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  computeCoreKeys,
  listLanguages,
  readDictionary,
  scanCoreZone,
  splitDictionary,
  unreviewedIndirectCalls,
  type CoreZoneScan,
} from './i18n-split.ts';

const LANGS = listLanguages();
// Importar as 8 linguas (centenas de ficheiros) demora com a suite toda a correr.
const IMPORT_ALL_LANGS_TIMEOUT_MS = 60_000;

describe('readDictionary', () => {
  it('le cada lingua igual ao dicionario que a app importa (chaves, textos e ordem)', async () => {
    expect(LANGS).toHaveLength(8);
    for (const lang of LANGS) {
      const runtime = ((await import(`../src/i18n/messages/${lang}/index.ts`)) as Record<string, Record<string, string>>)[lang];
      const parsed = readDictionary(lang);
      expect([...parsed.keys()], lang).toEqual(Object.keys(runtime));
      expect(Object.fromEntries(parsed), lang).toEqual(runtime);
    }
  }, IMPORT_ALL_LANGS_TIMEOUT_MS);
});

describe('scanCoreZone (codigo real)', () => {
  const scan = scanCoreZone();
  const enKeys = [...readDictionary('en').keys()];
  const core = computeCoreKeys(enKeys, scan);

  it('todas as chamadas t(variavel) do codigo de arranque estao revistas', () => {
    expect(unreviewedIndirectCalls(scan)).toEqual([]);
  });

  it('inclui o login e deixa de fora as paginas lazyWithPreload', () => {
    expect(scan.files).toContain('pages/Login.tsx');
    expect(scan.files).toContain('i18n/I18nProvider.tsx');
    expect(scan.files).not.toContain('pages/Dashboard.tsx');
    expect(scan.files).not.toContain('pages/Finance.tsx');
    expect(scan.files.some((file) => file.startsWith('i18n/messages/'))).toBe(false);
  });

  it('o nucleo tem as chaves do login e nao as de paginas lazy', () => {
    expect(core.has('auth.loginTitle')).toBe(true);
    expect(core.has('common.error.title')).toBe(true);
    expect(core.has('ux4fin.deleteAccountConfirm')).toBe(false);
    expect(core.size).toBeLessThan(enKeys.length / 2);
  });

  it('nucleo + resto = dicionario inteiro, sem repetir chaves, em todas as linguas', () => {
    for (const lang of LANGS) {
      const dict = readDictionary(lang);
      const corePart = splitDictionary(dict, core, 'core');
      const restPart = splitDictionary(dict, core, 'rest');
      expect(Object.keys(corePart).filter((key) => key in restPart), lang).toEqual([]);
      expect({ ...corePart, ...restPart }, lang).toEqual(Object.fromEntries(dict));
    }
  });
});

describe('computeCoreKeys', () => {
  const keys = ['auth.title', 'auth.body', 'nav.home', 'nav.tasks', 'badges.streak.one', 'badges.streak.two', 'other.x'];
  const scanOf = (strings: string[], prefixes: string[] = []): CoreZoneScan => ({
    files: [],
    strings: new Set(strings),
    prefixes: new Set(prefixes),
    indirectCalls: [],
  });

  it('literal exato, literal com ponto como prefixo e template com prefixo', () => {
    const core = computeCoreKeys(keys, scanOf(['auth.title', 'nav.', 'irrelevante'], ['badges.streak.']));
    expect([...core].sort()).toEqual(['auth.title', 'badges.streak.one', 'badges.streak.two', 'nav.home', 'nav.tasks']);
  });

  it('literal sem ponto nao puxa chaves por prefixo', () => {
    expect([...computeCoreKeys(keys, scanOf(['nav', 'auth']))]).toEqual([]);
  });
});

describe('scanCoreZone (grafo de imports)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'i18n-split-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const write = (name: string, code: string) => writeFileSync(join(dir, name), code);

  write(
    'main.tsx',
    [
      "import { a } from './a';",
      "import type { D } from './d';",
      "const lazyWithPreload = (f: () => unknown) => f;",
      "export const Page = lazyWithPreload(() => import('./gated'));",
      "export const later = () => import('./dynamic');",
      "declare const t: (k: string) => string; declare const k: string; declare const n: number;",
      "export const x = [t('lit.key'), t(`tpl.${n}`), t(n ? 'a.b' : 'c.d'), t(k), t(`${k}.title`)];",
      'export type { D };',
      'export { a };',
    ].join('\n'),
  );
  write('a.ts', "export const a = 'from.a';");
  write('d.ts', "export type D = 'from.d';");
  write('gated.tsx', "export default 'from.gated';");
  write('dynamic.ts', "export default 'from.dynamic';");

  const scan = scanCoreZone(join(dir, 'main.tsx'));
  const files = scan.files.map((file) => file.split('/').pop());

  it('segue imports estaticos e import() normais, nao os de lazyWithPreload nem os so de tipos', () => {
    expect(files.sort()).toEqual(['a.ts', 'dynamic.ts', 'main.tsx']);
    expect(scan.strings.has('from.a')).toBe(true);
    expect(scan.strings.has('from.dynamic')).toBe(true);
    expect(scan.strings.has('from.gated')).toBe(false);
    expect(scan.strings.has('from.d')).toBe(false);
  });

  it('marca t(variavel) e templates sem prefixo; aceita literais, prefixos e ternarios', () => {
    expect(scan.prefixes.has('tpl.')).toBe(true);
    expect(scan.indirectCalls.map((call) => call.split(': ').pop())).toEqual(['k', '`${k}.title`']);
  });
});
