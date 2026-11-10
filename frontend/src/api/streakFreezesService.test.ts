import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('./client', () => ({ default: client }));

import { createStreakFreeze, deleteStreakFreeze, getStreakFreezeStatus } from './streakFreezesService';

describe('streakFreezesService', () => {
  beforeEach(() => {
    client.get.mockReset().mockResolvedValue({ data: { todayKey: '2026-11-10' } });
    client.post.mockReset().mockResolvedValue({ data: { id: 'f1' } });
    client.delete.mockReset().mockResolvedValue({ data: undefined });
  });

  it('loads the status', async () => {
    expect(await getStreakFreezeStatus()).toEqual({ todayKey: '2026-11-10' });
    expect(client.get).toHaveBeenCalledWith('/streak-freezes');
  });

  it('claims today with an empty body and a given day with dateKey', async () => {
    await createStreakFreeze();
    expect(client.post).toHaveBeenLastCalledWith('/streak-freezes', {});
    await createStreakFreeze('2026-11-09');
    expect(client.post).toHaveBeenLastCalledWith('/streak-freezes', { dateKey: '2026-11-09' });
  });

  it('undoes by id', async () => {
    await deleteStreakFreeze('f1');
    expect(client.delete).toHaveBeenCalledWith('/streak-freezes/f1');
  });
});
