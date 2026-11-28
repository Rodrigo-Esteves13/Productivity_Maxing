import { describe, expect, it, vi } from 'vitest';
import { createDictionaryStore, type Dictionary, type SplitLoaders } from './dictionaries';
import { LANGUAGES, type LanguageCode } from './languages';

type Parts = Partial<Record<LanguageCode, { core?: Dictionary; rest?: Dictionary }>>;

// Loaders falsos: devolvem o que estiver em `parts`; `failing` rejeita.
function fakeLoaders(parts: Parts, failing: Set<string> = new Set()) {
  const calls: string[] = [];
  const build = (part: 'core' | 'rest') =>
    Object.fromEntries(
      LANGUAGES.map(({ code }) => [
        code,
        () => {
          calls.push(`${code}.${part}`);
          if (failing.has(`${code}.${part}`)) return Promise.reject(new Error('offline'));
          return Promise.resolve(parts[code]?.[part] ?? {});
        },
      ]),
    ) as SplitLoaders['core'];
  return { loaders: { core: build('core'), rest: build('rest') }, calls };
}

describe('createDictionaryStore', () => {
  it('com so o nucleo: traduz as chaves dele; o resto cai no ingles e depois na chave', async () => {
    const { loaders } = fakeLoaders({ pt: { core: { 'a.core': 'Nucleo' }, rest: { 'a.rest': 'Resto' } } });
    const store = createDictionaryStore(loaders);
    await store.loadCore('pt');
    expect(store.isCoreLoaded('pt')).toBe(true);
    expect(store.isFullLoaded('pt')).toBe(false);
    expect(store.translateIn('pt', 'a.core')).toBe('Nucleo');
    expect(store.translateIn('pt', 'a.rest')).toBe('a.rest');
    expect(store.translateIn('pt', 'common.reload')).toBe('Reload');
  });

  it('loadFull junta nucleo e resto, e avisa os subscritores a cada parte', async () => {
    const { loaders } = fakeLoaders({ pt: { core: { 'a.core': 'Nucleo' }, rest: { 'a.rest': 'Ola {name}' } } });
    const store = createDictionaryStore(loaders);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getVersion();
    await store.loadFull('pt');
    expect(store.isFullLoaded('pt')).toBe(true);
    expect(store.translateIn('pt', 'a.core')).toBe('Nucleo');
    expect(store.translateIn('pt', 'a.rest', { name: 'Ana' })).toBe('Ola Ana');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getVersion()).toBe(before + 2);
  });

  it('pede cada parte uma so vez, mesmo com chamadas em paralelo', async () => {
    const { loaders, calls } = fakeLoaders({ pt: { core: {}, rest: {} } });
    const store = createDictionaryStore(loaders);
    await Promise.all([store.loadCore('pt'), store.loadFull('pt'), store.loadFull('pt')]);
    await store.loadFull('pt');
    expect(calls.sort()).toEqual(['pt.core', 'pt.rest']);
  });

  it('se o resto falhar, rejeita e a proxima chamada volta a pedi-lo', async () => {
    const failing = new Set(['pt.rest']);
    const { loaders, calls } = fakeLoaders({ pt: { core: { k: 'v' }, rest: { r: 'R' } } }, failing);
    const store = createDictionaryStore(loaders);
    await expect(store.loadFull('pt')).rejects.toThrow('offline');
    expect(store.isCoreLoaded('pt')).toBe(true);
    failing.clear();
    await store.loadFull('pt');
    expect(store.translateIn('pt', 'r')).toBe('R');
    expect(calls.filter((c) => c === 'pt.rest')).toHaveLength(2);
    expect(calls.filter((c) => c === 'pt.core')).toHaveLength(1);
  });

  it('chave em falta na lingua usa o ingles se estiver carregado', async () => {
    const { loaders } = fakeLoaders({ pt: { core: {} }, en: { core: { k: 'English' } } });
    const store = createDictionaryStore(loaders);
    await Promise.all([store.loadCore('pt'), store.loadCore('en')]);
    expect(store.translateIn('pt', 'k')).toBe('English');
  });
});
