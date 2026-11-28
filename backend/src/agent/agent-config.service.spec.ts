jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../push/push.service', () => ({ PushService: jest.fn() }));
import { AgentConfigService } from './agent-config.service';

const USER = 'user-1';

function setup() {
  const prisma = {
    agentConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const study = { getActive: jest.fn() };
  const service = new AgentConfigService(prisma as never, study as never);
  return { service, prisma, study };
}

const ROW = {
  id: 'c1',
  userId: USER,
  createdAt: new Date(),
  updatedAt: new Date(),
  triggerMode: 'ALL',
  blockedDomains: ['x.com'],
};

describe('AgentConfigService', () => {
  it('find without config returns defaults, unconfigured, and does not write', async () => {
    const { service, prisma } = setup();
    prisma.agentConfig.findUnique.mockResolvedValue(null);
    const result = await service.find(USER);
    expect(prisma.agentConfig.findUnique).toHaveBeenCalledWith({
      where: { userId: USER },
    });
    expect(prisma.agentConfig.upsert).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        isConfigured: false,
        pollIntervalSeconds: 60,
        blockedProcesses: [],
      }),
    );
  });

  // Regressao: DEFAULTS partilhava arrays entre pedidos.
  it('defaults are not shared between calls (no mutation leak)', async () => {
    const { service, prisma } = setup();
    prisma.agentConfig.findUnique.mockResolvedValue(null);
    const a = (await service.find(USER)) as unknown as {
      blockedDomains: string[];
      blockedProcesses: string[];
    };
    a.blockedDomains.push('evil.com');
    a.blockedProcesses.push('evil.exe');
    const b = (await service.find(USER)) as unknown as typeof a;
    expect(b.blockedDomains).toEqual([]);
    expect(b.blockedProcesses).toEqual([]);
  });

  it('find with config strips internal fields', async () => {
    const { service, prisma } = setup();
    prisma.agentConfig.findUnique.mockResolvedValue(ROW);
    const result = await service.find(USER);
    expect(result).toEqual({
      triggerMode: 'ALL',
      blockedDomains: ['x.com'],
      isConfigured: true,
    });
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('id');
  });

  it('upsert is keyed by caller userId and strips internal fields', async () => {
    const { service, prisma } = setup();
    prisma.agentConfig.upsert.mockResolvedValue(ROW);
    const dto = { triggerMode: 'ALL' } as never;
    const result = await service.upsert(USER, dto);
    expect(prisma.agentConfig.upsert).toHaveBeenCalledWith({
      where: { userId: USER },
      create: { userId: USER, triggerMode: 'ALL' },
      update: { triggerMode: 'ALL' },
    });
    expect(result).not.toHaveProperty('userId');
    expect(result.isConfigured).toBe(true);
  });

  it('focusState reflects an active session', async () => {
    const { service, study } = setup();
    study.getActive.mockResolvedValueOnce({ id: 's' });
    await expect(service.focusState(USER)).resolves.toEqual({ active: true });
    expect(study.getActive).toHaveBeenCalledWith(USER);
    study.getActive.mockResolvedValueOnce(null);
    await expect(service.focusState(USER)).resolves.toEqual({ active: false });
  });

  it('db errors propagate', async () => {
    const { service, prisma } = setup();
    prisma.agentConfig.findUnique.mockRejectedValue(new Error('db'));
    await expect(service.find(USER)).rejects.toThrow('db');
  });
});
