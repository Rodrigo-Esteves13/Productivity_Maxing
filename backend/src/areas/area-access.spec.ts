import { NotFoundException } from '@nestjs/common';
import { accessibleAreaWhere, assertAreaAccessible } from './area-access';

describe('area-access', () => {
  it('accessibleAreaWhere = oficial OU do user', () => {
    expect(accessibleAreaWhere('u1')).toEqual({
      OR: [{ ownerId: null }, { ownerId: 'u1' }],
    });
  });

  it('assertAreaAccessible filtra por acesso e passa quando existe', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'a1' });
    await expect(
      assertAreaAccessible({ area: { findFirst } } as never, 'u1', 'a1'),
    ).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'a1', OR: [{ ownerId: null }, { ownerId: 'u1' }] },
      select: { id: true },
    });
  });

  it('assertAreaAccessible dá 404 para Area privada de outro (ou inexistente)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      assertAreaAccessible({ area: { findFirst } } as never, 'u1', 'a2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
