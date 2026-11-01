import { presetRules } from './presets';
import { applyRounding, computeCourseRisk } from './risk-engine';
import type {
  ApprovalRules,
  CourseRisk,
  CourseRiskInput,
  RiskComponentInput,
  RiskReasonCode,
} from './approval-rules.types';

// Regras estilo ISMAI (0-20, passa com 10 arredondado, min 6, max 1 abaixo
// de 8) mas sem pistas, para isolar a avaliacao continua.
const STRICT_RULES: ApprovalRules = {
  presetKey: null,
  scaleMin: 0,
  scaleMax: 20,
  passMark: 10,
  rounding: 'UP_TO_INTEGER_AT_HALF',
  componentMinGrade: 6,
  secondThreshold: 8,
  maxBelowSecondThreshold: 1,
  hasExamTrack: false,
  hasResitTrack: false,
};

// Generico: sem regras opcionais, sem pistas.
const GENERIC_RULES: ApprovalRules = {
  presetKey: 'generic',
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

const comp = (
  weightPct: number,
  grade: number | null,
  label = `C${weightPct}`,
): RiskComponentInput => ({ label, weightPct, grade });

function input(overrides: Partial<CourseRiskInput> = {}): CourseRiskInput {
  return {
    areaId: 'area-1',
    areaName: 'Algebra',
    colorHex: '#7c3aed',
    rules: STRICT_RULES,
    components: [],
    studiedMinutes: null,
    estimatedMinutes: null,
    absenceSharePct: null,
    absenceLimitPct: null,
    postponedCount: 0,
    teacher: null,
    ...overrides,
  };
}

function risk(overrides: Partial<CourseRiskInput>): CourseRisk {
  const result = computeCourseRisk(input(overrides));
  if (result === null) throw new Error('expected a risk verdict');
  return result;
}

const codes = (r: CourseRisk): RiskReasonCode[] => r.reasons.map((x) => x.code);

const reason = (r: CourseRisk, code: RiskReasonCode) =>
  r.reasons.find((x) => x.code === code);

describe('applyRounding', () => {
  it('UP_TO_INTEGER_AT_HALF: 9.5 sobe, 9.49 desce', () => {
    expect(applyRounding(9.5, STRICT_RULES)).toBe(10);
    expect(applyRounding(9.49, STRICT_RULES)).toBe(9);
    expect(applyRounding(9.4, STRICT_RULES)).toBe(9);
  });

  it('tolera erro de virgula flutuante logo abaixo de .5', () => {
    expect(applyRounding(9.499999999999998, STRICT_RULES)).toBe(10);
    expect(applyRounding((9.1 + 9.7 + 9.7) / 3, STRICT_RULES)).toBe(10);
  });

  it('NONE devolve o valor tal como esta', () => {
    expect(applyRounding(9.49, { ...STRICT_RULES, rounding: 'NONE' })).toBe(
      9.49,
    );
  });
});

describe('computeCourseRisk: sem dados', () => {
  it('sem componentes devolve null', () => {
    expect(computeCourseRisk(input())).toBeNull();
  });

  it('componentes sem nota devolvem null mesmo com outros sinais', () => {
    expect(
      computeCourseRisk(
        input({
          components: [comp(40, null), comp(60, null)],
          studiedMinutes: 0,
          estimatedMinutes: 600,
          absenceSharePct: 40,
          absenceLimitPct: 25,
          postponedCount: 9,
          teacher: {
            name: 'Prof',
            avgWithTeacher: 0.3,
            avgOthers: 0.8,
            sampleWithTeacher: 10,
          },
        }),
      ),
    ).toBeNull();
  });

  it('nota so em componentes sem peso devolve null', () => {
    expect(
      computeCourseRisk(input({ components: [comp(0, 12), comp(100, null)] })),
    ).toBeNull();
  });
});

describe('computeCourseRisk: exemplo trabalhado (6 em 70%, falta 30%)', () => {
  it('sem exame nem recurso: risco extremo com HIGH_NEED', () => {
    const r = risk({ components: [comp(70, 6, 'Teste'), comp(30, null)] });
    // (9.5 * 100 - 6 * 70) / 30 = 17.67
    expect(r.neededOnRemaining).toBe(17.7);
    expect(['high', 'extreme']).toContain(r.level);
    expect(r.level).toBe('extreme');
    expect(r.track).toBe('CONTINUOUS');
    expect(r.currentAverage).toBe(6);
    expect(r.gradedWeightPct).toBe(70);
    expect(r.remainingWeightPct).toBe(30);
    // 6 com minimo 6 nao e violacao.
    expect(codes(r)).not.toContain('COMPONENT_BELOW_MIN');
    expect(codes(r)[0]).toBe('HIGH_NEED_ON_REMAINING');
    expect(reason(r, 'HIGH_NEED_ON_REMAINING')?.params).toEqual({
      needed: 17.7,
      remaining: 30,
    });
    expect(reason(r, 'LOW_AVERAGE_SO_FAR')?.params).toEqual({
      average: 6,
      passMark: 10,
    });
  });

  it('com exame e recurso (preset ISMAI): continua extreme pelas notas', () => {
    // Requisito: 6 em 70% com 30% por avaliar e risco extremo mesmo com
    // exame e recurso. O teto da prova unica nao limita um necessario de
    // 17.7/20 com media mostrada de 6.
    const r = risk({
      rules: presetRules('pt-PT-ismai'),
      components: [comp(70, 6), comp(30, null)],
    });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe('extreme');
    expect(r.track).toBe('CONTINUOUS');
    expect(r.neededOnRemaining).toBe(17.7);
    expect(codes(r)[0]).toBe('HIGH_NEED_ON_REMAINING');
  });

  it('usa a nota crua de passagem (9.5) no necessario', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(50, 10), comp(50, null)],
    });
    // (9.5 - 5) / 0.5 = 9
    expect(r.neededOnRemaining).toBe(9);
    // No limiar de medium ha sempre uma razao a explicar.
    expect(r.level === 'low' || r.reasons.length > 0).toBe(true);
  });

  it('boa media com muito por fazer e risco baixo', () => {
    const r = risk({ components: [comp(40, 15), comp(60, null)] });
    expect(r.level).toBe('low');
    // So o risco residual do que falta avaliar, nunca uma causa concreta.
    expect(codes(r)).toEqual(['REMAINING_UNCERTAINTY']);
  });
});

describe('computeCourseRisk: fronteira de arredondamento na nota final', () => {
  it('9.4 final chumba (arredonda a 9)', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(50, 9.4), comp(50, 9.4)],
    });
    expect(r.level).toBe('extreme');
    expect(r.score).toBe(100);
    expect(r.neededOnRemaining).toBeNull();
    expect(codes(r)).toEqual(['LOW_AVERAGE_SO_FAR']);
    expect(reason(r, 'LOW_AVERAGE_SO_FAR')?.params).toEqual({
      average: 9.4,
      passMark: 10,
    });
  });

  it('9.5 final passa (arredonda a 10)', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(50, 9.5), comp(50, 9.5)],
    });
    expect(r.level).toBe('low');
    expect(r.score).toBe(0);
    expect(r.track).toBe('CONTINUOUS');
    expect(r.reasons).toEqual([]);
  });

  it('media 9.4999999 por virgula flutuante passa', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(100 / 3, 9.1), comp(100 / 3, 9.7), comp(100 / 3, 9.7)],
    });
    expect(r.score).toBe(0);
    expect(r.remainingWeightPct).toBe(0);
  });

  it('cadeira ja aprovada ignora estudo e adiamentos mas nao faltas', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(100, 14)],
      studiedMinutes: 0,
      estimatedMinutes: 600,
      postponedCount: 5,
      absenceSharePct: 30,
      absenceLimitPct: 25,
    });
    expect(codes(r)).toEqual(['ABSENCE_OVER_LIMIT']);
    expect(r.level).toBe('low');
  });
});

describe('computeCourseRisk: regras duras', () => {
  it('componente de 5.9 com minimo 6 dispara COMPONENT_BELOW_MIN', () => {
    const r = risk({
      components: [comp(30, 5.9, 'Mini-teste'), comp(70, null)],
    });
    expect(codes(r)[0]).toBe('COMPONENT_BELOW_MIN');
    expect(reason(r, 'COMPONENT_BELOW_MIN')?.params).toEqual({
      label: 'Mini-teste',
      grade: 5.9,
      min: 6,
    });
    // Sem exame nem recurso a continua decidida e chumbo.
    expect(r.level).toBe('extreme');
    expect(r.neededOnRemaining).toBeNull();
  });

  it('componente de 6.0 nao dispara COMPONENT_BELOW_MIN', () => {
    const r = risk({ components: [comp(30, 6), comp(70, null)] });
    expect(codes(r)).not.toContain('COMPONENT_BELOW_MIN');
    expect(r.track).toBe('CONTINUOUS');
    expect(r.neededOnRemaining).not.toBeNull();
  });

  it('dois componentes abaixo de 8 disparam TOO_MANY_BELOW_SECOND_THRESHOLD', () => {
    const r = risk({
      components: [comp(25, 7), comp(25, 7.5), comp(50, null)],
    });
    expect(codes(r)).toContain('TOO_MANY_BELOW_SECOND_THRESHOLD');
    expect(reason(r, 'TOO_MANY_BELOW_SECOND_THRESHOLD')?.params).toEqual({
      count: 2,
      threshold: 8,
      max: 1,
    });
    expect(r.level).toBe('extreme');
  });

  it('exatamente um abaixo de 8 nao dispara', () => {
    const r = risk({
      components: [comp(25, 7), comp(25, 12), comp(50, null)],
    });
    expect(codes(r)).not.toContain('TOO_MANY_BELOW_SECOND_THRESHOLD');
    expect(r.track).toBe('CONTINUOUS');
  });

  it('quota abaixo de 8 cheia: o que falta tem de chegar a 8', () => {
    const r = risk({ components: [comp(50, 7), comp(50, null)] });
    // (9.5 - 3.5) / 0.5 = 12 > 8, a regra nao muda o necessario
    expect(r.neededOnRemaining).toBe(12);
    const easy = risk({
      components: [comp(50, 7.9), comp(10, 19), comp(40, null)],
    });
    // bruto (9.5 - 3.95 - 1.9) / 0.4 = 9.125; o piso 8 nao pesa aqui
    expect(easy.neededOnRemaining).toBe(9.1);
    const floored = risk({
      components: [comp(50, 7.9), comp(30, 19), comp(20, null)],
    });
    // bruto (9.5 - 3.95 - 5.7) / 0.2 < 0, mas o restante tem de ter >= 8
    expect(floored.neededOnRemaining).toBe(8);
  });
});

describe('computeCourseRisk: exame e recurso (prova unica a 100%)', () => {
  const failed = [comp(40, 5), comp(60, null)];

  it('continua falhada com exame e recurso: EXAM, high', () => {
    const r = risk({
      rules: { ...STRICT_RULES, hasExamTrack: true, hasResitTrack: true },
      components: failed,
    });
    expect(r.track).toBe('EXAM');
    expect(r.level).toBe('high');
    expect(codes(r).slice(0, 2)).toEqual([
      'COMPONENT_BELOW_MIN',
      'ONLY_EXAM_TRACK_LEFT',
    ]);
    expect(reason(r, 'ONLY_EXAM_TRACK_LEFT')?.params).toEqual({
      track: 'EXAM',
    });
  });

  it('so exame: EXAM, mais risco do que exame + recurso, ainda high', () => {
    const both = risk({
      rules: { ...STRICT_RULES, hasExamTrack: true, hasResitTrack: true },
      components: failed,
    });
    const examOnly = risk({
      rules: { ...STRICT_RULES, hasExamTrack: true },
      components: failed,
    });
    expect(examOnly.track).toBe('EXAM');
    expect(examOnly.level).toBe('high');
    expect(examOnly.score).toBeGreaterThan(both.score);
  });

  it('so recurso: RESIT', () => {
    const r = risk({
      rules: { ...STRICT_RULES, hasResitTrack: true },
      components: failed,
    });
    expect(r.track).toBe('RESIT');
    expect(r.level).toBe('high');
    expect(codes(r)).toContain('ONLY_EXAM_TRACK_LEFT');
    expect(reason(r, 'ONLY_EXAM_TRACK_LEFT')?.params).toEqual({
      track: 'RESIT',
    });
  });

  it('sem exame nem recurso: extreme, sem ONLY_EXAM_TRACK_LEFT', () => {
    const r = risk({ components: failed });
    expect(r.track).toBe('CONTINUOUS');
    expect(r.level).toBe('extreme');
    expect(r.score).toBe(100);
    expect(codes(r)).not.toContain('ONLY_EXAM_TRACK_LEFT');
  });

  it('meta impossivel com exame e media de 2: IMPOSSIBLE + ONLY_EXAM_TRACK_LEFT, extreme', () => {
    const r = risk({
      rules: { ...GENERIC_RULES, hasExamTrack: true },
      components: [comp(80, 2), comp(20, null)],
    });
    // (9.5 - 1.6) / 0.2 = 39.5 > 20; media 2 muito abaixo da passagem:
    // gravidade pelas notas, o exame nao limita o risco.
    expect(r.track).toBe('EXAM');
    expect(r.level).toBe('extreme');
    expect(codes(r).slice(0, 2)).toEqual([
      'IMPOSSIBLE_ON_REMAINING',
      'ONLY_EXAM_TRACK_LEFT',
    ]);
    expect(reason(r, 'IMPOSSIBLE_ON_REMAINING')?.params).toEqual({
      needed: 39.5,
      remaining: 20,
    });
    expect(r.neededOnRemaining).toBe(39.5);
  });
});

describe('computeCourseRisk: gravidade pelas notas (preset ISMAI, exame + recurso)', () => {
  const ISMAI = presetRules('pt-PT-ismai');

  it('2/20 em 90%: impossivel, EXAM, extreme', () => {
    const r = risk({ rules: ISMAI, components: [comp(90, 2), comp(10, null)] });
    // (9.5 * 100 - 2 * 90) / 10 = 77 > 20. 2 fica abaixo do minimo 6, por
    // isso a causa listada e a regra dura; a gravidade vem das notas.
    expect(r.track).toBe('EXAM');
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe('extreme');
    expect(codes(r)).toContain('COMPONENT_BELOW_MIN');
    expect(reason(r, 'ONLY_EXAM_TRACK_LEFT')?.params).toEqual({
      track: 'EXAM',
    });
  });

  it('6/20 em 70%: extreme', () => {
    const r = risk({ rules: ISMAI, components: [comp(70, 6), comp(30, null)] });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe('extreme');
    expect(r.track).toBe('CONTINUOUS');
  });

  it('12/20 em 70%: low (so precisa do minimo por componente)', () => {
    const r = risk({
      rules: ISMAI,
      components: [comp(70, 12), comp(30, null)],
    });
    // bruto (9.5 * 100 - 12 * 70) / 30 = 3.67; o minimo 6 manda
    expect(r.neededOnRemaining).toBe(6);
    expect(r.level).toBe('low');
    expect(r.track).toBe('CONTINUOUS');
  });

  it('regra dura com pouco peso avaliado fica high, nao extreme', () => {
    const r = risk({
      rules: ISMAI,
      components: [comp(30, 5.9, 'Mini-teste'), comp(70, null)],
    });
    expect(r.track).toBe('EXAM');
    expect(r.level).toBe('high');
    expect(r.score).toBeLessThan(80);
    expect(codes(r)).toContain('COMPONENT_BELOW_MIN');
    expect(codes(r)).toContain('ONLY_EXAM_TRACK_LEFT');
  });

  it('media perto da passagem com quase tudo avaliado fica abaixo de extreme', () => {
    // 9.4 em 99%: o necessario no 1% restante e 19.4, mas a media mostrada
    // esta a decimas da passagem; o exame e realista.
    const r = risk({
      rules: ISMAI,
      components: [comp(99, 9.4), comp(1, null)],
    });
    expect(r.score).toBeLessThan(80);
    expect(r.level).toBe('high');
  });

  it('nota final fechada a 9.4: EXAM, high (nao extreme)', () => {
    const r = risk({ rules: ISMAI, components: [comp(100, 9.4)] });
    expect(r.track).toBe('EXAM');
    expect(r.level).toBe('high');
  });

  it('nota final fechada a 2: extreme mesmo com exame (coerente com 2 em 90%)', () => {
    const closed = risk({ rules: ISMAI, components: [comp(100, 2)] });
    const open = risk({
      rules: ISMAI,
      components: [comp(90, 2), comp(10, null)],
    });
    expect(closed.level).toBe('extreme');
    expect(closed.score).toBeGreaterThanOrEqual(open.score);
  });
});

describe('computeCourseRisk: peso por avaliar residual (33.33 x3)', () => {
  const thirds = (grade: number) => [
    comp(33.33, grade),
    comp(33.33, grade),
    comp(33.33, grade),
  ];

  it('9.5 x3 fecha e passa: score 0', () => {
    const r = risk({
      rules: presetRules('pt-PT-ismai'),
      components: thirds(9.5),
    });
    expect(r.score).toBe(0);
    expect(r.level).toBe('low');
    expect(r.track).toBe('CONTINUOUS');
    expect(r.reasons).toEqual([]);
    expect(r.neededOnRemaining).toBeNull();
    expect(r.remainingWeightPct).toBe(0);
  });

  it('9.4 x3 fecha e chumba, sem "precisa de 6009 em 0%"', () => {
    const r = risk({ rules: GENERIC_RULES, components: thirds(9.4) });
    expect(r.neededOnRemaining).toBeNull();
    expect(codes(r)).not.toContain('IMPOSSIBLE_ON_REMAINING');
    expect(codes(r)).not.toContain('HIGH_NEED_ON_REMAINING');
    expect(codes(r)).toEqual(['LOW_AVERAGE_SO_FAR']);
    expect(r.score).toBe(100);
    expect(r.remainingWeightPct).toBe(0);
  });

  it('9.4 x3 com exame: continua falhada, pista EXAM', () => {
    const r = risk({
      rules: presetRules('pt-PT-ismai'),
      components: thirds(9.4),
    });
    expect(r.track).toBe('EXAM');
    expect(r.neededOnRemaining).toBeNull();
  });

  it('14 x3 fecha: sem necessario visivel', () => {
    const r = risk({
      rules: presetRules('pt-PT-ismai'),
      components: thirds(14),
    });
    expect(r.score).toBe(0);
    expect(r.neededOnRemaining).toBeNull();
  });

  it('acima da tolerancia (99% avaliado) ainda nao fecha', () => {
    const r = risk({ rules: GENERIC_RULES, components: [comp(99, 12)] });
    expect(r.remainingWeightPct).toBe(1);
    expect(r.neededOnRemaining).not.toBeNull();
  });
});

describe('computeCourseRisk: media mostrada nunca contradiz a passagem', () => {
  it('NONE: 9.96 fechado mostra 9.9 abaixo de 10, nao 10 abaixo de 10', () => {
    const r = risk({
      rules: { ...GENERIC_RULES, rounding: 'NONE' },
      components: [comp(100, 9.96)],
    });
    expect(reason(r, 'LOW_AVERAGE_SO_FAR')?.params).toEqual({
      average: 9.9,
      passMark: 10,
    });
  });

  it('a meio sobe: 9.46 em aberto mostra 9.4, nao 9.5', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(50, 9.46), comp(50, null)],
    });
    expect(reason(r, 'LOW_AVERAGE_SO_FAR')?.params).toEqual({
      average: 9.4,
      passMark: 10,
    });
  });
});

describe('computeCourseRisk: outras escalas', () => {
  const scale100: ApprovalRules = {
    ...GENERIC_RULES,
    scaleMax: 100,
    passMark: 50,
  };
  const scale10: ApprovalRules = {
    ...GENERIC_RULES,
    scaleMax: 10,
    passMark: 5,
  };

  it('0-100, passa com 50: 49.5 passa, 49.4 chumba', () => {
    expect(risk({ rules: scale100, components: [comp(100, 49.5)] }).score).toBe(
      0,
    );
    const fail = risk({ rules: scale100, components: [comp(100, 49.4)] });
    expect(fail.level).toBe('extreme');
    expect(reason(fail, 'LOW_AVERAGE_SO_FAR')?.params).toEqual({
      average: 49.4,
      passMark: 50,
    });
  });

  it('0-10, passa com 5: 4.5 passa, 4.4 chumba', () => {
    expect(risk({ rules: scale10, components: [comp(100, 4.5)] }).score).toBe(
      0,
    );
    expect(risk({ rules: scale10, components: [comp(100, 4.4)] }).level).toBe(
      'extreme',
    );
  });

  it('0-100: necessario no restante na escala certa', () => {
    const r = risk({
      rules: scale100,
      components: [comp(50, 40), comp(50, null)],
    });
    // (49.5 - 20) / 0.5 = 59
    expect(r.neededOnRemaining).toBe(59);
  });

  it('0-100: o exemplo trabalhado (30 em 70%) da o mesmo nivel', () => {
    const r = risk({
      rules: scale100,
      components: [comp(70, 30), comp(30, null)],
    });
    expect(['high', 'extreme']).toContain(r.level);
    expect(codes(r)).toContain('HIGH_NEED_ON_REMAINING');
  });

  it('arredondamento NONE: passa so com a nota exata', () => {
    const none: ApprovalRules = { ...GENERIC_RULES, rounding: 'NONE' };
    expect(risk({ rules: none, components: [comp(100, 9.9)] }).level).toBe(
      'extreme',
    );
    expect(risk({ rules: none, components: [comp(100, 10)] }).score).toBe(0);
  });
});

describe('computeCourseRisk: regras genericas (opcionais a null)', () => {
  it('notas muito baixas nao violam regras que nao existem', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(30, 3), comp(30, 18), comp(40, null)],
    });
    expect(codes(r)).not.toContain('COMPONENT_BELOW_MIN');
    expect(codes(r)).not.toContain('TOO_MANY_BELOW_SECOND_THRESHOLD');
    expect(r.track).toBe('CONTINUOUS');
    // (9.5 - 0.9 - 5.4) / 0.4 = 8
    expect(r.neededOnRemaining).toBe(8);
  });

  it('limiar secundario sem maximo nao e regra', () => {
    const r = risk({
      rules: { ...GENERIC_RULES, secondThreshold: 8 },
      components: [comp(25, 7), comp(25, 7), comp(50, null)],
    });
    expect(codes(r)).not.toContain('TOO_MANY_BELOW_SECOND_THRESHOLD');
  });
});

describe('computeCourseRisk: pesos absolutos (o que falta para 100% esta por avaliar)', () => {
  it('so um componente de 70% com 6, mais nada lancado: falta 30%', () => {
    const r = risk({ components: [comp(70, 6, 'Teste')] });
    expect(r.gradedWeightPct).toBe(70);
    expect(r.remainingWeightPct).toBe(30);
    // (9.5 * 100 - 6 * 70) / 30 = 17.67
    expect(r.neededOnRemaining).toBeGreaterThanOrEqual(17.7);
    expect(['high', 'extreme']).toContain(r.level);
    expect(r.track).toBe('CONTINUOUS');
    expect(codes(r)[0]).toBe('HIGH_NEED_ON_REMAINING');
  });

  it('30 + 30 com um avaliado: 30% avaliado, 70% por avaliar', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(30, 12), comp(30, null)],
    });
    expect(r.gradedWeightPct).toBe(30);
    expect(r.remainingWeightPct).toBe(70);
    // (9.5 - 3.6) / 0.7 = 8.43
    expect(r.neededOnRemaining).toBe(8.4);
  });

  it('soma 60 toda avaliada nao fecha a nota final', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(30, 12), comp(30, 14)],
    });
    expect(r.gradedWeightPct).toBe(60);
    expect(r.remainingWeightPct).toBe(40);
    expect(r.track).toBe('CONTINUOUS');
    // (9.5 - 7.8) / 0.4 = 4.25
    expect(r.neededOnRemaining).toBeCloseTo(4.25, 0);
  });

  it('pesos fracionarios 12.5 / 37.5 / 50', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(12.5, 10), comp(37.5, 10), comp(50, null)],
    });
    expect(r.gradedWeightPct).toBe(50);
    expect(r.neededOnRemaining).toBe(9);
  });

  it('33.3 + 33.3 + 33.4 todos avaliados fecham a nota final', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(33.3, 10), comp(33.3, 10), comp(33.4, 10)],
    });
    expect(r.remainingWeightPct).toBe(0);
    expect(r.neededOnRemaining).toBeNull();
    expect(r.score).toBe(0);
  });

  it('soma acima de 100 divide pela soma', () => {
    const r = risk({
      rules: GENERIC_RULES,
      components: [comp(100, 12), comp(50, null)],
    });
    expect(r.gradedWeightPct).toBe(66.7);
    expect(r.remainingWeightPct).toBe(33.3);
  });
});

describe('computeCourseRisk: sinais secundarios', () => {
  const borderline = [comp(40, 9), comp(60, null)];

  it('params de estudo, faltas e adiamentos', () => {
    const r = risk({
      components: borderline,
      studiedMinutes: 120.4,
      estimatedMinutes: 600,
      absenceSharePct: 21.25,
      absenceLimitPct: 25,
      postponedCount: 3,
    });
    expect(reason(r, 'LOW_STUDY_TIME')?.params).toEqual({
      studied: 120,
      estimated: 600,
    });
    expect(reason(r, 'ABSENCE_NEAR_LIMIT')?.params).toEqual({
      share: 21.3,
      limit: 25,
    });
    expect(reason(r, 'POSTPONED_TASKS')?.params).toEqual({ count: 3 });
  });

  it('faltas acima do limite: ABSENCE_OVER_LIMIT', () => {
    const r = risk({
      components: borderline,
      absenceSharePct: 30,
      absenceLimitPct: 25,
    });
    expect(codes(r)).toContain('ABSENCE_OVER_LIMIT');
    expect(codes(r)).not.toContain('ABSENCE_NEAR_LIMIT');
  });

  it('faltas longe do limite e estudo suficiente nao geram razoes', () => {
    const r = risk({
      components: borderline,
      absenceSharePct: 10,
      absenceLimitPct: 25,
      studiedMinutes: 400,
      estimatedMinutes: 600,
      postponedCount: 1,
    });
    expect(codes(r)).not.toContain('ABSENCE_NEAR_LIMIT');
    expect(codes(r)).not.toContain('LOW_STUDY_TIME');
    expect(codes(r)).not.toContain('POSTPONED_TASKS');
  });

  it('sinais secundarios aumentam o score mas sozinhos nao chegam a high', () => {
    const calm = risk({ components: [comp(40, 15), comp(60, null)] });
    const noisy = risk({
      components: [comp(40, 15), comp(60, null)],
      studiedMinutes: 0,
      estimatedMinutes: 600,
      absenceSharePct: 40,
      absenceLimitPct: 25,
      postponedCount: 10,
    });
    expect(noisy.score).toBeGreaterThan(calm.score);
    expect(['low', 'medium']).toContain(noisy.level);
  });

  it('razoes ordenadas por impacto (causa da nota primeiro)', () => {
    const r = risk({
      components: [comp(70, 6), comp(30, null)],
      postponedCount: 3,
    });
    expect(codes(r)).toEqual([
      'HIGH_NEED_ON_REMAINING',
      'LOW_AVERAGE_SO_FAR',
      'POSTPONED_TASKS',
      'REMAINING_UNCERTAINTY',
    ]);
  });
});

describe('computeCourseRisk: historico com o docente (medias 0-1)', () => {
  // avgWithTeacher/avgOthers chegam normalizados 0-1 (fracao da escala).
  const harshTeacher = {
    name: 'Prof. Silva',
    avgWithTeacher: 0.4,
    avgOthers: 0.75,
    sampleWithTeacher: 6,
  };

  it('sozinho nao e decisivo: sem outro risco nao mexe no score', () => {
    const base = {
      rules: GENERIC_RULES,
      components: [comp(60, 18), comp(40, null)],
    };
    const without = risk(base);
    const withTeacher = risk({ ...base, teacher: harshTeacher });
    // Passa mesmo com 0 no resto e sem regras duras: o docente sozinho nao mexe.
    expect(without.score).toBe(0);
    expect(withTeacher.score).toBe(without.score);
    expect(withTeacher.level).toBe('low');
    // Continua informativo.
    expect(codes(withTeacher)).toContain('TEACHER_HISTORY_LOWER');
  });

  it('com boas notas o nivel nao muda', () => {
    const base = { components: [comp(50, 16), comp(50, null)] };
    const without = risk(base);
    const withTeacher = risk({ ...base, teacher: harshTeacher });
    expect(withTeacher.level).toBe(without.level);
    expect(withTeacher.level).toBe('low');
    expect(withTeacher.score - without.score).toBeLessThanOrEqual(1);
  });

  it('params convertidos para a escala da cadeira', () => {
    const r = risk({
      components: [comp(40, 7), comp(60, null)],
      teacher: harshTeacher,
    });
    expect(reason(r, 'TEACHER_HISTORY_LOWER')?.params).toEqual({
      teacher: 'Prof. Silva',
      withTeacher: 8,
      others: 15,
    });
  });

  it('com risco existente soma pouco (no maximo 5 pontos)', () => {
    const base = { components: [comp(40, 7), comp(60, null)] };
    const without = risk(base);
    const withTeacher = risk({ ...base, teacher: harshTeacher });
    expect(withTeacher.score).toBeGreaterThan(without.score);
    expect(withTeacher.score - without.score).toBeLessThanOrEqual(5);
    expect(codes(withTeacher)[0]).not.toBe('TEACHER_HISTORY_LOWER');
  });

  it('amostra pequena ou margem pequena e ignorada', () => {
    const base = { components: [comp(40, 7), comp(60, null)] };
    const small = risk({
      ...base,
      teacher: { ...harshTeacher, sampleWithTeacher: 2 },
    });
    const close = risk({
      ...base,
      teacher: { ...harshTeacher, avgWithTeacher: 0.7 },
    });
    expect(codes(small)).not.toContain('TEACHER_HISTORY_LOWER');
    expect(codes(close)).not.toContain('TEACHER_HISTORY_LOWER');
  });

  it('0-100: params na escala 0-100', () => {
    const r = risk({
      rules: { ...GENERIC_RULES, scaleMax: 100, passMark: 50 },
      components: [comp(40, 35), comp(60, null)],
      teacher: harshTeacher,
    });
    expect(reason(r, 'TEACHER_HISTORY_LOWER')?.params).toMatchObject({
      withTeacher: 40,
      others: 75,
    });
  });
});

describe('computeCourseRisk: regras custom', () => {
  it('[] nao muda nada face a regras sem customRules', () => {
    const components = [comp(40, 12, 'Teste 1'), comp(30, 7, 'Trabalho')];
    expect(
      risk({ rules: { ...STRICT_RULES, customRules: [] }, components }),
    ).toEqual(risk({ components }));
  });

  it('MAX_BELOW violado decide a continua, uma razao por regra', () => {
    const r = risk({
      rules: {
        ...GENERIC_RULES,
        hasExamTrack: true,
        customRules: [
          {
            kind: 'MAX_BELOW',
            threshold: 10,
            maxBelow: 0,
            labelContains: 'teste',
          },
          {
            kind: 'GROUP_AVG_MIN',
            threshold: 12,
            maxBelow: null,
            labelContains: 'Téste',
          },
          {
            kind: 'MAX_BELOW',
            threshold: 5,
            maxBelow: 0,
            labelContains: null,
          },
        ],
      },
      components: [
        comp(30, 9, 'TESTE 1'),
        comp(30, 13, 'teste 2'),
        comp(20, 18, 'Trabalho'),
      ],
    });
    expect(r.track).toBe('EXAM');
    expect(r.level).toBe('high');
    const custom = r.reasons.filter((x) => x.code === 'CUSTOM_RULE_VIOLATED');
    // Media do grupo = 11 < 12 viola; nada abaixo de 5.
    expect(custom.map((x) => x.params)).toEqual([
      { rule: 'max 0 < 10 "teste"' },
      { rule: 'avg >= 12 "Téste"' },
    ]);
  });

  it('sem violacao custom a continua continua aberta', () => {
    const r = risk({
      rules: {
        ...GENERIC_RULES,
        customRules: [
          {
            kind: 'GROUP_AVG_MIN',
            threshold: 10,
            maxBelow: null,
            labelContains: 'exame',
          },
        ],
      },
      components: [comp(50, 14, 'Teste 1')],
    });
    expect(r.track).toBe('CONTINUOUS');
    expect(codes(r)).not.toContain('CUSTOM_RULE_VIOLATED');
  });

  it('regras custom tiram a certeza de "nao pode chumbar"', () => {
    const components = [comp(80, 20, 'Teste 1')];
    const plain = risk({ rules: GENERIC_RULES, components });
    const custom = risk({
      rules: {
        ...GENERIC_RULES,
        customRules: [
          {
            kind: 'GROUP_AVG_MIN',
            threshold: 10,
            maxBelow: null,
            labelContains: 'exame',
          },
        ],
      },
      components,
    });
    expect(plain.score).toBe(0);
    expect(custom.score).toBeGreaterThan(0);
    expect(codes(custom)).toContain('REMAINING_UNCERTAINTY_BASIC');
  });
});

describe('computeCourseRisk: forma do resultado', () => {
  it('copia identidade da cadeira e mantem score 0-100', () => {
    const r = risk({ components: [comp(100, 0)] });
    expect(r).toMatchObject({
      areaId: 'area-1',
      areaName: 'Algebra',
      colorHex: '#7c3aed',
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('escala invalida devolve null', () => {
    expect(
      computeCourseRisk(
        input({
          rules: { ...GENERIC_RULES, scaleMin: 10, scaleMax: 10 },
          components: [comp(100, 10)],
        }),
      ),
    ).toBeNull();
  });
});
