import { ConflictException, NotFoundException } from '@nestjs/common';
import { BannedIpsService } from './banned-ips.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateBannedIpDto } from './dto/create-banned-ip.dto';

function setup(initial: { ip: string }[] = []) {
  const bannedIp = {
    findMany: jest.fn().mockResolvedValue(initial),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BannedIpsService({
    bannedIp,
  } as unknown as PrismaService);
  return { service, bannedIp };
}

const dtoFor = (ip: string, reason?: string) =>
  ({ ip, reason }) as unknown as CreateBannedIpDto;

describe('BannedIpsService', () => {
  it('cache starts empty before onModuleInit', () => {
    const { service } = setup([{ ip: '1.1.1.1' }]);
    expect(service.isBanned('1.1.1.1')).toBe(false);
  });

  it('onModuleInit loads banned ips from the DB', async () => {
    const { service, bannedIp } = setup([{ ip: '1.1.1.1' }, { ip: '2.2.2.2' }]);
    await service.onModuleInit();
    expect(bannedIp.findMany).toHaveBeenCalledWith({ select: { ip: true } });
    expect(service.isBanned('1.1.1.1')).toBe(true);
    expect(service.isBanned('2.2.2.2')).toBe(true);
    expect(service.isBanned('3.3.3.3')).toBe(false);
  });

  it('onModuleInit replaces a stale cache (invalidation on reload)', async () => {
    const { service, bannedIp } = setup([{ ip: '1.1.1.1' }]);
    await service.onModuleInit();
    bannedIp.findMany.mockResolvedValue([{ ip: '9.9.9.9' }]);
    await service.onModuleInit();
    expect(service.isBanned('1.1.1.1')).toBe(false);
    expect(service.isBanned('9.9.9.9')).toBe(true);
  });

  it('ban stores the admin id and blocks immediately', async () => {
    const { service, bannedIp } = setup();
    bannedIp.create.mockResolvedValue({ id: 'b1', ip: '4.4.4.4' });
    const row = await service.ban('admin1', dtoFor('4.4.4.4', 'abuse'));
    expect(bannedIp.create).toHaveBeenCalledWith({
      data: { ip: '4.4.4.4', reason: 'abuse', bannedByUserId: 'admin1' },
    });
    expect(row).toEqual({ id: 'b1', ip: '4.4.4.4' });
    expect(service.isBanned('4.4.4.4')).toBe(true);
  });

  it('ban of an already banned ip: Conflict, no create, cache untouched', async () => {
    const { service, bannedIp } = setup();
    bannedIp.findUnique.mockResolvedValue({ id: 'b1', ip: '4.4.4.4' });
    await expect(
      service.ban('admin1', dtoFor('4.4.4.4')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(bannedIp.create).not.toHaveBeenCalled();
    expect(service.isBanned('4.4.4.4')).toBe(false);
  });

  it('failed create does not poison the cache', async () => {
    const { service, bannedIp } = setup();
    bannedIp.create.mockRejectedValue(new Error('db down'));
    await expect(service.ban('admin1', dtoFor('5.5.5.5'))).rejects.toThrow(
      'db down',
    );
    expect(service.isBanned('5.5.5.5')).toBe(false);
  });

  it('unban removes from DB and cache', async () => {
    const { service, bannedIp } = setup();
    bannedIp.create.mockResolvedValue({ id: 'b1', ip: '6.6.6.6' });
    await service.ban('admin1', dtoFor('6.6.6.6'));
    bannedIp.findUnique.mockResolvedValue({ id: 'b1', ip: '6.6.6.6' });
    await expect(service.unban('b1')).resolves.toEqual({ unbanned: '6.6.6.6' });
    expect(bannedIp.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    expect(service.isBanned('6.6.6.6')).toBe(false);
  });

  it('unban unknown id: NotFound, no delete', async () => {
    const { service, bannedIp } = setup();
    await expect(service.unban('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(bannedIp.delete).not.toHaveBeenCalled();
  });

  it('unban keeps other banned ips', async () => {
    const { service, bannedIp } = setup([{ ip: '1.1.1.1' }, { ip: '2.2.2.2' }]);
    await service.onModuleInit();
    bannedIp.findUnique.mockResolvedValue({ id: 'b1', ip: '1.1.1.1' });
    await service.unban('b1');
    expect(service.isBanned('2.2.2.2')).toBe(true);
  });

  it('failed delete keeps the ip blocked', async () => {
    const { service, bannedIp } = setup([{ ip: '1.1.1.1' }]);
    await service.onModuleInit();
    bannedIp.findUnique.mockResolvedValue({ id: 'b1', ip: '1.1.1.1' });
    bannedIp.delete.mockRejectedValue(new Error('db down'));
    await expect(service.unban('b1')).rejects.toThrow('db down');
    expect(service.isBanned('1.1.1.1')).toBe(true);
  });

  it('findAll orders newest first and exposes only safe banner fields', async () => {
    const { service, bannedIp } = setup();
    await service.findAll();
    expect(bannedIp.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: { bannedBy: { select: { id: true, name: true, email: true } } },
    });
  });
});
