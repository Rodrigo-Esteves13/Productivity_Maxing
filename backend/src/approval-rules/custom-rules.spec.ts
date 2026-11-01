import type { ApprovalRules, CustomRule } from './approval-rules.types';
import {
  describeCustomRule,
  evaluateCustomRules,
  normalizeLabel,
  sanitizeCustomRules,
} from './custom-rules';
import {
  CUSTOM_RULE_LABEL_MAX,
  CUSTOM_RULE_MAX_BELOW_LIMIT,
  CUSTOM_RULES_MAX,
} from './custom-rules.constants';
import { modelPassPct } from './pass-probability';

const BASE_RULES: ApprovalRules = {
  presetKey: null,
  scaleMin: 0,
  scaleMax: 20,
  passMark: 10,
  rounding: 'UP_TO_INTEGER_AT_HALF',
  componentMinGrade: null,
  secondThreshold: null,
  maxBelowSecondThreshold: null,
  hasExamTrack: false,
  hasResitTrack: false,
};

const withRules = (...customRules: CustomRule[]): ApprovalRules => ({
  ...BASE_RULES,
  customRules,
});

const maxBelow = (
  threshold: number,
  max: number,
  labelContains: string | null = null,
): CustomRule => ({
  kind: 'MAX_BELOW',
  threshold,
  maxBelow: max,
  labelContains,
});

const groupAvg = (
  threshold: number,
  labelContains: string | null = null,
): CustomRule => ({
  kind: 'GROUP_AVG_MIN',
  threshold,
  maxBelow: null,
  labelContains,
});

const c = (label: string, grade: number, share: number) => ({
  label,
  grade,
  share,
});

describe('normalizeLabel', () => {
  it('tira acentos, minusculas e colapsa espacos', () => {
    expect(normalizeLabel('  Exame   Prático ')).toBe('exame pratico');
    expect(normalizeLabel('AVALIAÇÃO')).toBe('avaliacao');
  });
});

describe('evaluateCustomRules: MAX_BELOW', () => {
  it('sem regras custom (undefined ou []) nao ha violacoes', () => {
    const comps = [c('Teste 1', 0, 0.5)];
    expect(evaluateCustomRules(comps, BASE_RULES)).toEqual([]);
    expect(evaluateCustomRules(comps, withRules())).toEqual([]);
  });

  it('conta so os componentes cujo nome contem o filtro (sem acentos/maiusculas)', () => {
    const rule = maxBelow(8, 0, 'TESTÉ');
    const comps = [
      c('Teste 1', 7, 0.3),
      c('Trabalho', 2, 0.3),
      c('teste 2', 9, 0.3),
    ];
    expect(evaluateCustomRules(comps, withRules(rule))).toEqual([
      { rule, count: 1, average: null },
    ]);
  });

  it('dentro da quota nao viola; acima viola', () => {
    const comps = [c('A', 7, 0.3), c('B', 7.5, 0.3)];
    expect(evaluateCustomRules(comps, withRules(maxBelow(8, 2)))).toEqual([]);
    expect(evaluateCustomRules(comps, withRules(maxBelow(8, 1)))).toHaveLength(
      1,
    );
  });

  it('epsilon: 7.9999999999 conta como 8 (nao abaixo)', () => {
    const comps = [c('A', 8 - 1e-11, 0.5)];
    expect(evaluateCustomRules(comps, withRules(maxBelow(8, 0)))).toEqual([]);
  });

  it('threshold fora da escala ignora-se', () => {
    const comps = [c('A', 5, 0.5)];
    expect(evaluateCustomRules(comps, withRules(maxBelow(25, 0)))).toEqual([]);
  });
});

describe('evaluateCustomRules: GROUP_AVG_MIN', () => {
  it('media ponderada pelo peso dos componentes do grupo', () => {
    const rule = groupAvg(10, 'teste');
    // (6*0.1 + 12*0.3) / 0.4 = 10.5 -> passa; media simples daria 9.
    const comps = [
      c('Teste 1', 6, 0.1),
      c('Teste 2', 12, 0.3),
      c('Trabalho', 0, 0.6),
    ];
    expect(evaluateCustomRules(comps, withRules(rule))).toEqual([]);
    // (12*0.1 + 6*0.3) / 0.4 = 7.5 -> viola.
    const worse = [c('Teste 1', 12, 0.1), c('Teste 2', 6, 0.3)];
    const [violation] = evaluateCustomRules(worse, withRules(rule));
    expect(violation.rule).toBe(rule);
    expect(violation.count).toBe(2);
    expect(violation.average).toBeCloseTo(7.5, 9);
  });

  it('sem nenhum componente no grupo nao avalia', () => {
    const comps = [c('Trabalho', 0, 0.5)];
    expect(
      evaluateCustomRules(comps, withRules(groupAvg(10, 'exame'))),
    ).toEqual([]);
  });

  it('epsilon: media exatamente no limiar passa', () => {
    const comps = [c('A', 10 - 1e-11, 0.5), c('B', 10, 0.5)];
    expect(evaluateCustomRules(comps, withRules(groupAvg(10)))).toEqual([]);
  });

  it('uma violacao por regra violada', () => {
    const comps = [c('Teste', 5, 0.5)];
    const rules = withRules(maxBelow(8, 0), groupAvg(10), maxBelow(4, 0));
    expect(evaluateCustomRules(comps, rules)).toHaveLength(2);
  });
});

describe('describeCustomRule', () => {
  it('texto curto com o filtro original', () => {
    expect(describeCustomRule(maxBelow(8, 1, 'Teste'))).toBe(
      'max 1 < 8 "Teste"',
    );
    expect(describeCustomRule(groupAvg(9.5))).toBe('avg >= 9.5');
  });
});

describe('sanitizeCustomRules', () => {
  it('lixo que nao e array da []', () => {
    for (const value of [null, undefined, 'x', 3, {}, { kind: 'MAX_BELOW' }]) {
      expect(sanitizeCustomRules(value)).toEqual([]);
    }
  });

  it('descarta itens malformados e normaliza os validos', () => {
    const result = sanitizeCustomRules([
      null,
      'x',
      [],
      { kind: 'NOPE', threshold: 8, maxBelow: 1 },
      { kind: 'MAX_BELOW', threshold: '8', maxBelow: 1 },
      { kind: 'MAX_BELOW', threshold: Number.NaN, maxBelow: 1 },
      { kind: 'MAX_BELOW', threshold: 8 },
      { kind: 'MAX_BELOW', threshold: 8, maxBelow: 1.5 },
      { kind: 'MAX_BELOW', threshold: 8, maxBelow: -1 },
      {
        kind: 'MAX_BELOW',
        threshold: 8,
        maxBelow: CUSTOM_RULE_MAX_BELOW_LIMIT + 1,
      },
      {
        kind: 'MAX_BELOW',
        threshold: 8,
        maxBelow: 1,
        labelContains: '  Teste ',
      },
      {
        kind: 'GROUP_AVG_MIN',
        threshold: 10,
        maxBelow: 3,
        labelContains: '  ',
      },
      { kind: 'GROUP_AVG_MIN', threshold: 10, labelContains: 42 },
    ]);
    expect(result).toEqual([
      maxBelow(8, 1, 'Teste'),
      groupAvg(10, null),
      groupAvg(10, null),
    ]);
  });

  it('corta o filtro ao maximo e limita o numero de regras', () => {
    const long = 'a'.repeat(CUSTOM_RULE_LABEL_MAX + 10);
    const many = Array.from({ length: CUSTOM_RULES_MAX + 5 }, () => ({
      kind: 'GROUP_AVG_MIN',
      threshold: 10,
      maxBelow: null,
      labelContains: long,
    }));
    const result = sanitizeCustomRules(many);
    expect(result).toHaveLength(CUSTOM_RULES_MAX);
    expect(result[0].labelContains).toHaveLength(CUSTOM_RULE_LABEL_MAX);
  });
});

describe('modelPassPct: regras custom', () => {
  const baseInput = {
    passRaw: 9.5,
    remainingShares: [0.5],
    continuousOpen: true,
    sittings: 0,
    round: (value: number) => Math.floor(value + 0.5 + 1e-9),
  };

  it('violacao nas notas tiradas zera a continua', () => {
    const graded = [{ grade: 15, share: 0.5, label: 'Teste 1' }];
    const free = modelPassPct({ ...baseInput, rules: BASE_RULES, graded });
    const blocked = modelPassPct({
      ...baseInput,
      rules: withRules(groupAvg(16, 'teste')),
      graded,
    });
    expect(free).toBeGreaterThan(0);
    expect(blocked).toBe(0);
  });

  it('sem label e filtro por nome: o componente nao encaixa', () => {
    const graded = [{ grade: 15, share: 0.5 }];
    const free = modelPassPct({ ...baseInput, rules: BASE_RULES, graded });
    const filtered = modelPassPct({
      ...baseInput,
      rules: withRules(groupAvg(16, 'teste')),
      graded,
    });
    expect(filtered).toBe(free);
  });
});
