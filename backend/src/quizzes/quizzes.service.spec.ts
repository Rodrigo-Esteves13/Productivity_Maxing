import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service';
import { QuizzesService } from './quizzes.service';
import {
  canonicalQuizText,
  checkQuizText,
  recheckCanonicalQuiz,
} from './quiz-check';
import {
  AttemptResultDto,
  ImportQuizDto,
  SubmitAttemptDto,
  UpdateQuizDto,
} from './dto/quiz.dto';
import { GENERATOR_KINDS } from './quiz-generators';
import { QUIZ_MAX_FILE_BYTES, QUIZ_MAX_QUESTIONS } from './quiz-format';
import {
  MAX_QUIZZES_PER_USER,
  QUIZ_IMPORT_BODY_LIMIT,
  QUIZ_QUESTION_MAX_TIME_MS,
} from './quizzes.constants';

// Tempo maximo (folgado) do caminho DTO + servico para ~1 MB de texto hostil.
const HOSTILE_IMPORT_MAX_MS = 300;
// Objeto largo do audit H1 (~110k chaves, ~1 MB): 4.4 s no class-transformer.
const WIDE_KEYS = 110_000;
const DEEP_NESTING = 200_000;
const PARALLEL_IMPORTS = 6;
const FREE_SLOTS = 2;

const QUESTION = {
  id: 'q1',
  topic: 'T',
  kind: 'single',
  prompt: 'Which protocol uses link-state?',
  options: ['RIP', 'OSPF', 'EIGRP'],
  answer: [1],
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

// Primeiro argumento da primeira chamada de um mock do Prisma.
const firstArg = (fn: jest.Mock) =>
  (fn.mock.calls[0] as [{ data?: unknown; where?: unknown }])[0];

// SQL de uma chamada a $queryRaw (template), com os valores a parte.
const rawCall = (fn: jest.Mock, n = 0) => {
  const [strings, ...values] = fn.mock.calls[n] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return { sql: strings.join('?').replace(/\s+/g, ' ').trim(), values };
};

function setup(opts: { count?: number; quiz?: unknown } = {}) {
  const prisma = {
    quiz: {
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'new', ...data }),
      ),
      findFirst: jest.fn().mockResolvedValue(opts.quiz ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: opts.quiz ? 1 : 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: opts.quiz ? 1 : 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    quizAttempt: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    // Linha trancada: o quiz existe (e e do dono) so quando ha opts.quiz.
    $queryRaw: jest.fn().mockResolvedValue(opts.quiz ? [{ id: 'quiz' }] : []),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  );
  const service = new QuizzesService(prisma as unknown as PrismaService);
  return { service, prisma };
}

// Texto canonico como o cliente o envia (canonicalQuizText de checkQuizText).
function canonical(raw: Record<string, unknown>): string {
  const report = checkQuizText(JSON.stringify(raw));
  if (!report.quiz) throw new Error('fixture did not pass the checks');
  return canonicalQuizText(report.quiz);
}

const DIAGRAM = {
  w: 200,
  h: 100,
  nodes: [
    { id: 'r1', kind: 'router', x: 20, y: 20, label: 'R1' },
    { id: 'r2', kind: 'router', x: 180, y: 20 },
  ],
  links: [{ from: 'r1', to: 'r2' }],
};

// Entradas sujas que o cliente aceita com avisos (HTML, http, partes de
// diagrama invalidas, perguntas saltadas): o canonico tem de passar.
const MESSY: Record<string, unknown>[] = [
  { title: '<b>OSPF</b>', questions: [QUESTION, { bad: true }] },
  {
    title: '  <i>Net</i>  ',
    topics: { T: '&amp;lt;b&amp;gt;Routing' },
    figures: { 'f 1': DIAGRAM, unused: DIAGRAM, svg: '<svg></svg>' },
    questions: [
      {
        ...QUESTION,
        prompt: '&lt;script&gt;x&lt;/script&gt;Which <b>one</b>?',
        figure: 'f1',
        sources: [
          { title: 'Plain', url: 'http://example.com/' },
          { url: 'javascript:alert(1)' },
          'https://example.org/a',
        ],
      },
      {
        ...QUESTION,
        prompt: 'Second question here',
        figure: { ...DIAGRAM, links: [{ from: 'r1', to: 'ghost' }] },
      },
    ],
  },
];

const BASE = canonical({ title: 'OSPF', questions: [QUESTION] });

async function expectRefused(quizJson: string) {
  const { service, prisma } = setup();
  await expect(service.import('u1', { quizJson })).rejects.toBeInstanceOf(
    BadRequestException,
  );
  expect(prisma.quiz.create).not.toHaveBeenCalled();
}

describe('QuizzesService import (strict canonical rule)', () => {
  it('stores the server re-check output for a canonical text', async () => {
    const { service, prisma } = setup();
    const text = canonical({
      title: 'OSPF',
      questions: [{ ...QUESTION, figure: 'f1' }],
      figures: { f1: DIAGRAM, unused: DIAGRAM },
    });
    const quiz = JSON.parse(text) as Record<string, unknown>;
    const result = await service.import('u1', { quizJson: text });
    expect(result.skipped).toBe(0);
    const data = firstArg(prisma.quiz.create).data as Record<string, unknown>;
    expect(data).toMatchObject({
      userId: 'u1',
      title: 'OSPF',
      questionCount: 1,
      questions: quiz.questions,
      figures: quiz.figures,
    });
    expect(Object.keys(data.figures as object)).toEqual(['f1']);
  });

  it('accepts the canonical output of messy inputs (round trip)', async () => {
    for (const raw of MESSY) {
      const first = checkQuizText(JSON.stringify(raw));
      expect(first.ok).toBe(true);
      expect(
        first.checks.some((c) => c.status !== 'pass') ||
          first.skipped.length > 0,
      ).toBe(true);
      const { service, prisma } = setup();
      const text = canonical(raw);
      const quiz = JSON.parse(text) as Record<string, unknown>;
      await service.import('u1', { quizJson: text });
      const data = firstArg(prisma.quiz.create).data as Record<string, unknown>;
      expect(data.questions).toEqual(quiz.questions);
      expect(data.figures).toEqual(quiz.figures);
    }
  });

  it('refuses tampered or non-canonical quizzes and stores nothing', async () => {
    const base = canonical(MESSY[1]);
    const copy = () =>
      JSON.parse(base) as {
        questions: Record<string, unknown>[];
        figures: Record<string, unknown>;
      } & Record<string, unknown>;
    const html = copy();
    html.questions[0].prompt = '<b>Which</b> one?';
    const script = copy();
    script.questions[0].explanation = '<script>alert(1)</script>';
    const extraFigure = copy();
    extraFigure.figures.extra = DIAGRAM;
    const rawFigure = copy();
    rawFigure.figures.f1 = '<svg onload="alert(1)"></svg>';
    const http = copy();
    http.questions[0].sources = [{ title: 'x', url: 'http://example.com/' }];
    const reordered = Object.fromEntries(Object.entries(copy()).reverse());
    const reorderedQuestion = copy();
    reorderedQuestion.questions[0] = Object.fromEntries(
      Object.entries(reorderedQuestion.questions[0]).reverse(),
    );
    const extraQuestionKey = copy();
    extraQuestionKey.questions[0].evil = 1;
    const noFormat = copy();
    delete noFormat.format;
    const wrongVersion = { ...copy(), version: 2 };
    const tampered: unknown[] = [
      { ...copy(), evil: 1 },
      html,
      script,
      extraFigure,
      rawFigure,
      http,
      reordered,
      reorderedQuestion,
      extraQuestionKey,
      noFormat,
      wrongVersion,
      MESSY[0],
      { questions: [] },
      {},
      [],
      null,
      'text',
    ];
    for (const payload of tampered)
      await expectRefused(JSON.stringify(payload));
    for (const text of ['', 'not json', '{"a":', base.slice(0, -1)])
      await expectRefused(text);
  });

  it('refuses every byte-level variant that JSON.parse would hide', async () => {
    const title = '"title":"OSPF"';
    const seconds = '"secondsPerQuestion":72';
    expect(BASE).toContain(title);
    expect(BASE).toContain(seconds);
    // Leem como o quiz canonico: so a comparacao byte a byte as recusa.
    const sameValue = [
      BASE.replace(title, `"title":"<script>x</script>",${title}`),
      BASE.replace(seconds, `${seconds}.0`),
      BASE.replace(seconds, '"secondsPerQuestion":7.2e1'),
      BASE.replace(seconds, '"secondsPerQuestion":72e0'),
      BASE.replace(title, '"title":"\\u004fSPF"'),
      BASE.replace(title, '"\\u0074itle":"OSPF"'),
      JSON.stringify(JSON.parse(BASE), null, 2),
      `${BASE}\n`,
      ` ${BASE}`,
    ];
    for (const text of sameValue) {
      expect(text).not.toBe(BASE);
      expect(recheckCanonicalQuiz(JSON.parse(text))).not.toBeNull();
      await expectRefused(text);
    }
    // Chaves com nome de prototipo, em cima e dentro de uma pergunta.
    const protoKeys = ['__proto__', 'constructor', 'toString', 'valueOf'];
    for (const key of protoKeys) {
      // Insere a chave logo a seguir ao '{' inicial do objeto de topo.
      await expectRefused(`{"${key}":{"x":1},${BASE.slice(1)}`);
      await expectRefused(BASE.replace('{"id"', `{"${key}":1,"id"`));
    }
    const reordered = JSON.stringify(
      Object.fromEntries(Object.entries(JSON.parse(BASE) as object).reverse()),
    );
    await expectRefused(reordered);
  });

  it('refuses hostile 1 MB texts fast, before any DB call', async () => {
    const wide = `{${Array.from(
      { length: WIDE_KEYS },
      (_, i) => `"${i.toString(36)}":1`,
    ).join(',')}}`;
    const deep = `{"a":${'['.repeat(DEEP_NESTING)}${']'.repeat(DEEP_NESTING)}}`;
    for (const quizJson of [wide, deep]) {
      expect(quizJson.length).toBeLessThanOrEqual(QUIZ_MAX_FILE_BYTES);
      const { service, prisma } = setup();
      const start = performance.now();
      const dto = (await pipe.transform(
        { quizJson },
        { type: 'body', metatype: ImportQuizDto },
      )) as ImportQuizDto;
      await expect(service.import('u1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(performance.now() - start).toBeLessThan(HOSTILE_IMPORT_MAX_MS);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('takes the quiz only as a string within the size limit', async () => {
    const run = (body: unknown) =>
      pipe.transform(body, { type: 'body', metatype: ImportQuizDto });
    await expect(run({ quizJson: BASE })).resolves.toEqual({ quizJson: BASE });
    // Um quiz no limite em bytes UTF-8 passa sempre o MaxLength (UTF-16).
    const multiByte = 'é'.repeat(QUIZ_MAX_FILE_BYTES / 2);
    expect(Buffer.byteLength(multiByte)).toBe(QUIZ_MAX_FILE_BYTES);
    await expect(run({ quizJson: multiByte })).resolves.toBeDefined();
    for (const body of [
      { quiz: JSON.parse(BASE) as object },
      { quizJson: BASE, quiz: {} },
      { quizJson: JSON.parse(BASE) as object },
      { quizJson: 'x'.repeat(QUIZ_MAX_FILE_BYTES + 1) },
      {},
    ])
      await expect(run(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fits any quiz within the size limit in the route body limit', () => {
    // Piores casos do escape JSON: cada " ou \ do texto ocupa 2 bytes.
    ['"', '\\', 'é', 'a'].forEach((char) => {
      const text = char.repeat(QUIZ_MAX_FILE_BYTES / Buffer.byteLength(char));
      const body = JSON.stringify({ quizJson: text });
      expect(Buffer.byteLength(body)).toBeLessThanOrEqual(
        QUIZ_IMPORT_BODY_LIMIT,
      );
    });
  });

  it('refuses an import past the per-user limit', async () => {
    const { service, prisma } = setup({ count: MAX_QUIZZES_PER_USER });
    await expect(
      service.import('u1', { quizJson: BASE }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.quiz.create).not.toHaveBeenCalled();
  });

  it('never passes the per-user limit with parallel imports', async () => {
    const { service, prisma } = setup();
    let stored = MAX_QUIZZES_PER_USER - FREE_SLOTS;
    prisma.quiz.count.mockImplementation(() => Promise.resolve(stored));
    prisma.quiz.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        stored += 1;
        return { id: `new-${stored}`, ...data };
      },
    );
    // Como a BD com a linha do utilizador trancada: uma transacao de cada vez.
    let queue: Promise<unknown> = Promise.resolve();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const run = queue.then(() => fn(prisma));
        queue = run.catch(() => undefined);
        return run;
      },
    );
    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL_IMPORTS }, () =>
        service.import('u1', { quizJson: BASE }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(
      FREE_SLOTS,
    );
    results
      .filter((r) => r.status === 'rejected')
      .forEach((r) => expect(r.reason).toBeInstanceOf(BadRequestException));
    expect(stored).toBe(MAX_QUIZZES_PER_USER);
    // A tranca vem antes da contagem, dentro da mesma transacao.
    const lock = rawCall(prisma.$queryRaw);
    expect(lock.sql).toBe(
      'SELECT "id" FROM "User" WHERE "id" = ? FOR NO KEY UPDATE',
    );
    expect(lock.values).toEqual(['u1']);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.quiz.count.mock.invocationCallOrder[0],
    );
  });

  it('reads stored figures back through the diagram validation', async () => {
    const diagram = (
      JSON.parse(
        canonical({
          questions: [{ ...QUESTION, figure: 'f1' }],
          figures: { f1: DIAGRAM },
        }),
      ) as { figures: Record<string, unknown> }
    ).figures;
    const { service } = setup({
      quiz: {
        id: 'quiz',
        questions: [QUESTION],
        figures: {
          f1: diagram.f1,
          toString: diagram.f1,
          old: '<svg viewBox="0 0 10 10"></svg>',
          broken: { w: '200', h: 100, nodes: [] },
        },
        stats: JSON.parse(
          '{"__proto__":{"seen":5},"q1":{"seen":1,"correct":1,"last":true}}',
        ) as unknown,
      },
    });
    const out = await service.get('u1', 'quiz');
    expect(out.figures).toEqual({ f1: diagram.f1 });
    expect(Object.keys(out.stats)).toEqual(['q1']);
  });
});

describe('QuizzesService', () => {
  it('scopes every read and write to the owner (404 for others)', async () => {
    const { service, prisma } = setup();
    await expect(service.get('u2', 'quiz')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update('u2', 'quiz', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('u2', 'quiz')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.submitAttempt('u2', 'quiz', {
        mode: 'EXAM',
        durationMs: 1,
        results: [{ questionId: 'q1', correct: true }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.quiz.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'quiz', userId: 'u2' } }),
    );
    expect(rawCall(prisma.$queryRaw).values).toEqual(['quiz', 'u2']);
    expect(firstArg(prisma.quiz.updateMany).where).toEqual({
      id: 'quiz',
      userId: 'u2',
    });
    expect(firstArg(prisma.quiz.deleteMany).where).toEqual({
      id: 'quiz',
      userId: 'u2',
    });
    expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
  });

  it('records an attempt only for known, unique question ids', async () => {
    const { service, prisma } = setup({
      quiz: {
        questions: [QUESTION],
        stats: { q1: { seen: 1, correct: 1, last: true } },
      },
    });
    const out = await service.submitAttempt('u1', 'quiz', {
      mode: 'PRACTICE',
      durationMs: 1000,
      results: [
        { questionId: 'q1', correct: false },
        { questionId: 'q1', correct: true },
        { questionId: 'ghost', correct: true },
      ],
    });
    expect({ ...out.stats }).toMatchObject({
      q1: { seen: 2, correct: 1, last: false },
    });
    expect(out.lastScorePct).toBe(0);
    expect(firstArg(prisma.quizAttempt.create).data).toMatchObject({
      total: 1,
      correct: 0,
      userId: 'u1',
    });
  });

  it('locks the quiz row before reading the stats', async () => {
    const { service, prisma } = setup({
      quiz: { questions: [QUESTION], stats: {} },
    });
    await service.submitAttempt('u1', 'quiz', {
      mode: 'EXAM',
      durationMs: 1,
      results: [{ questionId: 'q1', correct: true }],
    });
    const lock = rawCall(prisma.$queryRaw);
    expect(lock.sql).toBe(
      'SELECT "id" FROM "Quiz" WHERE "id" = ? AND "userId" = ? FOR UPDATE',
    );
    expect(lock.values).toEqual(['quiz', 'u1']);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.quiz.findFirst.mock.invocationCallOrder[0],
    );
  });

  it('never loses a stats update with parallel attempts', async () => {
    let stats: unknown = {};
    const { service, prisma } = setup({ quiz: { questions: [QUESTION] } });
    prisma.quiz.findFirst.mockImplementation(() =>
      Promise.resolve({ questions: [QUESTION], stats }),
    );
    prisma.quiz.update.mockImplementation(
      async ({ data }: { data: { stats: unknown } }) => {
        await Promise.resolve();
        stats = data.stats;
        return {};
      },
    );
    // Como a BD com a linha do quiz trancada: uma transacao de cada vez.
    let queue: Promise<unknown> = Promise.resolve();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const run = queue.then(() => fn(prisma));
        queue = run.catch(() => undefined);
        return run;
      },
    );
    const attempt = (correct: boolean) =>
      service.submitAttempt('u1', 'quiz', {
        mode: 'PRACTICE',
        durationMs: 1,
        results: [{ questionId: 'q1', correct }],
      });
    await Promise.all([attempt(true), attempt(false), attempt(true)]);
    expect(stats).toMatchObject({ q1: { seen: 3, correct: 2, last: true } });
  });

  it('keeps stats right for ids named like Object.prototype members', async () => {
    const questions = ['toString', 'valueOf', 'hasOwnProperty'].map(
      (id, i) => ({ ...QUESTION, id, prompt: `Prompt number ${i}` }),
    );
    const { service, prisma } = setup({
      quiz: {
        questions,
        stats: { valueOf: { seen: 2, correct: 1, last: false } },
      },
    });
    const out = await service.submitAttempt('u1', 'quiz', {
      mode: 'PRACTICE',
      durationMs: 1,
      results: questions.map((q) => ({ questionId: q.id, correct: true })),
    });
    const expected = {
      toString: { seen: 1, correct: 1, last: true },
      valueOf: { seen: 3, correct: 2, last: true },
      hasOwnProperty: { seen: 1, correct: 1, last: true },
    };
    expect({ ...out.stats }).toMatchObject(expected);
    const written = firstArg(prisma.quiz.update).data as { stats: unknown };
    expect(JSON.parse(JSON.stringify(written.stats))).toMatchObject(expected);
  });

  it('defaults planned to the accepted results and never goes below it', async () => {
    const quiz = { questions: [QUESTION], stats: {} };
    const results = [{ questionId: 'q1', correct: true }];
    const a = setup({ quiz });
    await a.service.submitAttempt('u1', 'quiz', {
      mode: 'PRACTICE',
      durationMs: 1,
      results,
    });
    expect(firstArg(a.prisma.quizAttempt.create).data).toMatchObject({
      planned: 1,
    });
    const b = setup({ quiz });
    await b.service.submitAttempt('u1', 'quiz', {
      mode: 'PRACTICE',
      durationMs: 1,
      planned: 0,
      results,
    });
    expect(firstArg(b.prisma.quizAttempt.create).data).toMatchObject({
      planned: 1,
    });
  });

  it('keeps planned above results but never above the quiz size', async () => {
    const questions = [1, 2, 3].map((n) => ({
      ...QUESTION,
      id: `q${n}`,
      prompt: `Prompt number ${n}`,
    }));
    const plannedFor = async (planned: number) => {
      const { service, prisma } = setup({ quiz: { questions, stats: {} } });
      await service.submitAttempt('u1', 'quiz', {
        mode: 'PRACTICE',
        durationMs: 1,
        planned,
        results: [{ questionId: 'q1', correct: true }],
      });
      return (firstArg(prisma.quizAttempt.create).data as { planned: number })
        .planned;
    };
    expect(await plannedFor(2)).toBe(2);
    expect(await plannedFor(QUIZ_MAX_QUESTIONS)).toBe(questions.length);
  });

  it('validates the planned field of an attempt', async () => {
    const errorsOf = async (planned: unknown) =>
      (
        await validate(
          plainToInstance(SubmitAttemptDto, {
            mode: 'EXAM',
            durationMs: 1,
            results: [{ questionId: 'q1', correct: true }],
            planned,
          }),
        )
      ).map((e) => e.property);
    expect(await errorsOf(undefined)).toEqual([]);
    expect(await errorsOf(QUIZ_MAX_QUESTIONS)).toEqual([]);
    expect(await errorsOf(0)).toEqual(['planned']);
    expect(await errorsOf(QUIZ_MAX_QUESTIONS + 1)).toEqual(['planned']);
  });

  it('refuses an attempt with no known questions', async () => {
    const { service } = setup({ quiz: { questions: [QUESTION], stats: {} } });
    await expect(
      service.submitAttempt('u1', 'quiz', {
        mode: 'EXAM',
        durationMs: 1,
        results: [{ questionId: 'x', correct: true }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const OWNER_QUIZ = (stats: unknown) => ({ questions: [QUESTION], stats });
const NOW = 1_700_000_000_000;
const EARLIER = 1_600_000_000_000;
const THIRTY = 30;
const STATS_ID = 'q1';

// Estatisticas gravadas pela primeira chamada de quiz.update.
const savedStats = (prisma: { quiz: { update: jest.Mock } }) =>
  (firstArg(prisma.quiz.update).data as { stats: Record<string, unknown> })
    .stats;

const attemptOf = (results: AttemptResultDto[]) => ({
  mode: 'PRACTICE' as const,
  durationMs: 1,
  results,
});

describe('QuizzesService stats (time, wrong area)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads old rows with defaults and invalid numbers as 0', async () => {
    const { service } = setup({
      quiz: {
        id: 'quiz',
        stats: {
          old: { seen: 2, correct: 1, last: true },
          bad: {
            seen: -1,
            correct: 1.5,
            last: 'yes',
            timeMs: Number.MAX_SAFE_INTEGER + 2,
            timed: '3',
            lastAt: null,
            wrongAt: [1],
            dismissed: 1,
          },
        },
      },
    });
    const out = await service.get('u1', 'quiz');
    expect({ ...out.stats }).toEqual({
      old: {
        seen: 2,
        correct: 1,
        last: true,
        timeMs: 0,
        timed: 0,
        lastAt: 0,
        wrongAt: 0,
        dismissed: false,
      },
      bad: {
        seen: 0,
        correct: 0,
        last: false,
        timeMs: 0,
        timed: 0,
        lastAt: 0,
        wrongAt: 0,
        dismissed: false,
      },
    });
  });

  it('accumulates timeMs and counts only answers that carry it', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const { service } = setup({
      quiz: OWNER_QUIZ({
        q1: { seen: 1, correct: 1, last: true, timeMs: 500, timed: 1 },
      }),
    });
    const out = await service.submitAttempt(
      'u1',
      'quiz',
      attemptOf([{ questionId: 'q1', correct: true, timeMs: 700 }]),
    );
    expect(out.stats.q1).toMatchObject({ timeMs: 1200, timed: 2, lastAt: NOW });
    const b = setup({ quiz: OWNER_QUIZ({}) });
    const noTime = await b.service.submitAttempt(
      'u1',
      'quiz',
      attemptOf([{ questionId: 'q1', correct: true }]),
    );
    expect(noTime.stats.q1).toMatchObject({ timeMs: 0, timed: 0 });
  });

  it('caps the per-answer timeMs through the DTO', async () => {
    const errorsOf = async (timeMs: unknown) =>
      (
        await validate(
          plainToInstance(SubmitAttemptDto, {
            mode: 'EXAM',
            durationMs: 1,
            results: [{ questionId: 'q1', correct: true, timeMs }],
          }),
        )
      ).length;
    expect(QUIZ_QUESTION_MAX_TIME_MS).toBe(THIRTY * 60 * 1000);
    expect(await errorsOf(undefined)).toBe(0);
    expect(await errorsOf(0)).toBe(0);
    expect(await errorsOf(QUIZ_QUESTION_MAX_TIME_MS)).toBe(0);
    expect(await errorsOf(QUIZ_QUESTION_MAX_TIME_MS + 1)).toBe(1);
    expect(await errorsOf(-1)).toBe(1);
    expect(await errorsOf(1.5)).toBe(1);
    expect(await errorsOf('9')).toBe(1);
  });

  it('sets wrongAt on a wrong answer and resets dismissed', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const stat = {
      seen: 1,
      correct: 0,
      last: false,
      wrongAt: EARLIER,
      lastAt: EARLIER,
      dismissed: true,
    };
    const wrong = setup({ quiz: OWNER_QUIZ({ q1: stat }) });
    const a = await wrong.service.submitAttempt(
      'u1',
      'quiz',
      attemptOf([{ questionId: 'q1', correct: false }]),
    );
    expect(a.stats.q1).toMatchObject({
      wrongAt: NOW,
      lastAt: NOW,
      dismissed: false,
    });
    const right = setup({ quiz: OWNER_QUIZ({ q1: stat }) });
    const b = await right.service.submitAttempt(
      'u1',
      'quiz',
      attemptOf([{ questionId: 'q1', correct: true }]),
    );
    expect(b.stats.q1).toMatchObject({
      wrongAt: EARLIER,
      lastAt: NOW,
      dismissed: true,
      last: true,
    });
  });
});

describe('QuizzesService clear and dismiss endpoints', () => {
  const stats = {
    q1: { seen: 2, correct: 1, last: false },
    q2: { seen: 1, correct: 1, last: true },
  };

  it('are owner only: 404 and nothing written for another user', async () => {
    const { service, prisma } = setup();
    await expect(service.clearAttempts('u2', 'quiz')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.clearStats('u2', 'quiz')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.dismissWrong('u2', 'quiz')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.dismissWrongOne('u2', 'quiz', STATS_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rawCall(prisma.$queryRaw, 3).values).toEqual(['quiz', 'u2']);
    expect(prisma.quiz.update).not.toHaveBeenCalled();
    expect(prisma.quizAttempt.deleteMany).not.toHaveBeenCalled();
  });

  it('lock the quiz row before reading', async () => {
    const calls = [
      (s: QuizzesService) => s.clearAttempts('u1', 'quiz'),
      (s: QuizzesService) => s.clearStats('u1', 'quiz'),
      (s: QuizzesService) => s.dismissWrong('u1', 'quiz'),
      (s: QuizzesService) => s.dismissWrongOne('u1', 'quiz', 'q1'),
    ];
    for (const call of calls) {
      const { service, prisma } = setup({ quiz: { stats } });
      await call(service);
      expect(rawCall(prisma.$queryRaw).sql).toBe(
        'SELECT "id" FROM "Quiz" WHERE "id" = ? AND "userId" = ? FOR UPDATE',
      );
      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.quiz.findFirst.mock.invocationCallOrder[0],
      );
    }
  });

  it('clearAttempts deletes this quiz attempts and nulls lastScorePct', async () => {
    const { service, prisma } = setup({ quiz: { stats } });
    await service.clearAttempts('u1', 'quiz');
    expect(firstArg(prisma.quizAttempt.deleteMany).where).toEqual({
      quizId: 'quiz',
      userId: 'u1',
    });
    expect(firstArg(prisma.quiz.update).data).toEqual({ lastScorePct: null });
  });

  it('clearStats writes an empty stats object', async () => {
    const { service, prisma } = setup({ quiz: { stats } });
    await service.clearStats('u1', 'quiz');
    expect(savedStats(prisma)).toEqual({});
  });

  it('dismissWrong flags only the stats with last === false', async () => {
    const { service, prisma } = setup({ quiz: { stats } });
    await service.dismissWrong('u1', 'quiz');
    const out = savedStats(prisma) as Record<string, { dismissed: boolean }>;
    expect(out.q1.dismissed).toBe(true);
    expect(out.q2.dismissed).toBe(false);
  });

  it('dismissWrongOne flags one stat and keeps the rest', async () => {
    const { service, prisma } = setup({ quiz: { stats } });
    await service.dismissWrongOne('u1', 'quiz', 'q1');
    const out = savedStats(prisma) as Record<string, { dismissed: boolean }>;
    expect(out.q1.dismissed).toBe(true);
    expect(out.q2.dismissed).toBe(false);
  });

  it('dismissWrongOne refuses unknown, reserved and malformed ids', async () => {
    const { service, prisma } = setup({
      quiz: {
        stats: { ...stats, toString: { seen: 1, correct: 0, last: false } },
      },
    });
    for (const id of [
      'ghost',
      '__proto__',
      'constructor',
      'toString',
      'valueOf',
    ]) {
      await expect(
        service.dismissWrongOne('u1', 'quiz', id),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
    for (const id of ['', 'a b', 'x'.repeat(49), '../q1']) {
      expect(() => service.dismissWrongOne('u1', 'quiz', id)).toThrow(
        BadRequestException,
      );
    }
    expect(prisma.quiz.update).not.toHaveBeenCalled();
  });
});

describe('QuizzesService generators', () => {
  const owner = (generators: unknown, stats: unknown = {}) => ({
    questions: [QUESTION],
    generators,
    stats,
  });
  const GEN_REPEATS = 3;

  it('get returns only known kinds, unique, in enum order', async () => {
    const { service } = setup({
      quiz: {
        figures: {},
        stats: {},
        generators: ['ospfCost', 'bogus', 'wildcard', 'ospfCost', 7],
      },
    });
    const out = await service.get('u1', 'quiz');
    expect(out.generators).toEqual(['wildcard', 'ospfCost']);
  });

  it('get returns an empty list for rows without generators', async () => {
    const { service } = setup({ quiz: { figures: {}, stats: {} } });
    expect((await service.get('u1', 'quiz')).generators).toEqual([]);
  });

  it('update dedupes generators and keeps the enum order', async () => {
    const { service, prisma } = setup({ quiz: {} });
    const out = await service.update('u1', 'quiz', {
      generators: ['summarize', 'wildcard', 'summarize'],
    });
    expect(out).toEqual({ id: 'quiz', generators: ['wildcard', 'summarize'] });
    expect(firstArg(prisma.quiz.updateMany).data).toEqual({
      generators: ['wildcard', 'summarize'],
    });
  });

  it('update changes title and generators together or alone', async () => {
    const { service, prisma } = setup({ quiz: {} });
    await service.update('u1', 'quiz', { title: ' New ', generators: [] });
    expect(firstArg(prisma.quiz.updateMany).data).toEqual({
      title: 'New',
      generators: [],
    });
  });

  it('update with neither title nor generators is a 400', async () => {
    const { service, prisma } = setup({ quiz: {} });
    await expect(service.update('u1', 'quiz', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.quiz.updateMany).not.toHaveBeenCalled();
  });

  it('validates the generators field through the DTO', async () => {
    const errorsOf = async (body: Record<string, unknown>) =>
      (await validate(plainToInstance(UpdateQuizDto, body))).map(
        (e) => e.property,
      );
    expect(await errorsOf({ generators: ['wildcard'] })).toEqual([]);
    expect(await errorsOf({ title: 'x' })).toEqual([]);
    expect(await errorsOf({ generators: [...GENERATOR_KINDS] })).toEqual([]);
    expect(await errorsOf({ generators: ['nope'] })).toEqual(['generators']);
    expect(await errorsOf({ generators: ['wildcard', 'wildcard'] })).toEqual([
      'generators',
    ]);
    expect(
      await errorsOf({ generators: [...GENERATOR_KINDS, 'wildcard'] }),
    ).toEqual(['generators']);
    expect(await errorsOf({ generators: 'wildcard' })).toEqual(['generators']);
    expect(await errorsOf({ title: '' })).toEqual(['title']);
  });

  it('counts every repeated gen key as one answer in stats and attempt', async () => {
    const { service, prisma } = setup({ quiz: owner(['wildcard']) });
    const out = await service.submitAttempt('u1', 'quiz', {
      mode: 'PRACTICE',
      durationMs: 1,
      results: [
        { questionId: 'gen-wildcard', correct: true, timeMs: 1000 },
        { questionId: 'gen-wildcard', correct: false, timeMs: 2000 },
        { questionId: 'gen-wildcard', correct: true },
        { questionId: 'q1', correct: true },
        { questionId: 'q1', correct: false },
      ],
    });
    expect({ ...out.stats }).toMatchObject({
      'gen-wildcard': {
        seen: GEN_REPEATS,
        correct: 2,
        last: true,
        timeMs: 3000,
        timed: 2,
      },
      q1: { seen: 1, correct: 1 },
    });
    expect(firstArg(prisma.quizAttempt.create).data).toMatchObject({
      total: GEN_REPEATS + 1,
      correct: 3,
    });
    expect(out.lastScorePct).toBe(75);
  });

  it('ignores a gen key of a kind that is not enabled', async () => {
    const { service, prisma } = setup({ quiz: owner(['wildcard']) });
    const out = await service.submitAttempt('u1', 'quiz', {
      mode: 'PRACTICE',
      durationMs: 1,
      results: [
        { questionId: 'gen-ospfCost', correct: true },
        { questionId: 'gen-wildcard', correct: true },
        { questionId: 'gen-bogus', correct: true },
      ],
    });
    expect(Object.keys(out.stats)).toEqual(['gen-wildcard']);
    expect(firstArg(prisma.quizAttempt.create).data).toMatchObject({
      total: 1,
    });
  });

  it('refuses an attempt of only disabled gen keys', async () => {
    const { service } = setup({ quiz: owner([]) });
    await expect(
      service.submitAttempt('u1', 'quiz', {
        mode: 'PRACTICE',
        durationMs: 1,
        results: [{ questionId: 'gen-wildcard', correct: true }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
