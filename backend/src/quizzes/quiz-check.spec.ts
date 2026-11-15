import {
  canonicalQuizText,
  checkQuizText,
  recheckCanonicalQuiz,
  sanitizeQuizText,
} from './quiz-check';
import { QUIZ_FORMAT_ID, QUIZ_MAX_FILE_BYTES } from './quiz-format';

const single = (extra: Record<string, unknown> = {}) => ({
  id: 'q1',
  topic: 'T1',
  kind: 'single',
  prompt: 'Which protocol uses link-state?',
  options: ['RIP', 'OSPF', 'EIGRP', 'BGP'],
  answer: [1],
  explanation: 'OSPF is link-state.',
  ...extra,
});

// Tempo maximo (folgado) para procurar o bloco ``` em ~1 MB de texto hostil.
const FENCE_SCAN_MAX_MS = 300;
const FENCE = '```';
// Junta emoji compostos (familia, bandeiras): tem de ficar no texto.
const ZWJ = 0x200d;

const PLAIN_DIAGRAM = {
  w: 200,
  h: 100,
  nodes: [{ id: 'r1', kind: 'router', x: 20, y: 20 }],
};

const quiz = (questions: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: QUIZ_FORMAT_ID,
    title: 'OSPF',
    topics: [{ id: 'T1', name: 'Routing' }],
    questions,
    ...extra,
  });

describe('sanitizeQuizText', () => {
  it('strips invisible and format code points but keeps the emoji joiner', () => {
    const hidden = [
      0xad, 0x34f, 0x61c, 0x115f, 0x1160, 0x200b, 0x200c, 0x200e, 0x200f,
      0x2060, 0x2064, 0x206a, 0x206f, 0x3164, 0xffa0, 0xe0000, 0xe0041, 0xe007f,
    ].map((code) => String.fromCodePoint(code));
    expect(sanitizeQuizText(`a${hidden.join('')}b`, 100)).toBe('ab');
    const family = [0x1f468, 0x1f469, 0x1f467]
      .map((c) => String.fromCodePoint(c))
      .join(String.fromCodePoint(ZWJ));
    expect(sanitizeQuizText(family, 100)).toBe(family);
  });

  it('turns known HTML into the markdown subset and drops scripts', () => {
    expect(
      sanitizeQuizText('<b>Bold</b> <script>alert(1)</script><i>x</i>', 100),
    ).toBe('**Bold** *x*');
  });

  it('keeps technical angle brackets that are not HTML', () => {
    expect(sanitizeQuizText('interface <name> and a < b', 100)).toBe(
      'interface <name> and a < b',
    );
  });

  it('removes event handlers, javascript: and control characters', () => {
    const out = sanitizeQuizText(
      '<img src=x onerror="alert(1)">go javascript:alert(1)\u0007‮',
      100,
    );
    expect(out).toBe('go alert(1)');
  });

  it('decodes entities as plain text, never back into markup', () => {
    expect(sanitizeQuizText('&lt;b&gt; &amp; &#65;', 100)).toBe('** & A');
    expect(sanitizeQuizText('&lt;script&gt;x&lt;/script&gt;ok', 100)).toBe(
      'ok',
    );
  });
});

describe('sanitizeQuizText surrogates', () => {
  it('strips lone surrogates and non-characters, from text and entities', () => {
    const lone = String.fromCharCode(0xd800);
    expect(sanitizeQuizText(`a${lone}b&#xD800;c&#xFFFE;d`, 50)).toBe('abcd');
  });

  it('truncates by code point without splitting an emoji', () => {
    const out = sanitizeQuizText(`ab\u{1F600}cd`, 3);
    expect(out).toBe('ab\u{1F600}');
    expect(() => encodeURIComponent(out)).not.toThrow();
  });
});

describe('checkQuizText', () => {
  it('accepts a valid quiz and maps topic ids to names', () => {
    const report = checkQuizText(quiz([single()]));
    expect(report.ok).toBe(true);
    expect(report.quiz?.questions[0].topic).toBe('Routing');
    expect(report.checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('accepts JSON inside a fenced code block', () => {
    expect(checkQuizText('```json\n' + quiz([single()]) + '\n```').ok).toBe(
      true,
    );
  });

  it('finds the fenced block in linear time', () => {
    const noise = `${FENCE}\na`.repeat(200_000);
    const start = performance.now();
    expect(checkQuizText(noise).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(FENCE_SCAN_MAX_MS);
    // A primeira abertura sem quebra de linha nao conta; JSON em maiusculas tambem serve.
    const later = `text ${FENCE}x ${FENCE}JSON  \n ${quiz([single()])}\n${FENCE} tail`;
    expect(checkQuizText(later).ok).toBe(true);
  });

  it('rejects files that are not JSON, too big or with prototype keys', () => {
    expect(checkQuizText('const Q = [1]').ok).toBe(false);
    expect(checkQuizText('x'.repeat(QUIZ_MAX_FILE_BYTES + 1)).ok).toBe(false);
    const polluted = '{"__proto__":{"x":1},"questions":[]}';
    const report = checkQuizText(polluted);
    expect(report.ok).toBe(false);
    expect(report.checks.at(-1)).toEqual({
      id: 'structure',
      status: 'fail',
      count: 0,
    });
  });

  it('flags dangerous markup and unsafe links but keeps the question', () => {
    const report = checkQuizText(
      quiz([
        single({
          prompt: 'Pick <script>x</script>the link-state one',
          sources: [{ title: 'Bad', url: 'javascript:alert(1)' }],
        }),
      ]),
    );
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.id === 'content')?.status).toBe('warn');
    expect(report.checks.find((c) => c.id === 'links')?.count).toBe(1);
    expect(report.quiz?.questions[0].sources[0].url).toBeNull();
  });

  it('skips invalid questions with a reason', () => {
    const report = checkQuizText(
      quiz([
        single(),
        single({ id: 'q2', answer: [9] }),
        single({ id: 'q3', options: ['A', 'A', 'B'] }),
        single({ id: 'q4', kind: 'essay' }),
        single({ id: 'q5' }),
      ]),
    );
    expect(report.quiz?.questions).toHaveLength(1);
    expect(report.skipped.map((s) => s.reason)).toEqual([
      'answer',
      'options',
      'kind',
      'duplicate',
    ]);
  });

  it('reads the short keys of the sample quiz, including order and match', () => {
    const report = checkQuizText(
      JSON.stringify({
        topics: { DV: 'Distance vector' },
        questions: [
          {
            id: 'a',
            t: 'DV',
            q: 'Pick two true facts',
            o: ['w', 'x', 'y', 'z'],
            a: [0, 2],
            e: 'e',
          },
          {
            id: 'b',
            t: 'DV',
            k: 'in',
            q: 'Admin distance of OSPF?',
            acc: ['110'],
          },
          {
            id: 'c',
            t: 'DV',
            k: 'ord',
            q: 'Order the states',
            items: ['Down', 'Init', '2-Way'],
          },
          {
            id: 'd',
            t: 'DV',
            k: 'mat',
            q: 'Match the values',
            c: ['10', '40'],
            p: [
              ['Hello', 0],
              ['Dead', 1],
            ],
          },
        ],
      }),
    );
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.id === 'format')?.status).toBe('warn');
    expect(report.quiz?.questions.map((q) => q.kind)).toEqual([
      'multi',
      'typed',
      'order',
      'match',
    ]);
    expect(report.quiz?.questions[3]).toMatchObject({
      left: ['Hello', 'Dead'],
      right: ['10', '40'],
      pairs: [0, 1],
    });
  });

  it('fails when no question survives', () => {
    const report = checkQuizText(quiz([single({ answer: [] })]));
    expect(report.ok).toBe(false);
    expect(report.quiz).toBeNull();
  });
});

describe('quiz figures (diagrams as data)', () => {
  const DIAGRAM = {
    w: 200,
    h: 100,
    nodes: [
      { id: 'r1', kind: 'router', x: 20, y: 20, label: '<b>R1</b>' },
      { id: 'r2', kind: 'router', x: 180, y: 20 },
    ],
    links: [{ from: 'r1', to: 'r2', label: 'cost 10' }],
  };
  const figuresCheck = (report: ReturnType<typeof checkQuizText>) =>
    report.checks.find((c) => c.id === 'figures');

  it('keeps a referenced diagram in canonical form', () => {
    const report = checkQuizText(
      quiz([single({ figure: 'f1' })], { figures: { f1: DIAGRAM } }),
    );
    expect(report.ok).toBe(true);
    expect(report.quiz?.questions[0].figure).toBe('f1');
    expect(report.quiz?.figures.f1.nodes[0]).toEqual({
      id: 'r1',
      kind: 'router',
      x: 20,
      y: 20,
      label: 'R1',
      sub: '',
      tone: 'default',
      highlight: false,
    });
    expect(figuresCheck(report)?.status).toBe('pass');
  });

  it('never accepts SVG or HTML as a figure', () => {
    const svg = '<svg viewBox="0 0 10 10"><circle r="2"/></svg>';
    [svg, '<img src=x onerror=alert(1)>', 42, ['f']].forEach((bad) => {
      const report = checkQuizText(
        quiz([single({ figure: 'f1' })], { figures: { f1: bad } }),
      );
      expect(report.quiz?.figures).toEqual({});
      expect(report.quiz?.questions[0].figure).toBeNull();
      expect(figuresCheck(report)?.status).toBe('warn');
    });
    const inline = checkQuizText(quiz([single({ figure: svg })]));
    expect(inline.quiz?.figures).toEqual({});
    expect(inline.quiz?.questions[0].figure).toBeNull();
  });

  it('counts removed diagram parts in the figures check', () => {
    const report = checkQuizText(
      quiz([single({ figure: 'f1' })], {
        figures: {
          f1: {
            ...DIAGRAM,
            links: [...DIAGRAM.links, { from: 'r1', to: 'ghost' }],
          },
        },
      }),
    );
    expect(figuresCheck(report)).toMatchObject({ status: 'warn', count: 1 });
    expect(report.quiz?.figures.f1.links).toHaveLength(1);
  });

  it('counts a missing figure reference in the figures check', () => {
    const report = checkQuizText(quiz([single({ figure: 'nope' })]));
    expect(figuresCheck(report)).toMatchObject({ status: 'warn', count: 1 });
    expect(report.quiz?.questions[0].figure).toBeNull();
  });

  it('rejects a figure id that normalizes to a forbidden key', () => {
    ['__proto__!', 'constructor ', 'prototype.'].forEach((key) => {
      const target = key.replace(/[^\w-]/g, '');
      const report = checkQuizText(
        quiz([single({ figure: target })], { figures: { [key]: DIAGRAM } }),
      );
      expect(report.ok).toBe(true);
      expect(report.quiz?.questions[0].figure).toBeNull();
      expect(report.quiz?.figures).toEqual({});
      expect(figuresCheck(report)?.status).toBe('warn');
    });
  });

  it('never lets an inline figure overwrite an existing id', () => {
    const labelled = (text: string) => ({
      w: 200,
      h: 100,
      labels: [{ x: 1, y: 1, text }],
    });
    const report = checkQuizText(
      quiz(
        [
          single({ figure: 'q2-figure' }),
          single({
            id: 'q2',
            prompt: 'Which protocol is distance-vector?',
            figure: labelled('BBB'),
          }),
        ],
        { figures: { 'q2-figure': labelled('AAA') } },
      ),
    );
    expect(report.quiz?.questions.map((q) => q.figure)).toEqual([
      'q2-figure',
      'q2-figure-2',
    ]);
    expect(report.quiz?.figures['q2-figure'].labels[0].text).toBe('AAA');
    expect(report.quiz?.figures['q2-figure-2'].labels[0].text).toBe('BBB');
  });

  it("reads the 'fig' alias and the ['id'] list, but not a string 'd'", () => {
    const report = checkQuizText(
      quiz(
        [
          single({ fig: 'a' }),
          single({ id: 'q2', prompt: 'Second prompt here', d: ['a'] }),
        ],
        { figures: { a: DIAGRAM } },
      ),
    );
    expect(report.quiz?.questions.map((q) => q.figure)).toEqual(['a', 'a']);
    const plain = checkQuizText(quiz([single({ d: 'hard' })]));
    expect(figuresCheck(plain)).toMatchObject({ status: 'pass', count: 0 });
  });

  it('fails with size when the normalized quiz exceeds the limit', () => {
    const padding = (n: number) => 'x'.repeat(1990 - String(n).length);
    const qs = Array.from({ length: 500 }, (_, n) => ({
      q: `Q${n}${padding(n)}`,
      o: ['A', 'B'],
      a: [0],
    }));
    const text = JSON.stringify({
      format: QUIZ_FORMAT_ID,
      title: 'Big',
      topics: ['T'],
      qs,
    });
    expect(Buffer.byteLength(text)).toBeLessThan(QUIZ_MAX_FILE_BYTES);
    const report = checkQuizText(text);
    expect(report.ok).toBe(false);
    expect(report.quiz).toBeNull();
    expect(report.checks.at(-1)).toMatchObject({ id: 'size', status: 'fail' });
  });

  it('drops figures no question references', () => {
    const report = checkQuizText(
      quiz([single({ figure: 'a' })], { figures: { a: DIAGRAM, b: DIAGRAM } }),
    );
    expect(Object.keys(report.quiz?.figures ?? {})).toEqual(['a']);
  });
});

describe('links and ids', () => {
  it('accepts only https sources; http counts as a bad link', () => {
    const report = checkQuizText(
      quiz([
        single({
          sources: [
            { title: 'Plain', url: 'http://example.com/' },
            { title: 'Safe', url: 'https://example.com/' },
          ],
        }),
      ]),
    );
    expect(report.quiz?.questions[0].sources).toEqual([
      { title: 'Plain', url: null },
      { title: 'Safe', url: 'https://example.com/' },
    ]);
    expect(report.checks.find((c) => c.id === 'links')?.count).toBe(1);
  });

  it('never keeps a forbidden key or a repeated id as a question id', () => {
    const report = checkQuizText(
      quiz([
        single({ id: 'q3-2' }),
        single({ id: 'b', prompt: 'Second prompt here' }),
        single({ id: 'b', prompt: 'Third prompt here' }),
        single({ id: '__proto__', prompt: 'Fourth prompt here' }),
      ]),
    );
    const ids = report.quiz?.questions.map((q) => q.id) ?? [];
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('__proto__');
  });

  it('never keeps a name inherited from Object.prototype as an id', () => {
    const names = ['toString', 'valueOf', 'hasOwnProperty', '__defineGetter__'];
    const report = checkQuizText(
      quiz(
        names.map((id, i) =>
          single({ id, prompt: `Prompt number ${i}`, figure: id }),
        ),
        { figures: Object.fromEntries(names.map((id) => [id, PLAIN_DIAGRAM])) },
      ),
    );
    expect(report.ok).toBe(true);
    report.quiz!.questions.forEach((q) => {
      expect(q.id in Object.prototype).toBe(false);
      expect(q.figure).toBeNull();
    });
    expect(report.quiz!.figures).toEqual({});
    expect(report.checks.find((c) => c.id === 'figures')?.status).toBe('warn');
  });
});

describe('strict canonical re-check (server rule)', () => {
  const MESSY = [
    quiz(
      [
        single({
          prompt: '&lt;script&gt;x&lt;/script&gt;Which <b>one</b>? < script',
          options: ['<img src=x onerror=alert(1)>RIP', 'OSPF', 'EIGRP&nbsp;'],
          code: '<pre>ip route</pre>\r\n\r\n\r\n\r\nend   ',
          explanation: '&amp;amp;amp;lt;b&amp;gt;x',
          sources: [
            {
              title: '',
              url: `https://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.example.com/`,
            },
            { url: 'http://example.com/' },
            'javascript:alert(1)',
          ],
          figure: {
            w: 200,
            h: 100,
            nodes: [
              { id: 'a', kind: 'pc', x: 10.06, y: 10, label: 'javascript:x' },
              { id: 'a', kind: 'pc', x: 1, y: 1 },
              { id: 'b', kind: 'pc', x: '5', y: 1 },
            ],
            labels: [{ x: 1, y: 1, text: '</text><script>x</script>' }],
          },
        }),
        single({ prompt: 'Duplicate id question' }),
        single({ id: 'bad', answer: [9] }),
      ],
      { title: '  <i>Net</i>  ', topics: { T1: '&amp;lt;b&amp;gt;Routing' } },
    ),
    JSON.stringify({
      topics: Array.from({ length: 60 }, (_, i) => `T${i}`),
      questions: Array.from({ length: 6 }, (_, i) => ({
        q: `Question number ${i}`,
        t: `Extra ${i % 2}`,
        o: ['a', 'b', 'c'],
        a: [i % 3],
      })),
    }),
  ];

  it('accepts the canonical output of any accepted input, unchanged', () => {
    MESSY.forEach((input) => {
      const report = checkQuizText(input);
      expect(report.ok).toBe(true);
      // Como o servidor o recebe: o texto canonico lido com JSON.parse.
      const text = canonicalQuizText(report.quiz!);
      const sent = JSON.parse(text) as object;
      expect(recheckCanonicalQuiz(sent)).toEqual(report.quiz);
      expect(canonicalQuizText(recheckCanonicalQuiz(sent)!)).toBe(text);
      const again = checkQuizText(text);
      expect(again.checks.every((c) => c.status === 'pass')).toBe(true);
    });
  });

  it('refuses payloads that are not exactly canonical', () => {
    const canonical = checkQuizText(MESSY[0]).quiz!;
    const copy = () =>
      JSON.parse(canonicalQuizText(canonical)) as typeof canonical &
        Record<string, unknown>;
    const html = copy();
    html.questions[0].prompt = '<b>Which</b> one?';
    const http = copy();
    http.questions[0].sources = [{ title: 'x', url: 'http://example.com/' }];
    const extraFigure = copy();
    extraFigure.figures.extra =
      canonical.figures[canonical.questions[0].figure!];
    const reordered = Object.fromEntries(Object.entries(copy()).reverse());
    const noFormat: Record<string, unknown> = copy();
    delete noFormat.format;
    const wrongVersion = { ...copy(), version: 2 };
    [
      { ...copy(), evil: 1 },
      html,
      http,
      extraFigure,
      reordered,
      noFormat,
      wrongVersion,
      null,
      [],
      'text',
    ].forEach((payload) => expect(recheckCanonicalQuiz(payload)).toBeNull());
  });

  it('refuses a very deep payload without blowing the stack', () => {
    const depth = 200_000;
    const deep = JSON.parse(
      `{"a":${'['.repeat(depth)}${']'.repeat(depth)}}`,
    ) as unknown;
    expect(recheckCanonicalQuiz(deep)).toBeNull();
  });
});

describe('match questions', () => {
  it('allows several items to share the same choice', () => {
    const report = checkQuizText(
      quiz([
        {
          id: 'q1',
          topic: 'T1',
          kind: 'match',
          prompt: 'Classify each protocol as link-state or distance-vector.',
          left: ['OSPF', 'RIP', 'IS-IS', 'EIGRP'],
          right: ['Link-state', 'Distance-vector'],
          pairs: [0, 1, 0, 1],
          explanation: 'Classification.',
        },
      ]),
    );
    expect(report.ok).toBe(true);
    expect(report.quiz?.questions[0].pairs).toEqual([0, 1, 0, 1]);
  });
});
