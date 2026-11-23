import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindAreasQueryDto } from './find-areas-query.dto';
import { CreateAreaDto } from './create-area.dto';
import { MAX_AREA_CREDITS } from '../areas.constants';

const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const parse = (query: Record<string, unknown>) =>
  plainToInstance(FindAreasQueryDto, query);

describe('FindAreasQueryDto', () => {
  it('accepts an empty query', async () => {
    expect(await validate(parse({}))).toHaveLength(0);
  });

  it('accepts a uuid or "all" as periodId', async () => {
    expect(await validate(parse({ periodId: UUID }))).toHaveLength(0);
    expect(await validate(parse({ periodId: 'all' }))).toHaveLength(0);
  });

  it('rejects any other periodId', async () => {
    expect(await validate(parse({ periodId: 'lixo' }))).toHaveLength(1);
  });

  it('turns includeHidden into a boolean', () => {
    expect(parse({ includeHidden: 'true' }).includeHidden).toBe(true);
    expect(parse({ includeHidden: 'false' }).includeHidden).toBe(false);
  });
});

describe('CreateAreaDto credits cap', () => {
  const check = (credits: number) =>
    validate(
      plainToInstance(CreateAreaDto, {
        name: 'Maths',
        colorHex: '#112233',
        credits,
      }),
    );

  it('rejects credits above the cap', async () => {
    expect(await check(MAX_AREA_CREDITS)).toHaveLength(0);
    expect(await check(MAX_AREA_CREDITS + 1)).toHaveLength(1);
  });
});
