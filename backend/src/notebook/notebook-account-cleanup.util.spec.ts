import { removeNotebookFilesOfDeletedUser } from './notebook-account-cleanup.util';

describe('removeNotebookFilesOfDeletedUser', () => {
  const setup = (photoCount: number, error: unknown = null) => {
    const prisma = {
      notebookPhoto: {
        findMany: jest.fn().mockResolvedValue(
          Array.from({ length: photoCount }, (_, i) => ({
            storagePath: `u1/p${i}.webp`,
          })),
        ),
      },
      notebookAttachment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ storagePath: 'u1/brief.pdf' }]),
      },
    };
    const remove = jest.fn().mockResolvedValue({ error });
    const from = jest.fn(() => ({ remove }));
    return { prisma, remove, from, storage: { storage: { from } } };
  };

  it('only looks at entries of the deleted user', async () => {
    const { prisma, storage } = setup(1);
    await removeNotebookFilesOfDeletedUser(
      prisma as never,
      storage as never,
      'u1',
    );
    expect(prisma.notebookPhoto.findMany).toHaveBeenCalledWith({
      where: { notebookEntry: { userId: 'u1' } },
      select: { storagePath: true },
    });
    expect(prisma.notebookAttachment.findMany).toHaveBeenCalledWith({
      where: { notebookEntry: { userId: 'u1' } },
      select: { storagePath: true },
    });
  });

  it('removes photos in batches and then attachments', async () => {
    const { prisma, storage, remove } = setup(501);
    await removeNotebookFilesOfDeletedUser(
      prisma as never,
      storage as never,
      'u1',
    );
    expect(remove).toHaveBeenCalledTimes(3);
    expect((remove.mock.calls[0] as string[][])[0]).toHaveLength(500);
    expect(remove.mock.calls[2]).toEqual([['u1/brief.pdf']]);
  });

  it('throws when storage fails so the account is not deleted', async () => {
    const { prisma, storage } = setup(1, new Error('storage down'));
    await expect(
      removeNotebookFilesOfDeletedUser(prisma as never, storage as never, 'u1'),
    ).rejects.toThrow('storage down');
  });
});
