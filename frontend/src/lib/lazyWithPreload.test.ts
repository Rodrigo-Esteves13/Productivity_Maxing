import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadFullForActiveLanguage = vi.fn<() => Promise<void>>();
vi.mock('../i18n/dictionaries', () => ({ loadFullForActiveLanguage: () => loadFullForActiveLanguage() }));

const { lazyWithPreload } = await import('./lazyWithPreload');

const Component = () => null;

describe('lazyWithPreload', () => {
  beforeEach(() => loadFullForActiveLanguage.mockReset());

  it('so resolve depois de o dicionario inteiro chegar', async () => {
    let finishDictionary!: () => void;
    loadFullForActiveLanguage.mockReturnValue(new Promise<void>((resolve) => (finishDictionary = resolve)));
    const factory = vi.fn(() => Promise.resolve({ default: Component }));
    const page = lazyWithPreload(factory);
    let resolved = false;
    const preload = page.preload().then(() => (resolved = true));
    await Promise.resolve();
    await Promise.resolve();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);
    finishDictionary();
    await preload;
    expect(resolved).toBe(true);
  });

  it('varias chamadas fazem um so pedido', async () => {
    loadFullForActiveLanguage.mockResolvedValue(undefined);
    const factory = vi.fn(() => Promise.resolve({ default: Component }));
    const page = lazyWithPreload(factory);
    await Promise.all([page.preload(), page.preload()]);
    await page.preload();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('se o dicionario falhar, rejeita e a proxima tentativa volta a pedir', async () => {
    loadFullForActiveLanguage.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const factory = vi.fn(() => Promise.resolve({ default: Component }));
    const page = lazyWithPreload(factory);
    await expect(page.preload()).rejects.toThrow('offline');
    await expect(page.preload()).resolves.toEqual({ default: Component });
    expect(loadFullForActiveLanguage).toHaveBeenCalledTimes(2);
  });
});
