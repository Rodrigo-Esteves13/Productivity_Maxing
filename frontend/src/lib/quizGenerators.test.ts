import { describe, expect, it } from 'vitest';
import { quizGenerators } from '../i18n/messages/en/quizGenerators';
import { checkQuizText } from './quizImport';
import { sanitizeQuizDiagram } from './quizDiagram';
import { EMPTY_RESPONSE, QUIZ_FORMAT_ID, type QuizQuestion } from './quizFormat';
import { answerKeyItem, gradeQuestion, normalizeTyped } from './quizSession';
import {
  electDrBdr,
  generatedId,
  generateQuestion,
  GENERATOR_KINDS,
  GENERATOR_MAX_SEED,
  generatorStatKey,
  ipToNumber,
  isGeneratorKind,
  matchesWildcard,
  mulberry32,
  networkOf,
  newSeed,
  numberToIp,
  ospfCost,
  parseGeneratedId,
  prefixMask,
  prefixWildcard,
  spfPaths,
  statKeyOf,
  summarizeNetworks,
  toBinaryOctet,
  type Translate,
} from './quizGenerators';

// Tradutor de teste: chave em falta rebenta (todas as chaves usadas existem em ingles).
const t: Translate = (key, params) => {
  if (!Object.hasOwn(quizGenerators, key)) throw new Error(`missing key ${key}`);
  return quizGenerators[key].replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!params || params[name] === undefined) throw new Error(`missing param ${name} in ${key}`);
    return String(params[name]);
  });
};

const SEEDS = Array.from({ length: 200 }, (_, i) => 1 + i * 7919);

function importOne(question: QuizQuestion, figure: unknown) {
  const quiz = {
    format: QUIZ_FORMAT_ID,
    title: 'Generated',
    language: 'en',
    topics: [question.topic],
    questions: [question],
    figures: figure ? { [question.id]: figure } : {},
  };
  return checkQuizText(JSON.stringify(quiz));
}

describe('quizGenerators: every kind, 200 seeds', () => {
  GENERATOR_KINDS.forEach((kind) => {
    it(`${kind} is valid, deterministic and gradable`, () => {
      SEEDS.forEach((seed) => {
        const { question: q, figure } = generateQuestion(kind, seed, t);
        expect(generateQuestion(kind, seed, t)).toEqual({ question: q, figure });
        expect(q.id).toBe(generatedId(kind, seed));
        expect(q.id).toMatch(/^[\w-]{1,48}$/);
        expect(q.topic).toBe(quizGenerators[`quizGen.${kind}.name`]);
        expect(q.sources).toEqual([]);

        const report = importOne(q, figure);
        expect(report.ok).toBe(true);
        expect(report.skipped).toEqual([]);
        expect(report.checks.every((c) => c.status === 'pass')).toBe(true);
        expect(report.quiz?.questions[0]).toEqual(q);

        expect(gradeQuestion(q, answerKeyItem(q).response)).toBe(true);
        if (q.kind === 'typed') {
          expect(q.accepted.length).toBeGreaterThan(0);
          expect(new Set(q.accepted.map(normalizeTyped)).size).toBe(q.accepted.length);
          expect(gradeQuestion(q, { ...EMPTY_RESPONSE, text: q.accepted[0] })).toBe(true);
          expect(gradeQuestion(q, { ...EMPTY_RESPONSE, text: 'wrong' })).toBe(false);
        } else {
          expect(new Set(q.options.map(normalizeTyped)).size).toBe(q.options.length);
          q.options.forEach((_, i) => {
            if (!q.answer.includes(i)) expect(gradeQuestion(q, { ...EMPTY_RESPONSE, selected: [i] })).toBe(false);
          });
        }

        if (kind === 'spfPath') {
          expect(q.figure).toBe(q.id);
          const clean = sanitizeQuizDiagram(figure);
          expect(clean.removed).toBe(0);
          expect(clean.diagram).toEqual(figure);
          expect(report.quiz?.figures[q.id]).toEqual(figure);
        } else {
          expect(figure).toBeNull();
          expect(q.figure).toBeNull();
        }
      });
    });
  });

  it('different seeds give different questions', () => {
    GENERATOR_KINDS.forEach((kind) => {
      const seen = new Set(SEEDS.map((s) => JSON.stringify(generateQuestion(kind, s, t).question)));
      expect(seen.size).toBeGreaterThan(10);
    });
  });
});

describe('quizGenerators: answers are semantically right', () => {
  const ipIn = (text: string) => /(\d+\.\d+\.\d+\.\d+)/.exec(text)?.[1] ?? '';

  it('networkCmd: only the right command covers the host', () => {
    SEEDS.forEach((seed) => {
      const { question: q } = generateQuestion('networkCmd', seed, t);
      const address = /`(\d+\.\d+\.\d+\.\d+)\/\d+`/.exec(q.prompt)?.[1] ?? '';
      const host = ipToNumber(address);
      q.options.forEach((o, i) => {
        const [, net, wc] = /network (\S+) (\S+) area 0/.exec(o) ?? [];
        expect(matchesWildcard(host, ipToNumber(net), ipToNumber(wc))).toBe(q.answer.includes(i));
      });
    });
  });

  it('networkMatch: right options match the wildcard, wrong ones do not', () => {
    SEEDS.forEach((seed) => {
      const { question: q } = generateQuestion('networkMatch', seed, t);
      const [, net, wc] = /network (\S+) (\S+) area 0/.exec(q.prompt) ?? [];
      q.options.forEach((o, i) => expect(matchesWildcard(ipToNumber(o), ipToNumber(net), ipToNumber(wc))).toBe(q.answer.includes(i)));
      expect(q.options).toHaveLength(5);
    });
  });

  it('longestMatch: the answer is the longest matching prefix', () => {
    SEEDS.forEach((seed) => {
      const { question: q } = generateQuestion('longestMatch', seed, t);
      const dest = ipToNumber(/`(\S+)`/.exec(q.prompt)?.[1] ?? '');
      const lengths = q.options.map((o) => {
        const [, net, len] = /`(\S+)\/(\d+)`/.exec(o) ?? [];
        return networkOf(dest, Number(len)) === ipToNumber(net) ? Number(len) : -1;
      });
      expect(lengths[q.answer[0]]).toBe(Math.max(...lengths));
    });
  });

  it('summarize: the summary covers every listed network', () => {
    SEEDS.forEach((seed) => {
      const { question: q } = generateQuestion('summarize', seed, t);
      const [net, len] = q.accepted[0].split('/');
      (q.code ?? '').split('\n').forEach((line) => {
        expect(networkOf(ipToNumber(ipIn(line)), Number(len))).toBe(ipToNumber(net));
      });
    });
  });
});

describe('quizGenerators: ids and seeds', () => {
  it('parses only exact generated ids', () => {
    expect(parseGeneratedId('gen-wildcard-42')).toEqual({ kind: 'wildcard', seed: 42 });
    expect(parseGeneratedId(generatedId('binaryDecimal', GENERATOR_MAX_SEED))).toEqual({ kind: 'binaryDecimal', seed: GENERATOR_MAX_SEED });
    ['gen-wildcard-0', 'gen-wildcard-042', 'gen-nope-1', 'gen-wildcard-2147483648', 'gen-wildcard', 'x-gen-wildcard-1', 'gen-wildcard-1 ', 'gen-toString-1'].forEach((id) =>
      expect(parseGeneratedId(id)).toBeNull(),
    );
  });

  it('maps question ids to stat keys', () => {
    expect(statKeyOf('gen-spfPath-99')).toBe('gen-spfPath');
    expect(statKeyOf('q12')).toBe('q12');
    expect(generatorStatKey('drBdr')).toBe('gen-drBdr');
    expect(isGeneratorKind('summarize')).toBe(true);
    expect(isGeneratorKind('constructor')).toBe(false);
  });

  it('newSeed stays in 1..2^31-1', () => {
    expect(newSeed(() => 0)).toBe(1);
    expect(newSeed(() => 0.9999999999)).toBeLessThanOrEqual(GENERATOR_MAX_SEED);
    expect(Number.isInteger(newSeed())).toBe(true);
  });

  it('mulberry32 is deterministic', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('quizGenerators: IP helpers and known cases', () => {
  it('converts addresses', () => {
    expect(ipToNumber('192.168.1.10')).toBe(3232235786);
    expect(numberToIp(3232235786)).toBe('192.168.1.10');
    expect(numberToIp(ipToNumber('255.255.255.255'))).toBe('255.255.255.255');
    expect(toBinaryOctet(5)).toBe('00000101');
  });

  it('masks and wildcards', () => {
    expect(numberToIp(prefixMask(26))).toBe('255.255.255.192');
    expect(numberToIp(prefixWildcard(26))).toBe('0.0.0.63');
    expect(numberToIp(prefixMask(0))).toBe('0.0.0.0');
    expect(numberToIp(prefixMask(32))).toBe('255.255.255.255');
    expect(numberToIp(networkOf(ipToNumber('172.16.45.200'), 20))).toBe('172.16.32.0');
    expect(matchesWildcard(ipToNumber('10.1.1.70'), ipToNumber('10.1.1.64'), prefixWildcard(26))).toBe(true);
    expect(matchesWildcard(ipToNumber('10.1.1.130'), ipToNumber('10.1.1.64'), prefixWildcard(26))).toBe(false);
  });

  it('OSPF cost', () => {
    expect(ospfCost(100, 100_000)).toBe(1);
    expect(ospfCost(10_000, 100_000)).toBe(100);
    expect(ospfCost(100, 1544)).toBe(64);
    expect(ospfCost(100, 1_000_000)).toBe(1);
  });

  it('DR election excludes priority 0', () => {
    const elected = electDrBdr([
      { name: 'R1', routerId: '9.9.9.9', priority: 0 },
      { name: 'R2', routerId: '2.2.2.2', priority: 1 },
      { name: 'R3', routerId: '5.5.5.5', priority: 1 },
      { name: 'R4', routerId: '1.1.1.1', priority: 10 },
    ]);
    expect(elected.map((x) => x.name)).toEqual(['R4', 'R3', 'R2']);
  });

  it('summary of four /24s', () => {
    const nets = [0, 1, 2, 3].map((i) => ipToNumber(`192.168.${i}.0`));
    const s = summarizeNetworks(nets, 24);
    expect(`${numberToIp(s.network)}/${s.prefix}`).toBe('192.168.0.0/22');
    const odd = summarizeNetworks([ipToNumber('192.168.1.0'), ipToNumber('192.168.2.0')], 24);
    expect(`${numberToIp(odd.network)}/${odd.prefix}`).toBe('192.168.0.0/22');
  });

  it('SPF paths on the default topology', () => {
    const paths = spfPaths([10, 2, 3, 4, 15, 3, 2, 2]);
    expect(paths[0]).toEqual({ path: ['A', 'C', 'B', 'D', 'F'], cost: 12 });
    expect(paths[1].cost).toBeGreaterThan(paths[0].cost);
  });
});
