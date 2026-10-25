jest.mock('./grade-projection.service', () => ({
  GradeProjectionService: class {},
}));
import { PlanScenarioService } from './plan-scenario.service';

describe('PlanScenarioService (posse)', () => {
  const prisma = {
    user: { findUniqueOrThrow: jest.fn() },
    task: { findMany: jest.fn().mockResolvedValue([]) },
    gradeComponent: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const projection = { project: jest.fn().mockResolvedValue({ tasks: [] }) };
  const service = new PlanScenarioService(prisma as never, projection as never);

  it('so le tasks e componentes do proprio user no periodo ativo dele', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      activePeriod: {
        id: 'p1',
        isArchived: false,
        program: { gradeScale: '0-20' },
      },
    });
    await service.build('u1');
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
    const [taskQuery] = prisma.task.findMany.mock.calls[0] as [
      { where: { userId: string; periodId: string } },
    ];
    expect(taskQuery.where).toMatchObject({ userId: 'u1', periodId: 'p1' });
    expect(prisma.gradeComponent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', periodId: 'p1' } }),
    );
  });

  it('periodo arquivado ou sem periodo devolve vazio sem consultar tasks', async () => {
    prisma.task.findMany.mockClear();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ activePeriod: null });
    const result = await service.build('u1');
    expect(result.courses).toEqual([]);
    expect(result.passThreshold).toBe(10);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});
