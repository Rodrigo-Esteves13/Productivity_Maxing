import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

const base = {
  areaId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  title: 'Relatorio',
  date: '2026-11-20T00:00:00Z',
  type: 'ACADEMICO',
  difficulty: 'EASY',
};

const errorsOf = async (extra: Record<string, unknown>) =>
  (await validate(plainToInstance(CreateTaskDto, { ...base, ...extra }))).map(
    (e) => e.property,
  );

describe('CreateTaskDto (esforco, certeza da data, bloqueio)', () => {
  it('aceita os campos novos validos', async () => {
    expect(
      await errorsOf({
        effort: 'EXHAUSTIVE',
        dateCertainty: 'SURPRISE',
        isBlocked: true,
        availableFrom: '2026-11-10T00:00:00Z',
      }),
    ).toEqual([]);
  });

  it('aceita null para limpar esforco e abertura', async () => {
    expect(await errorsOf({ effort: null, availableFrom: null })).toEqual([]);
  });

  it('rejeita valores fora dos enums e datas invalidas', async () => {
    const errors = await errorsOf({
      effort: 'INSANE',
      dateCertainty: 'MAYBE',
      isBlocked: 'yes',
      availableFrom: 'amanha',
    });
    expect(errors.sort()).toEqual(
      ['availableFrom', 'dateCertainty', 'effort', 'isBlocked'].sort(),
    );
  });
});
