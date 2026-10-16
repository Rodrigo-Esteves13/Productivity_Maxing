import {
  MIN_FOCUS_SAMPLES,
  fitFocusEffect,
  fitInterestEffect,
  type FocusSample,
} from './focus-effect.util';

// Ruido determinista (sem Math.random) para os testes nao serem instaveis.
const noise = (i: number, amplitude: number) =>
  Math.sin(i * 12.9898) * amplitude;

function build(
  count: number,
  focusOf: (i: number) => number,
  gradeOf: (focus: number, minutes: number, i: number) => number,
): FocusSample[] {
  return Array.from({ length: count }, (_, i) => {
    const minutes = 120 + ((i * 47) % 300);
    const focus = focusOf(i);
    return { minutes, focus, fraction: gradeOf(focus, minutes, i) };
  });
}

describe('fitFocusEffect', () => {
  it('pede mais dados quando ha poucas tasks', () => {
    const samples = build(
      MIN_FOCUS_SAMPLES - 1,
      (i) => 1 + (i % 5),
      () => 0.5,
    );
    expect(fitFocusEffect(samples).kind).toBe('not_enough_data');
  });

  it('nao mede nada se o foco foi sempre o mesmo', () => {
    const samples = build(
      12,
      () => 4,
      (_f, _m, i) => 0.5 + noise(i, 0.05),
    );
    expect(fitFocusEffect(samples).kind).toBe('no_variation');
  });

  it('deteta um efeito claro do foco na nota', () => {
    const samples = build(
      16,
      (i) => 1 + ((i * 3) % 5),
      (focus, _m, i) => 0.3 + 0.08 * focus + noise(i, 0.01),
    );
    const outcome = fitFocusEffect(samples);
    expect(outcome.kind).toBe('clear');
    if (outcome.kind === 'clear') {
      expect(outcome.effect).toBeGreaterThan(0.05);
      expect(outcome.low).toBeGreaterThan(0);
    }
  });

  it('diz inconclusivo quando as notas nao seguem o foco', () => {
    const samples = build(
      10,
      (i) => 1 + ((i * 3) % 5),
      (_f, _m, i) => 0.55 + noise(i, 0.2),
    );
    expect(fitFocusEffect(samples).kind).toBe('inconclusive');
  });

  it('ignora amostras invalidas (foco fora de 1..5, tempo irrelevante)', () => {
    const valid = build(
      10,
      (i) => 1 + ((i * 3) % 5),
      (f) => 0.3 + 0.08 * f,
    );
    const junk: FocusSample[] = [
      { minutes: 5, focus: 3, fraction: 0.5 },
      { minutes: 100, focus: 9, fraction: 0.5 },
      { minutes: 100, focus: 3, fraction: 2 },
    ];
    expect(fitFocusEffect([...valid, ...junk]).sampleSize).toBe(10);
  });
});

// 6 cadeiras com interesse diferente, 3 tasks cada.
function buildByArea(
  gradeOf: (focus: number, interest: number, i: number) => number,
): FocusSample[] {
  const interests = [1, 2, 3, 4, 5, 3];
  return Array.from({ length: 18 }, (_, i) => {
    const areaIndex = i % interests.length;
    const interest = interests[areaIndex];
    const focus = 1 + ((i * 2) % 5);
    return {
      minutes: 120 + ((i * 47) % 300),
      focus,
      interest,
      areaId: `area-${areaIndex}`,
      fraction: gradeOf(focus, interest, i),
    };
  });
}

describe('fitInterestEffect', () => {
  it('pede mais cadeiras quando so ha 3 com interesse', () => {
    const samples = buildByArea(() => 0.5).filter((s) =>
      ['area-0', 'area-1', 'area-2'].includes(s.areaId ?? ''),
    );
    expect(fitInterestEffect(samples).kind).toBe('not_enough_data');
  });

  it('ignora tasks sem interesse classificado', () => {
    const samples = buildByArea(() => 0.5).map((s) => ({
      ...s,
      interest: undefined,
    }));
    expect(fitInterestEffect(samples).kind).toBe('not_enough_data');
  });

  it('deteta o efeito do interesse a foco igual', () => {
    const samples = buildByArea(
      (focus, interest, i) =>
        0.2 + 0.03 * focus + 0.1 * interest + noise(i, 0.005),
    );
    const outcome = fitInterestEffect(samples);
    expect(outcome.kind).toBe('clear');
    if (outcome.kind === 'clear') expect(outcome.effect).toBeCloseTo(0.1, 1);
  });

  it('diz inconclusivo se as notas nao dependem do interesse', () => {
    const samples = buildByArea((_f, _int, i) => 0.55 + noise(i, 0.2));
    expect(fitInterestEffect(samples).kind).toBe('inconclusive');
  });
});
