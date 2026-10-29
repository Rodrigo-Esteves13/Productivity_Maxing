import { NotFoundException } from '@nestjs/common';
import { NotebookSocialHubService } from './notebook-social-hub.service';
import type { PrismaService } from '../prisma/prisma.service';

const entry = (id: string, title: string) => ({
  id,
  title,
  areaId: 'a1',
  area: { name: 'SO', colorHex: '#8b5cf6' },
});

const build = (overrides: Record<string, unknown> = {}) => {
  const db = {
    friendship: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'f1',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        decidedAt: new Date('2026-10-02T00:00:00Z'),
      }),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'friend', name: 'Ana', avatarUrl: null }),
    },
    notebookShareAccessRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    notebookViewGrant: { findUnique: jest.fn().mockResolvedValue(null) },
    notebookShare: { findMany: jest.fn().mockResolvedValue([]) },
    notebookChangeProposal: { groupBy: jest.fn().mockResolvedValue([]) },
    turma: {
      findMany: jest.fn().mockResolvedValue([{ id: 't1', name: 'LEI 3' }]),
    },
    ...overrides,
  };
  return {
    db,
    service: new NotebookSocialHubService(db as unknown as PrismaService),
  };
};

describe('NotebookSocialHubService.friendHub', () => {
  it('is a 404 for someone who is not your friend (or yourself)', async () => {
    const { service, db } = build();
    db.friendship.findFirst.mockResolvedValue(null);
    await expect(service.friendHub('me', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.friendHub('me', 'me')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('splits what each side shares and hides a refused notebook request', async () => {
    const { service, db } = build();
    db.notebookShareAccessRequest.findMany
      .mockResolvedValueOnce([
        {
          id: 'r1',
          status: 'PENDING',
          accessRole: 'EDITOR',
          invitedByOwner: true,
          notebookShare: { token: 't1', notebookEntry: entry('e1', 'Aula 1') },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'r2',
          status: 'APPROVED',
          accessRole: 'VIEWER',
          notebookShare: { notebookEntry: entry('e2', 'Resumo') },
        },
      ]);
    db.notebookViewGrant.findUnique
      .mockResolvedValueOnce({ status: 'DENIED', areaIds: ['a1'] })
      .mockResolvedValueOnce({ id: 'g1', status: 'APPROVED', areaIds: ['a1'] });

    const hub = await service.friendHub('me', 'friend');

    expect(hub.friend).toMatchObject({ userId: 'friend', name: 'Ana' });
    expect(hub.friend.since).toBe('2026-10-02T00:00:00.000Z');
    expect(hub.sharedWithMe).toEqual([
      expect.objectContaining({
        token: 't1',
        title: 'Aula 1',
        role: 'EDITOR',
        invited: true,
        requestId: 'r1',
      }),
    ]);
    expect(hub.sharedByMe).toEqual([
      expect.objectContaining({
        entryId: 'e2',
        requestId: 'r2',
        role: 'VIEWER',
        pending: false,
      }),
    ]);
    expect(hub.theirNotebook).toEqual({ status: 'PENDING', areaCount: 0 });
    expect(hub.myNotebook).toEqual({
      status: 'APPROVED',
      areaCount: 1,
      grantId: 'g1',
    });
  });
});

describe('NotebookSocialHubService.myShares', () => {
  it('counts people, pending requests, invites and proposals per note', async () => {
    const { service, db } = build();
    db.notebookShare.findMany.mockResolvedValue([
      {
        id: 's1',
        visibility: 'AUTHORIZED',
        createdAt: new Date('2026-10-10T00:00:00Z'),
        notebookEntryId: 'e1',
        notebookEntry: entry('e1', 'Aula 1'),
      },
    ]);
    db.notebookShareAccessRequest.groupBy.mockResolvedValue([
      {
        notebookShareId: 's1',
        status: 'APPROVED',
        invitedByOwner: true,
        _count: { _all: 2 },
      },
      {
        notebookShareId: 's1',
        status: 'APPROVED',
        invitedByOwner: false,
        _count: { _all: 1 },
      },
      {
        notebookShareId: 's1',
        status: 'PENDING',
        invitedByOwner: false,
        _count: { _all: 4 },
      },
      {
        notebookShareId: 's1',
        status: 'PENDING',
        invitedByOwner: true,
        _count: { _all: 1 },
      },
    ]);
    db.notebookChangeProposal.groupBy.mockResolvedValue([
      { notebookEntryId: 'e1', _count: { _all: 3 } },
    ]);

    const [share] = await service.myShares('me');

    expect(share).toMatchObject({
      entryId: 'e1',
      visibility: 'AUTHORIZED',
      peopleCount: 3,
      pendingRequests: 4,
      pendingInvites: 1,
      pendingProposals: 3,
    });
  });

  it('skips the counting queries when nothing is shared', async () => {
    const { service, db } = build();
    await expect(service.myShares('me')).resolves.toEqual([]);
    expect(db.notebookShareAccessRequest.groupBy).not.toHaveBeenCalled();
  });
});
