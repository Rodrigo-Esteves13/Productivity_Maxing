import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListUsersQueryDto } from './list-users-query.dto';
import { USER_SEARCH_MAX_LENGTH } from '../users.constants';

const check = (plain: object) =>
  validate(plainToInstance(ListUsersQueryDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('ListUsersQueryDto', () => {
  it('accepts an empty query and a normal search', async () => {
    expect(await check({})).toHaveLength(0);
    expect(await check({ q: 'ana', limit: '20' })).toHaveLength(0);
  });

  it('rejects a search longer than the cap', async () => {
    const errors = await check({ q: 'a'.repeat(USER_SEARCH_MAX_LENGTH + 1) });
    expect(errors.map((e) => e.property)).toEqual(['q']);
  });

  it('accepts role, status and join order', async () => {
    expect(
      await check({ role: 'ADMIN', status: 'BANNED', order: 'asc' }),
    ).toHaveLength(0);
  });

  it('rejects values outside the enums', async () => {
    const errors = await check({ role: 'ROOT', status: 'GONE', order: 'up' });
    expect(errors.map((e) => e.property).sort()).toEqual([
      'order',
      'role',
      'status',
    ]);
  });

  it('accepts only whitelisted sort columns', async () => {
    expect(await check({ sort: 'name' })).toHaveLength(0);
    expect(await check({ sort: 'email' })).not.toHaveLength(0);
  });

  it('rejects unknown params', async () => {
    expect(await check({ page: '2' })).not.toHaveLength(0);
  });
});
