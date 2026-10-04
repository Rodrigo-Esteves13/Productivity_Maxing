import {
  chooseModel,
  cleanSamples,
  fitGradeModel,
  fractionToGrade,
  gradeToFraction,
  marginalFractionGain,
  minutesForFraction,
  projectFraction,
  MIN_SAMPLES_COURSE,
  type GradeSample,
} from './grade-projection.util';

// nota ~ 0.35 + 0.18 * ln(1 + h) com um pouco de ruído determinístico
function makeSamples(hours: number[], noise: number[]): GradeSample[] {
  return hours.map((h, i) => ({
    minutes: h * 60,
    fraction: Math.min(
      1,
      Math.max(0, 0.35 + 0.18 * Math.log(1 + h) + noise[i]),
    ),
  }));
}

const HOURS = [1, 2, 3, 4, 6, 8, 10, 12];
const NOISE = [0.02, -0.03, 0.01, 0.03, -0.02, 0.0, 0.02, -0.01];

describe('fitGradeModel', () => {
  it('recupera uma relação positiva clara', () => {
    const outcome = fitGradeModel(
      makeSamples(HOURS, NOISE),
      MIN_SAMPLES_COURSE,
    );
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.model.slope).toBeGreaterThan(0.12);
    expect(outcome.model.slope).toBeLessThan(0.25);
    expect(outcome.model.rSquared).toBeGreaterThan(0.8);
  });

  it('recusa com poucas amostras', () => {
    const outcome = fitGradeModel(
      makeSamples([1, 2, 3], [0, 0, 0]),
      MIN_SAMPLES_COURSE,
    );
    expect(outcome).toEqual({ kind: 'not_enough_data', sampleSize: 3 });
  });

  it('diz "sem relação clara" quando a nota não depende do estudo', () => {
    const samples: GradeSample[] = HOURS.map((h, i) => ({
      minutes: h * 60,
      fraction: [0.7, 0.5, 0.75, 0.55, 0.72, 0.52, 0.7, 0.54][i],
    }));
    expect(fitGradeModel(samples, MIN_SAMPLES_COURSE).kind).toBe(
      'no_clear_link',
    );
  });

  it('diz "sem relação clara" quando mais estudo coincide com pior nota', () => {
    const samples: GradeSample[] = HOURS.map((h, i) => ({
      minutes: h * 60,
      fraction: 0.9 - i * 0.06,
    }));
    expect(fitGradeModel(samples, MIN_SAMPLES_COURSE).kind).toBe(
      'no_clear_link',
    );
  });

  it('sem variação no tempo de estudo nao inventa uma relação', () => {
    const samples: GradeSample[] = [0.5, 0.6, 0.7, 0.55, 0.65, 0.8].map(
      (fraction) => ({
        minutes: 120,
        fraction,
      }),
    );
    expect(fitGradeModel(samples, MIN_SAMPLES_COURSE).kind).toBe(
      'no_clear_link',
    );
  });

  it('ignora sessões esquecidas ligadas e ruído de poucos minutos', () => {
    const dirty = [
      ...makeSamples(HOURS, NOISE),
      { minutes: 5000, fraction: 0.1 },
      { minutes: 2, fraction: 0.9 },
    ];
    expect(cleanSamples(dirty)).toHaveLength(HOURS.length);
  });
});

describe('projectFraction', () => {
  const outcome = fitGradeModel(makeSamples(HOURS, NOISE), MIN_SAMPLES_COURSE);
  if (outcome.kind !== 'ok') throw new Error('modelo de teste devia ajustar');
  const model = outcome.model;

  it('mais estudo => nota esperada maior, com intervalo à volta', () => {
    const little = projectFraction(model, 60);
    const lot = projectFraction(model, 600);
    expect(lot.expected).toBeGreaterThan(little.expected);
    expect(little.low).toBeLessThanOrEqual(little.expected);
    expect(little.high).toBeGreaterThanOrEqual(little.expected);
  });

  it('nunca sai de 0..1', () => {
    const extreme = projectFraction(model, 100000);
    expect(extreme.high).toBeLessThanOrEqual(1);
    expect(projectFraction(model, 0).low).toBeGreaterThanOrEqual(0);
  });

  it('retornos decrescentes: a 1.ª hora extra vale mais do que a 10.ª', () => {
    const early = marginalFractionGain(model, 60, 60);
    const late = marginalFractionGain(model, 600, 60);
    expect(early).toBeGreaterThan(late);
  });
});

describe('minutesForFraction', () => {
  const outcome = fitGradeModel(makeSamples(HOURS, NOISE), MIN_SAMPLES_COURSE);
  if (outcome.kind !== 'ok') throw new Error('modelo de teste devia ajustar');
  const model = outcome.model;

  it('é o inverso da projeção: estudar esse tempo dá a nota pedida', () => {
    const target = 0.7;
    const minutes = minutesForFraction(model, target);
    expect(minutes).not.toBeNull();
    expect(projectFraction(model, minutes as number).expected).toBeCloseTo(
      target,
      1,
    );
  });

  it('nota mais alta pede mais tempo', () => {
    const a = minutesForFraction(model, 0.6) as number;
    const b = minutesForFraction(model, 0.75) as number;
    expect(b).toBeGreaterThan(a);
  });

  it('devolve null quando nem com o máximo de estudo se chega lá', () => {
    expect(minutesForFraction(model, 0.999)).toBeNull();
  });

  it('um alvo que já se atinge sem estudar pede 0', () => {
    expect(minutesForFraction(model, 0.01)).toBe(0);
  });
});

describe('escalas', () => {
  it('converte nota <-> fração em 0-20', () => {
    expect(gradeToFraction(15, { min: 0, max: 20 })).toBeCloseTo(0.75);
    expect(fractionToGrade(0.75, { min: 0, max: 20 })).toBeCloseTo(15);
  });
  it('funciona em 0-100', () => {
    expect(fractionToGrade(0.8, { min: 0, max: 100 })).toBeCloseTo(80);
  });
});

describe('chooseModel', () => {
  const overall = fitGradeModel(makeSamples(HOURS, NOISE), 6);

  it('usa o modelo da cadeira quando ajusta', () => {
    const chosen = chooseModel(makeSamples(HOURS, NOISE), overall);
    expect(chosen.basis).toBe('course');
    expect(chosen.outcome.kind).toBe('ok');
  });

  it('com poucos dados da cadeira cai no global', () => {
    const chosen = chooseModel(makeSamples([1, 2], [0, 0]), overall);
    expect(chosen.basis).toBe('overall');
    expect(chosen.outcome.kind).toBe('ok');
  });

  it('cadeira com relação fraca NÃO é salva pelo global', () => {
    const flat: GradeSample[] = HOURS.map((h, i) => ({
      minutes: h * 60,
      fraction: [0.7, 0.5, 0.75, 0.55, 0.72, 0.52, 0.7, 0.54][i],
    }));
    const chosen = chooseModel(flat, overall);
    expect(chosen.basis).toBe('course');
    expect(chosen.outcome.kind).toBe('no_clear_link');
  });
});
