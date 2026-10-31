import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertApprovalRulesDto } from './upsert-approval-rules.dto';

const errorsOf = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(UpsertApprovalRulesDto, body)))
    .map((e) => e.property)
    .sort();

describe('UpsertApprovalRulesDto', () => {
  it('aceita body vazio (tudo vem da base)', async () => {
    expect(await errorsOf({})).toEqual([]);
  });

  it('aceita um conjunto completo valido', async () => {
    expect(
      await errorsOf({
        presetKey: 'pt-PT-ismai',
        scaleMin: 0,
        scaleMax: 20,
        passMark: 9.5,
        rounding: 'UP_TO_INTEGER_AT_HALF',
        componentMinGrade: 6,
        secondThreshold: 8,
        maxBelowSecondThreshold: 1,
        hasExamTrack: true,
        hasResitTrack: false,
      }),
    ).toEqual([]);
  });

  it('aceita null para desligar regras opcionais', async () => {
    expect(
      await errorsOf({
        presetKey: null,
        componentMinGrade: null,
        secondThreshold: null,
        maxBelowSecondThreshold: null,
      }),
    ).toEqual([]);
  });

  it.each([
    'scaleMin',
    'scaleMax',
    'passMark',
    'rounding',
    'hasExamTrack',
    'hasResitTrack',
  ])('rejeita null em %s (colunas NOT NULL)', async (field) => {
    expect(await errorsOf({ [field]: null })).toEqual([field]);
  });

  it('campos obrigatorios aceitam ficar em falta (undefined)', async () => {
    expect(
      await errorsOf({
        scaleMin: undefined,
        scaleMax: undefined,
        passMark: undefined,
        rounding: undefined,
        hasExamTrack: undefined,
        hasResitTrack: undefined,
      }),
    ).toEqual([]);
  });

  it('rejeita preset e arredondamento desconhecidos', async () => {
    expect(await errorsOf({ presetKey: 'harvard', rounding: 'DOWN' })).toEqual([
      'presetKey',
      'rounding',
    ]);
  });

  it('rejeita scaleMax <= scaleMin', async () => {
    expect(await errorsOf({ scaleMin: 10, scaleMax: 10 })).toEqual([
      'scaleMax',
    ]);
    expect(await errorsOf({ scaleMin: 10, scaleMax: 5 })).toEqual(['scaleMax']);
  });

  it('rejeita passMark e limiares fora da escala', async () => {
    expect(
      await errorsOf({
        scaleMin: 0,
        scaleMax: 20,
        passMark: 21,
        componentMinGrade: -1,
        secondThreshold: 30,
      }),
    ).toEqual(['componentMinGrade', 'passMark', 'secondThreshold']);
  });

  it('rejeita valores fora dos limites e tipos errados', async () => {
    expect(
      await errorsOf({
        scaleMin: -5,
        scaleMax: 5000,
        maxBelowSecondThreshold: 1.5,
        hasExamTrack: 'yes',
        passMark: '10',
      }),
    ).toEqual([
      'hasExamTrack',
      'maxBelowSecondThreshold',
      'passMark',
      'scaleMax',
      'scaleMin',
    ]);
  });
});
