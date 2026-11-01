import { PRESET_PT_PT_ISMAI, presetRules } from './presets';
import { futureGradeModel, passCeilingPct } from './pass-probability';
import { computeCourseRisk } from './risk-engine';
import type {
  ApprovalRules,
  CourseRisk,
  CourseRiskInput,
  RiskComponentInput,
} from './approval-rules.types';

const ISMAI = presetRules(PRESET_PT_PT_ISMAI);
const NO_SITTINGS = { ...ISMAI, hasExamTrack: false, hasResitTrack: false };
const comp = (
  weightPct: number,
  grade: number | null,
  label = `C${weightPct}`,
): RiskComponentInput => ({ label, weightPct, grade });

function risk(
  components: RiskComponentInput[],
  rules: ApprovalRules = ISMAI,
): CourseRisk {
  const input: CourseRiskInput = {
    areaId: 'a',
    areaName: 'A',
    colorHex: '#7c3aed',
    rules,
    components,
    studiedMinutes: null,
    estimatedMinutes: null,
    absenceSharePct: null,
    absenceLimitPct: null,
    postponedCount: 0,
    teacher: null,
  };
  const result = computeCourseRisk(input);
  if (result === null) throw new Error('expected a verdict');
  return result;
}
const passOf = (r: CourseRisk) => 100 - r.score;

const codesOf = (r: CourseRisk) => r.reasons.map((x) => x.code);

describe('pessimismo: peso por avaliar nunca da certeza', () => {
  it('15.5 de media com 50% por avaliar fica bem abaixo de 99%', () => {
    const r = risk([
      comp(25, 15),
      comp(25, 16),
      comp(25, null),
      comp(25, null),
    ]);
    expect(passOf(r)).toBeLessThanOrEqual(passCeilingPct(50));
    expect(passOf(r)).toBeLessThan(90);
    expect(r.level).toBe('low');
    expect(r.score).toBeGreaterThan(0);
    expect(codesOf(r)).toContain('REMAINING_UNCERTAINTY');
    expect(
      r.reasons.find((x) => x.code === 'REMAINING_UNCERTAINTY')?.params,
    ).toEqual({ remaining: 50, count: 2, min: 6, second: 8, max: 1 });
  });

  it('sem minimo nem limiar nas regras usa o aviso generico', () => {
    const generic = {
      ...ISMAI,
      componentMinGrade: null,
      secondThreshold: null,
    };
    const r = risk([comp(50, 15.5), comp(50, null)], generic);
    expect(codesOf(r)).toContain('REMAINING_UNCERTAINTY_BASIC');
    expect(codesOf(r)).not.toContain('REMAINING_UNCERTAINTY');
  });

  it('so com minimo por componente usa a variante MIN', () => {
    const minOnly = {
      ...ISMAI,
      secondThreshold: null,
      maxBelowSecondThreshold: null,
    };
    const r = risk([comp(50, 15.5), comp(50, null)], minOnly);
    expect(codesOf(r)).toContain('REMAINING_UNCERTAINTY_MIN');
  });

  it('o risco de falha externa cresce com o peso: dividir nao o multiplica', () => {
    const graded = [comp(25, 15), comp(25, 16)];
    const ten = passOf(
      risk(
        [...graded, ...Array.from({ length: 10 }, () => comp(5, null))],
        NO_SITTINGS,
      ),
    );
    const one = passOf(risk([...graded, comp(50, null)], NO_SITTINGS));
    expect(one - ten).toBeLessThan(25);
  });

  it('chumbo decidido sem prova unica da 0% de chance', () => {
    const r = risk([comp(70, 6), comp(30, null)], NO_SITTINGS);
    expect(r.score).toBe(100);
    expect(passOf(r)).toBe(0);
  });

  it('o mesmo com 50% ainda nao alocado a componentes assume componentes', () => {
    const r = risk([comp(50, 15.5)]);
    expect(passOf(r)).toBeLessThan(90);
    expect(
      r.reasons.find((x) => x.code === 'REMAINING_UNCERTAINTY')?.params.count,
    ).toBe(2);
  });

  it('quanto menos por avaliar, mais perto de 100 (teto desce com o peso)', () => {
    const little = passOf(risk([comp(45, 15), comp(45, 16), comp(10, null)]));
    const half = passOf(risk([comp(25, 15), comp(25, 16), comp(50, null)]));
    expect(little).toBeGreaterThan(half);
    expect(little).toBeLessThanOrEqual(passCeilingPct(10));
    expect(little).toBeLessThan(100);
  });

  it('sem peso por avaliar e regras cumpridas pode chegar a 100', () => {
    const r = risk([comp(50, 15), comp(50, 16)]);
    expect(passOf(r)).toBe(100);
    expect(r.reasons).toEqual([]);
  });

  it('6 num componente a 70% continua extremo', () => {
    const r = risk([comp(70, 6), comp(30, null)]);
    expect(r.level).toBe('extreme');
    expect(passOf(r)).toBeLessThan(25);
  });

  it('muitos componentes pequenos nunca arriscam menos do que um unico (sem prova unica)', () => {
    const graded = [comp(25, 15), comp(25, 16)];
    const small = Array.from({ length: 10 }, () => comp(5, null));
    const many = passOf(risk([...graded, ...small], NO_SITTINGS));
    const one = passOf(risk([...graded, comp(50, null)], NO_SITTINGS));
    expect(many).toBeLessThanOrEqual(one);
  });

  it('sem historico (uma nota) o prior pessimista pesa mais do que com tres', () => {
    const one = futureGradeModel([{ grade: 15.5, share: 0.6 }], NO_SITTINGS);
    const three = futureGradeModel(
      [1, 2, 3].map(() => ({ grade: 15.5, share: 0.2 })),
      NO_SITTINGS,
    );
    expect(one.mean).toBeLessThan(three.mean);
    expect(one.mean).toBeLessThan(15.5);
    expect(one.sd).toBe(three.sd);
  });

  it('a prova unica (exame e recurso) so atenua, nao elimina o risco', () => {
    const graded = [comp(25, 15), comp(25, 16), comp(25, null), comp(25, null)];
    const withSittings = passOf(risk(graded, ISMAI));
    const without = passOf(risk(graded, NO_SITTINGS));
    expect(withSittings).toBeGreaterThanOrEqual(without);
    expect(withSittings).toBeLessThan(100);
  });

  it('subir uma nota nunca baixa a chance de passar', () => {
    const base = [comp(25, 15), comp(25, 16), comp(50, null)];
    const better = [comp(25, 20), comp(25, 16), comp(50, null)];
    expect(passOf(risk(better, NO_SITTINGS))).toBeGreaterThanOrEqual(
      passOf(risk(base, NO_SITTINGS)),
    );
  });

  it('sem regras duras e com passagem garantida mesmo a zero no resto: sem risco', () => {
    const noRules = {
      ...ISMAI,
      componentMinGrade: null,
      secondThreshold: null,
      maxBelowSecondThreshold: null,
    };
    const r = risk([comp(90, 20), comp(10, null)], noRules);
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it('e deterministico: a mesma entrada da sempre o mesmo score', () => {
    const input = [comp(30, 14), comp(30, 12), comp(40, null)];
    expect(risk(input).score).toBe(risk(input).score);
  });
});
