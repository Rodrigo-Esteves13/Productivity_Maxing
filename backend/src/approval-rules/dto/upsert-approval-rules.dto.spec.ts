import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertApprovalRulesDto } from './upsert-approval-rules.dto';
import {
  APPLY_RULES_AREA_IDS_MAX,
  ApplyApprovalRulesToAreasDto,
} from './apply-approval-rules-to-areas.dto';
import {
  CUSTOM_RULES_MAX,
  CUSTOM_RULE_LABEL_MAX,
  CUSTOM_RULE_MAX_BELOW_LIMIT,
} from '../custom-rules.constants';

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

describe('UpsertApprovalRulesDto customRules', () => {
  const nestedErrors = async (body: Record<string, unknown>) => {
    const errors = await validate(
      plainToInstance(UpsertApprovalRulesDto, body),
    );
    return errors.flatMap((e) =>
      (e.children ?? []).flatMap((c) =>
        (c.children ?? []).map((x) => x.property),
      ),
    );
  };
  const item = { kind: 'MAX_BELOW', threshold: 8, maxBelow: 1 };

  it('accepts valid rules and []', async () => {
    expect(
      await errorsOf({
        customRules: [
          { ...item, labelContains: 'x' },
          { kind: 'GROUP_AVG_MIN', threshold: 9.5, maxBelow: null },
        ],
      }),
    ).toEqual([]);
    expect(await errorsOf({ customRules: [] })).toEqual([]);
  });

  it('rejects null, too many items and a bad kind', async () => {
    expect(await errorsOf({ customRules: null })).toEqual(['customRules']);
    expect(
      await errorsOf({
        customRules: Array.from({ length: CUSTOM_RULES_MAX + 1 }, () => item),
      }),
    ).toEqual(['customRules']);
    expect(
      await errorsOf({ customRules: [{ ...item, kind: 'NOPE' }] }),
    ).toEqual(['customRules']);
  });

  it('requires maxBelow for MAX_BELOW and forbids it for GROUP_AVG_MIN', async () => {
    expect(
      await nestedErrors({
        customRules: [{ kind: 'MAX_BELOW', threshold: 8 }],
      }),
    ).toEqual(['maxBelow']);
    expect(
      await nestedErrors({
        customRules: [{ kind: 'GROUP_AVG_MIN', threshold: 8, maxBelow: 2 }],
      }),
    ).toEqual(['maxBelow']);
    expect(
      await nestedErrors({
        customRules: [{ ...item, maxBelow: CUSTOM_RULE_MAX_BELOW_LIMIT + 1 }],
      }),
    ).toEqual(['maxBelow']);
  });

  it('trims labelContains, empty becomes null, and caps the length', async () => {
    const dto = plainToInstance(UpsertApprovalRulesDto, {
      customRules: [
        { ...item, labelContains: '  ' },
        { ...item, labelContains: ' ab ' },
      ],
    });
    expect(dto.customRules?.map((r) => r.labelContains)).toEqual([null, 'ab']);
    expect(
      await nestedErrors({
        customRules: [
          { ...item, labelContains: 'a'.repeat(CUSTOM_RULE_LABEL_MAX + 1) },
        ],
      }),
    ).toEqual(['labelContains']);
  });

  it('rejects thresholds with more than 2 decimals', async () => {
    expect(
      await nestedErrors({
        customRules: [{ ...item, threshold: 8.123 }],
      }),
    ).toEqual(['threshold']);
  });
});

describe('ApplyApprovalRulesToAreasDto', () => {
  const ID = '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b';
  const ID2 = '4f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b';
  const errs = async (body: Record<string, unknown>) =>
    (await validate(plainToInstance(ApplyApprovalRulesToAreasDto, body)))
      .map((e) => e.property)
      .sort();

  it('areaIds is optional and accepts unique uuids', async () => {
    expect(await errs({ passMark: 10 })).toEqual([]);
    expect(await errs({ areaIds: [ID, ID2] })).toEqual([]);
  });

  it('rejects empty, duplicated, non-uuid and oversized lists', async () => {
    expect(await errs({ areaIds: [] })).toEqual(['areaIds']);
    expect(await errs({ areaIds: [ID, ID] })).toEqual(['areaIds']);
    expect(await errs({ areaIds: ['x'] })).toEqual(['areaIds']);
    expect(
      await errs({
        areaIds: Array.from(
          { length: APPLY_RULES_AREA_IDS_MAX + 1 },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        ),
      }),
    ).toEqual(['areaIds']);
  });
});
