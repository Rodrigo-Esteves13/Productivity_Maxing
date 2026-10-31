import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkUpdateEffortDto } from './bulk-update-effort.dto';

const ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const errorsOf = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(BulkUpdateEffortDto, body))).map(
    (e) => e.property,
  );

describe('BulkUpdateEffortDto', () => {
  it('accepts valid ids and effort', async () => {
    expect(await errorsOf({ ids: [ID], effort: 'HEAVY' })).toEqual([]);
  });

  it('accepts null to clear the effort', async () => {
    expect(await errorsOf({ ids: [ID], effort: null })).toEqual([]);
  });

  it('rejects an empty list', async () => {
    expect(await errorsOf({ ids: [], effort: 'LIGHT' })).toEqual(['ids']);
  });

  it('rejects more than 200 ids', async () => {
    const ids = Array.from({ length: 201 }, () => ID);
    expect(await errorsOf({ ids, effort: 'LIGHT' })).toEqual(['ids']);
  });

  it('rejects non-uuid ids', async () => {
    expect(await errorsOf({ ids: ['nope'], effort: 'LIGHT' })).toEqual(['ids']);
  });

  it('rejects an invalid effort value', async () => {
    expect(await errorsOf({ ids: [ID], effort: 'HUGE' })).toEqual(['effort']);
  });

  it('rejects a missing effort', async () => {
    expect(await errorsOf({ ids: [ID] })).toEqual(['effort']);
  });
});
