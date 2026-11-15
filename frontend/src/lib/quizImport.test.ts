import { describe, expect, it, vi } from 'vitest';
import { canonicalQuizText, checkQuizText, recheckCanonicalQuiz, sanitizeQuizText } from './quizImport';
import { cleanQuizText } from './quizText';
import { importQuiz } from '../api/quizzesService';
import api from '../api/client';

vi.mock('../api/client', () => ({ default: { post: vi.fn(() => Promise.resolve({ data: {} })) } }));
import { QUIZ_FORMAT_ID, QUIZ_MAX_TOPICS } from './quizFormat';

const LONE_HIGH = String.fromCharCode(0xd800);
const RLO = String.fromCharCode(0x202e);
const BELL = String.fromCharCode(7);
const ZWJ = String.fromCodePoint(0x200d);
const FENCE = '```';
// Tempo maximo (folgado) para procurar o bloco ``` em ~1 MB de texto hostil.
// Folga para runners de CI lentos; o caso vulneravel demorava segundos.
const FENCE_SCAN_MAX_MS = 1000;
// Invisiveis e de formatacao que a limpeza tira (o ZWJ fica, junta emoji).
const HIDDEN_CODE_POINTS = [
  0xad, 0x34f, 0x61c, 0x115f, 0x1160, 0x200b, 0x200c, 0x200e, 0x200f, 0x2060, 0x2064, 0x206a, 0x206f, 0x3164, 0xffa0,
  0xe0000, 0xe0041, 0xe007f,
];
const LONG_HOST = `https://${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.example.com/x`;

const diagram = (extra: Record<string, unknown> = {}) => ({
  w: 300,
  h: 150,
  nodes: [
    { id: 'r1', kind: 'router', x: 40.04, y: 40, label: '<b>R1</b>', junk: 1 },
    { id: 'r2', kind: 'switch', x: 200, y: 40, sub: 'javascript:alert(1)' },
    { id: 'r2', kind: 'pc', x: 1, y: 1 },
  ],
  links: [
    { from: 'r1', to: 'r2', bend: '10' },
    { from: 'r1', to: 'r2', label: '&amp;lt;x&amp;gt;' },
  ],
  ...extra,
});

// Entradas "sujas" que o cliente aceita (com avisos). Cada uma tem de dar um
// quiz canonico que o servidor aceita tal como esta.
const MESSY_INPUTS: Record<string, string> = {
  shortKeys: JSON.stringify({
    title: '  <i>Net</i>works\n\n101 ',
    lang: ' pt ',
    secondsPerQuestion: '45.6',
    topics: { DV: 'Distance <b>vector</b>', LS: '&amp;lt;b&amp;gt;Link state' },
    figures: { 'top!': diagram(), unused: diagram(), bad: '<svg onload=x()></svg>' },
    questions: [
      { id: 'a', t: 'DV', q: `Pick two ${LONE_HIGH}true facts${BELL}<script>x</script>`, o: ['w', ' x', 'y', 'z'], a: [0, 2], e: 'e', fig: 'top' },
      { id: 'a', t: 'LS', k: 'in', q: 'Admin distance of OSPF?', acc: ['110', ' 110 '], d: ['top'] },
      { id: '__proto__', t: 'XX', k: 'ord', q: 'Order the states', items: ['Down', 'Init', '2-Way'], figure: diagram({ links: [] }) },
      { id: 'd', t: 'DV', k: 'mat', q: 'Match the values', c: ['10', '40'], p: [['Hello', 0], ['Dead', 1]] },
      { id: 'e', q: 'bad', o: ['a', 'b', 'c'], a: [0] },
      { id: 'f', q: 'Pick two true facts', o: ['a', 'b', 'c'], a: [9] },
    ],
  }),
  htmlAndLinks: JSON.stringify({
    format: QUIZ_FORMAT_ID,
    title: `A${RLO}B`,
    topics: ['Routing'],
    questions: [
      {
        id: 'q1',
        topic: 'Routing',
        kind: 'single',
        prompt: '&lt;script&gt;alert(1)&lt;/script&gt;Which <b>one</b>? a < b && x.onclick = f < script',
        code: '<pre>ip route 0.0.0.0 0.0.0.0 10.0.0.1</pre>\r\n\r\n\r\n\r\nend   ',
        options: ['<img src=x onerror=alert(1)>RIP', 'OSPF', 'EIGRP&nbsp;', '<a href="javascript:x">BGP</a>'],
        answer: [1],
        explanation: '&amp;amp;amp;amp;amp;amp;amp;amp;amp;amp;amp;lt;b&gt;deep',
        sources: [
          { title: 'Plain', url: 'http://example.com/a' },
          { title: '', url: LONG_HOST },
          { url: 'javascript:alert(1)' },
          'https://example.org/b?c=d#e',
          { title: '<b>Doc</b>', url: 'https://EXAMPLE.com/./a/../b' },
        ],
      },
      {
        id: 'q1',
        topic: 'Routing',
        kind: 'single',
        prompt: 'Which protocol is distance-vector?',
        options: ['RIP', 'OSPF', 'IS-IS'],
        answer: [0],
        figure: { w: 200, h: 100, labels: [{ x: 1, y: 1, text: '</text><script>x</script>' }] },
      },
    ],
  }),
  fenced: '```json\n' + JSON.stringify({ questions: [{ q: 'Is <br> a tag?', o: ['Yes', 'No'], a: [0] }] }) + '\n```',
  manyTopics: JSON.stringify({
    topics: Array.from({ length: QUIZ_MAX_TOPICS + 5 }, (_, i) => `T${i}`),
    questions: Array.from({ length: 8 }, (_, i) => ({
      q: `Question number ${i}`,
      t: `Extra ${i % 3}`,
      o: ['a', 'b', 'c'],
      a: [i % 3],
    })),
  }),
};

describe('client canonical output always passes the strict server re-check', () => {
  it.each(Object.entries(MESSY_INPUTS))('%s', (_name, input) => {
    const report = checkQuizText(input);
    expect(report.ok).toBe(true);
    const canonical = report.quiz!;
    // Como o servidor o recebe: o texto canonico lido com JSON.parse.
    const text = canonicalQuizText(canonical);
    const sent = JSON.parse(text) as object;
    expect(recheckCanonicalQuiz(sent)).toEqual(canonical);
    expect(canonicalQuizText(recheckCanonicalQuiz(sent)!)).toBe(text);
    const again = checkQuizText(text);
    expect(again.checks.map((c) => [c.id, c.status])).toEqual(
      ['size', 'json', 'structure', 'format', 'content', 'links', 'figures', 'questions'].map((id) => [id, 'pass']),
    );
    expect(again.skipped).toEqual([]);
  });

  it('the messy inputs really were messy (warnings or skips on the first check)', () => {
    Object.values(MESSY_INPUTS).forEach((input) => {
      const report = checkQuizText(input);
      expect(report.checks.some((c) => c.status !== 'pass') || report.skipped.length > 0).toBe(true);
    });
  });

  it('refuses anything that is not exactly canonical', () => {
    const canonical = checkQuizText(MESSY_INPUTS.htmlAndLinks).quiz!;
    const copy = () => JSON.parse(canonicalQuizText(canonical)) as Record<string, unknown> & typeof canonical;
    const extraKey = { ...copy(), evil: 1 };
    const html = copy();
    html.questions[0].prompt = '<b>Which</b> one?';
    const reordered = Object.fromEntries(Object.entries(copy()).reverse());
    const httpSource = copy();
    httpSource.questions[0].sources[0] = { title: 'x', url: 'http://example.com/' };
    const noFormat: Record<string, unknown> = copy();
    delete noFormat.format;
    const wrongFormat = { ...copy(), format: `${QUIZ_FORMAT_ID}-x` };
    [extraKey, html, reordered, httpSource, noFormat, wrongFormat, null, [], 'text'].forEach((payload) =>
      expect(recheckCanonicalQuiz(payload)).toBeNull(),
    );
  });

  it('importQuiz sends exactly the canonical text, as a string', async () => {
    const canonical = checkQuizText(MESSY_INPUTS.shortKeys).quiz!;
    await importQuiz(canonical);
    expect(api.post).toHaveBeenCalledWith('/quizzes/import', { quizJson: canonicalQuizText(canonical) });
  });

  it('never keeps a name inherited from Object.prototype as a question or figure id', () => {
    const names = ['toString', 'valueOf', 'hasOwnProperty', '__defineGetter__'];
    const report = checkQuizText(
      JSON.stringify({
        figures: Object.fromEntries(names.map((id) => [id, diagram()])),
        questions: names.map((id, i) => ({ id, q: `Prompt number ${i}`, o: ['a', 'b', 'c'], a: [0], figure: id })),
      }),
    );
    expect(report.ok).toBe(true);
    report.quiz!.questions.forEach((q) => {
      expect(q.id in Object.prototype).toBe(false);
      expect(q.figure).toBeNull();
    });
    expect(report.quiz!.figures).toEqual({});
  });
});

describe('fenced JSON', () => {
  it('finds the block in linear time', () => {
    const noise = `${FENCE}\na`.repeat(200_000);
    const start = performance.now();
    expect(checkQuizText(noise).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(FENCE_SCAN_MAX_MS);
  });

  it('skips an opening without a line break and accepts JSON in capitals', () => {
    const body = JSON.stringify({ questions: [{ q: 'Which one is it?', o: ['a', 'b', 'c'], a: [0] }] });
    expect(checkQuizText(`text ${FENCE}x ${FENCE}JSON  \n ${body}\n${FENCE} tail`).ok).toBe(true);
    expect(checkQuizText(`${FENCE}json\n${body}`).ok).toBe(false);
  });
});

describe('sanitizeQuizText is a fixpoint', () => {
  const FRAGMENTS = ['<', '>', '&', 'amp;', 'lt;', 'gt;', '#60;', '#x3C;', 'script', 'b', '/', ' ', '\n', '\t', '\r', 'javascript', ':', 'on', 'click', '=', 'x', '<br>', 'svg', LONE_HIGH, RLO, BELL, 'data', 'text/html', 'nbsp;', '*', 'foo', 'img', ZWJ, ...HIDDEN_CODE_POINTS.map((code) => String.fromCodePoint(code))];
  // Gerador deterministico (nao depende de Math.random).
  const seeded = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  };

  it('cleaning cleaned text changes nothing and is never flagged', () => {
    const next = seeded(7);
    for (let n = 0; n < 2000; n += 1) {
      const length = 1 + Math.floor(next() * 30);
      const raw = Array.from({ length }, () => FRAGMENTS[Math.floor(next() * FRAGMENTS.length)]).join('');
      [true, false].forEach((multiline) => {
        [true, false].forEach((markdown) => {
          const max = 1 + Math.floor(next() * 40);
          const once = cleanQuizText(raw, max, { multiline, markdown });
          const twice = cleanQuizText(once.text, max, { multiline, markdown });
          expect(twice).toEqual({ text: once.text, dangerous: false });
        });
      });
    }
  });

  it('drops text that does not settle within the pass limit', () => {
    const counters = { dangerous: 0, badLinks: 0, badFigures: 0 };
    const deep = `${'&amp;'.repeat(1)}${'amp;'.repeat(20)}lt;b&gt;`;
    expect(sanitizeQuizText(deep, 100, counters)).toBe('');
    expect(counters.dangerous).toBe(1);
  });

  it('neutralizes event handlers inside tag-like text', () => {
    const counters = { dangerous: 0, badLinks: 0, badFigures: 0 };
    expect(sanitizeQuizText('x <foo onerror=alert(1)> y <bar/onload=1>', 100, counters)).toBe('x foo onerror=alert(1)> y bar/onload=1>');
    expect(counters.dangerous).toBe(1);
  });

  it('strips invisible and format code points but keeps the emoji joiner', () => {
    const hidden = HIDDEN_CODE_POINTS.map((code) => String.fromCodePoint(code)).join('');
    expect(sanitizeQuizText(`a${hidden}b`, 100)).toBe('ab');
    const family = [0x1f468, 0x1f469, 0x1f467].map((code) => String.fromCodePoint(code)).join(ZWJ);
    expect(sanitizeQuizText(family, 100)).toBe(family);
  });

  it('keeps technical text that is not HTML', () => {
    expect(sanitizeQuizText('interface <name> and a < b; x.onclick = f', 100)).toBe('interface ＜name> and a < b; x.onclick = f');
  });
});
