// Silent-bug audit (area b) - repro test. FAILS while the bug exists.
import { AreasService } from './areas.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

describe('silent-audit b: AreasService.remove', () => {
  it('B-04: refuses to delete an area that still has notebook entries / grade components (they cascade)', async () => {
    const prisma = {
      area: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', ownerId: 'u1' }),
        delete: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
      task: { count: jest.fn().mockResolvedValue(0) },
      // NotebookEntry.area and GradeComponent.area are onDelete: Cascade in
      // schema.prisma - deleting the area silently deletes these rows.
      notebookEntry: { count: jest.fn().mockResolvedValue(12) },
      gradeComponent: { count: jest.fn().mockResolvedValue(3) },
    };
    const service = new AreasService(prisma as unknown as PrismaService);
    const user = { id: 'u1', role: 'USER' } as AuthenticatedUser;

    await expect(service.remove(user, 'a1')).rejects.toThrow();
    expect(prisma.area.delete).not.toHaveBeenCalled();
  });
});
