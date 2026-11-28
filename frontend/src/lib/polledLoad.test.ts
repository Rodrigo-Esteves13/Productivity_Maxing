import { describe, expect, it, vi } from 'vitest';
import { runPolledAction, runPolledLoad } from './polledLoad';

const sink = () => ({ setData: vi.fn(), setIsLoading: vi.fn(), setHasError: vi.fn() });

describe('runPolledLoad', () => {
  it('shows loading and applies the data on a visible load', async () => {
    const s = sink();
    await runPolledLoad(async () => 1, false, s);
    expect(s.setIsLoading.mock.calls).toEqual([[true], [false]]);
    expect(s.setData).toHaveBeenCalledWith(1);
    expect(s.setHasError).toHaveBeenCalledWith(false);
  });

  it('reports the error of a visible load', async () => {
    const s = sink();
    await runPolledLoad(() => Promise.reject(new Error('x')), false, s);
    expect(s.setHasError).toHaveBeenCalledWith(true);
    expect(s.setData).not.toHaveBeenCalled();
    expect(s.setIsLoading).toHaveBeenLastCalledWith(false);
  });

  it('keeps what is on screen when a silent load fails', async () => {
    const s = sink();
    await runPolledLoad(() => Promise.reject(new Error('x')), true, s);
    expect(s.setData).not.toHaveBeenCalled();
    expect(s.setIsLoading).not.toHaveBeenCalled();
    expect(s.setHasError).not.toHaveBeenCalled();
  });

  it('clears the error when a silent load succeeds', async () => {
    const s = sink();
    await runPolledLoad(async () => 2, true, s);
    expect(s.setHasError).toHaveBeenCalledWith(false);
    expect(s.setIsLoading).not.toHaveBeenCalled();
  });
});

describe('runPolledAction', () => {
  const hooks = () => ({ onChanged: vi.fn(), reload: vi.fn().mockResolvedValue(undefined), onError: vi.fn() });

  it('announces the change and reloads after a successful write', async () => {
    const h = hooks();
    await expect(runPolledAction(async () => undefined, h)).resolves.toBe(true);
    expect(h.onChanged).toHaveBeenCalledTimes(1);
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('only reports the error when the write fails', async () => {
    const h = hooks();
    await expect(runPolledAction(() => Promise.reject(new Error('x')), h)).resolves.toBe(false);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onChanged).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
  });
});
