import { describe, expect, it } from 'vitest';
import {
  DIAGRAM_LABEL_MAX,
  DIAGRAM_MAX_AREAS,
  DIAGRAM_MAX_BEND,
  DIAGRAM_MAX_H,
  DIAGRAM_MAX_LABELS,
  DIAGRAM_MAX_LINKS,
  DIAGRAM_MAX_NODES,
  DIAGRAM_MAX_W,
  DIAGRAM_MIN_H,
  DIAGRAM_MIN_W,
  DIAGRAM_TEXT_MAX,
  sanitizeQuizDiagram,
  type QuizDiagram,
} from './quizDiagram';

const W = 400;
const H = 200;
const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: 'router', x: 50, y: 50, ...extra });
const base = (extra: Record<string, unknown> = {}) => ({
  w: W,
  h: H,
  nodes: [node('r1'), node('r2', { x: 300 })],
  links: [{ from: 'r1', to: 'r2' }],
  ...extra,
});
// Sanitiza e devolve o diagrama (falha o teste se for null).
const clean = (raw: unknown): QuizDiagram => {
  const { diagram } = sanitizeQuizDiagram(raw);
  if (!diagram) throw new Error('expected a diagram');
  return diagram;
};
const removedOf = (raw: unknown) => sanitizeQuizDiagram(raw).removed;
const fromJson = (text: string): unknown => JSON.parse(text);

const INJECTIONS = [
  '<script>alert(1)</script>R1',
  'javascript:alert(1)',
  '</text><script>alert(1)</script>',
  '&lt;script&gt;alert(1)&lt;/script&gt;R1',
  '&amp;lt;img src=x onerror=alert(1)&amp;gt;',
  `R${String.fromCharCode(0xd800)}1${String.fromCharCode(0xdfff)}`,
  '<img src=x onerror="alert(1)">',
  '< script >x',
  '<svg onload=alert(1)>',
  'data:text/html,<b>x</b>',
  ['a', 0x202e, 'b', 0x0, 'c', 0x200b, 'd'].map((p) => (typeof p === 'number' ? String.fromCodePoint(p) : p)).join(''),
];
// Abaixo do tab so ha caracteres de controlo.
const TAB = 9;
const HARMFUL = /<\s*\/?\s*(script|svg|img|iframe|style)\b|javascript\s*:|data\s*:\s*text\/html|<[^<>]*\bon[a-z]+\s*=|[\u200b-\u200f\u202a-\u202e\ud800-\udfff]/i;

describe('sanitizeQuizDiagram: canonical output', () => {
  it('fills every default, keeps the contract key order and drops unknown keys', () => {
    const diagram = clean({
      ...base({
        labels: [{ x: 10, y: 20, text: 'Area 0', evil: 'x' }],
        areas: [{ x: 5, y: 5, w: 100, h: 50 }],
      }),
      extra: 'ignored',
    });
    expect(diagram).toEqual({
      w: W,
      h: H,
      nodes: [
        { id: 'r1', kind: 'router', x: 50, y: 50, label: '', sub: '', tone: 'default', highlight: false },
        { id: 'r2', kind: 'router', x: 300, y: 50, label: '', sub: '', tone: 'default', highlight: false },
      ],
      links: [{ from: 'r1', to: 'r2', label: '', style: 'solid', weight: 'normal', tone: 'default', arrow: 'none', bend: 0 }],
      labels: [{ x: 10, y: 20, text: 'Area 0', tone: 'default', size: 'md', anchor: 'middle', mono: false }],
      areas: [{ x: 5, y: 5, w: 100, h: 50, label: '', tone: 'default' }],
    });
    expect(Object.keys(diagram)).toEqual(['w', 'h', 'nodes', 'links', 'labels', 'areas']);
    expect(Object.keys(diagram.nodes[0])).toEqual(['id', 'kind', 'x', 'y', 'label', 'sub', 'tone', 'highlight']);
    expect(Object.keys(diagram.links[0])).toEqual(['from', 'to', 'label', 'style', 'weight', 'tone', 'arrow', 'bend']);
    expect(Object.keys(diagram.labels[0])).toEqual(['x', 'y', 'text', 'tone', 'size', 'anchor', 'mono']);
    expect(Object.keys(diagram.areas[0])).toEqual(['x', 'y', 'w', 'h', 'label', 'tone']);
    expect(removedOf(base())).toBe(0);
  });

  it('keeps explicit valid values and treats null as missing', () => {
    const diagram = clean(
      base({
        nodes: [node('a', { label: 'R1', sub: 'RID 1.1.1.1', tone: 'accent', highlight: true }), node('b', { tone: null })],
        links: [{ from: 'a', to: 'b', label: '10', style: 'dashed', weight: 'thick', tone: 'red', arrow: 'both', bend: -40 }],
        labels: [{ x: 1, y: 2, text: 'x', tone: 'blue', size: 'lg', anchor: 'end', mono: true }],
      }),
    );
    expect(diagram.nodes[0]).toMatchObject({ label: 'R1', sub: 'RID 1.1.1.1', tone: 'accent', highlight: true });
    expect(diagram.nodes[1].tone).toBe('default');
    expect(diagram.links[0]).toMatchObject({ style: 'dashed', weight: 'thick', tone: 'red', arrow: 'both', bend: -40 });
    expect(diagram.labels[0]).toMatchObject({ tone: 'blue', size: 'lg', anchor: 'end', mono: true });
  });

  it('rounds coordinates to one decimal and never keeps -0', () => {
    const diagram = clean(base({ nodes: [node('a', { x: 12.345, y: -0.04 }), node('b', { x: 0.05 })] }));
    expect(diagram.nodes[0].x).toBe(12.3);
    expect(Object.is(diagram.nodes[0].y, 0)).toBe(true);
    expect(diagram.nodes[1].x).toBe(0.1);
  });

  it('is idempotent with removed 0 on its own output', () => {
    const messy = base({
      nodes: [node('a', { x: 10.06, label: ' <b>R1</b>  core ', sub: '&amp;lt;x&amp;gt;' }), node('a'), node('b', { x: 'x' }), node('c', { x: 399.96 })],
      links: [{ from: 'a', to: 'c', bend: 12.34, label: 'javascript:1' }, { from: 'a', to: 'ghost' }],
      labels: [{ x: 1, y: 1, text: 'x'.repeat(DIAGRAM_TEXT_MAX + 50) }, { x: 1, y: 1, text: '' }],
      areas: [{ x: 0.05, y: 0, w: 399.95, h: 10 }, { x: 0, y: 0, w: 0, h: 10 }],
    });
    const once = sanitizeQuizDiagram(messy);
    expect(once.removed).toBeGreaterThan(0);
    const twice = sanitizeQuizDiagram(JSON.parse(JSON.stringify(once.diagram)));
    expect(twice).toEqual({ diagram: once.diagram, removed: 0 });
    expect(JSON.stringify(twice.diagram)).toBe(JSON.stringify(once.diagram));
  });
});

describe('sanitizeQuizDiagram: whole-diagram rejection', () => {
  it('rejects non objects', () => {
    [null, undefined, 'svg', 42, [], [base()], true].forEach((raw) => {
      expect(sanitizeQuizDiagram(raw).diagram).toBeNull();
    });
  });

  it('rejects w and h that are not integers in range, including numeric strings', () => {
    const bad = [
      { w: '400' },
      { h: '200' },
      { w: 400.5 },
      { w: DIAGRAM_MIN_W - 1 },
      { w: DIAGRAM_MAX_W + 1 },
      { h: DIAGRAM_MIN_H - 1 },
      { h: DIAGRAM_MAX_H + 1 },
      { w: Number.NaN },
      { h: Number.POSITIVE_INFINITY },
      { w: null },
      { h: undefined },
    ];
    bad.forEach((extra) => expect(sanitizeQuizDiagram(base(extra)).diagram).toBeNull());
    expect(clean(base({ w: DIAGRAM_MIN_W, h: DIAGRAM_MAX_H })).w).toBe(DIAGRAM_MIN_W);
  });

  it('returns null when nothing is drawable', () => {
    expect(sanitizeQuizDiagram({ w: W, h: H }).diagram).toBeNull();
    expect(sanitizeQuizDiagram(base({ nodes: [node('a', { kind: 'bogus' })], links: [] })).diagram).toBeNull();
    // Uma ligacao sozinha nao desenha nada: precisa de nos.
    expect(sanitizeQuizDiagram(base({ nodes: [] })).diagram).toBeNull();
    expect(clean(base({ nodes: [], links: [], labels: [{ x: 1, y: 1, text: 'only' }] })).labels).toHaveLength(1);
  });

  it('rejects prototype keys on the diagram and drops elements carrying them', () => {
    expect(sanitizeQuizDiagram(fromJson(`{"w":${W},"h":${H},"__proto__":{"x":1},"labels":[{"x":1,"y":1,"text":"a"}]}`)).diagram).toBeNull();
    expect(sanitizeQuizDiagram(fromJson(`{"w":${W},"h":${H},"constructor":1,"labels":[{"x":1,"y":1,"text":"a"}]}`)).diagram).toBeNull();
    const result = sanitizeQuizDiagram(
      fromJson(`{"w":${W},"h":${H},"labels":[{"x":1,"y":1,"text":"a","__proto__":{"text":"b"}},{"x":1,"y":1,"text":"ok","prototype":1},{"x":1,"y":1,"text":"kept"}]}`),
    );
    expect(result.diagram?.labels.map((l) => l.text)).toEqual(['kept']);
    expect(result.removed).toBe(2);
  });

  it('ignores inherited properties (polluted prototypes never leak in)', () => {
    const raw = Object.create({ labels: [{ x: 1, y: 1, text: 'inherited' }], w: W, h: H }) as Record<string, unknown>;
    expect(sanitizeQuizDiagram(raw).diagram).toBeNull();
  });
});

describe('sanitizeQuizDiagram: element rejection', () => {
  const nodesOf = (nodes: unknown[]) => sanitizeQuizDiagram(base({ nodes: [node('keep'), ...nodes], links: [] }));

  it('rejects nodes with a bad id, duplicate id, forbidden id or unknown kind', () => {
    const result = nodesOf([
      node('has space'),
      node(''),
      node('x'.repeat(25)),
      node('keep'),
      node('__proto__'),
      node('constructor'),
      { kind: 'router', x: 1, y: 1 },
      node('k', { kind: 'Router' }),
      node('k2', { kind: undefined }),
      node('k3', { id: 7 }),
      'r1',
      null,
    ]);
    expect(result.diagram?.nodes.map((n) => n.id)).toEqual(['keep']);
    expect(result.removed).toBe(12);
  });

  it('rejects numeric strings, NaN, Infinity and out-of-range coordinates', () => {
    const bad = [
      { x: '50' },
      { y: '1e2' },
      { x: Number.NaN },
      { y: Number.NEGATIVE_INFINITY },
      { x: -1 },
      { x: W + 1 },
      { y: H + 0.1 },
      { x: null },
      { x: true },
      { x: [5] },
    ];
    const result = nodesOf(bad.map((extra, i) => node(`n${i}`, extra)));
    expect(result.diagram?.nodes).toHaveLength(1);
    expect(result.removed).toBe(bad.length);
  });

  it('rejects wrong types for texts, enums and booleans', () => {
    const bad = [{ label: 5 }, { sub: ['x'] }, { tone: 'pink' }, { tone: 3 }, { highlight: 'true' }, { highlight: 1 }];
    const result = nodesOf(bad.map((extra, i) => node(`n${i}`, extra)));
    expect(result.removed).toBe(bad.length);
  });

  it('rejects orphan, self and malformed links', () => {
    const result = sanitizeQuizDiagram(
      base({
        links: [
          { from: 'r1', to: 'r2' },
          { from: 'r1', to: 'ghost' },
          { from: 'r1', to: 'r1' },
          { from: 'r1' },
          { from: 'r1', to: 'r2', style: 'wavy' },
          { from: 'r1', to: 'r2', arrow: 'start' },
          { from: 'r1', to: 'r2', weight: 'bold' },
          { from: 'r1', to: 'r2', bend: '10' },
          { from: 'r1', to: 'r2', bend: DIAGRAM_MAX_BEND + 1 },
          { from: 'r1', to: 'r2', bend: Number.NaN },
          { from: 'r1', to: 'r2', label: 1 },
        ],
      }),
    );
    expect(result.diagram?.links).toHaveLength(1);
    expect(result.removed).toBe(10);
  });

  it('drops links to a node that was itself rejected', () => {
    const result = sanitizeQuizDiagram(base({ nodes: [node('r1'), node('r2', { kind: 'nope' })] }));
    expect(result.diagram?.links).toEqual([]);
    expect(result.removed).toBe(2);
  });

  it('rejects labels without text or with bad fields', () => {
    const result = sanitizeQuizDiagram(
      base({
        labels: [
          { x: 1, y: 1, text: 'ok' },
          { x: 1, y: 1 },
          { x: 1, y: 1, text: '   ' },
          { x: 1, y: 1, text: '<script>x</script>' },
          { x: 1, y: 1, text: 'a', size: 'xl' },
          { x: 1, y: 1, text: 'a', anchor: 'left' },
          { x: 1, y: 1, text: 'a', mono: 'yes' },
          { x: '1', y: 1, text: 'a' },
        ],
      }),
    );
    expect(result.diagram?.labels.map((l) => l.text)).toEqual(['ok']);
    expect(result.removed).toBe(7);
  });

  it('rejects areas that are empty or do not fit', () => {
    const result = sanitizeQuizDiagram(
      base({
        areas: [
          { x: 0, y: 0, w: W, h: H, label: 'all' },
          { x: 1, y: 0, w: W, h: 10 },
          { x: 0, y: 1, w: 10, h: H },
          { x: 0, y: 0, w: 0, h: 10 },
          { x: 0, y: 0, w: 10, h: -5 },
          { x: 0, y: 0, w: '10', h: 10 },
          { x: 0, y: 0, w: 10 },
          { x: 0, y: 0, w: 10, h: 10, tone: 'green' },
        ],
      }),
    );
    expect(result.diagram?.areas.map((a) => a.label)).toEqual(['all']);
    expect(result.removed).toBe(7);
  });

  it('counts a list that is not an array', () => {
    const result = sanitizeQuizDiagram(base({ labels: { x: 1 }, areas: 'x' }));
    expect(result.diagram?.labels).toEqual([]);
    expect(result.removed).toBe(2);
  });
});

describe('sanitizeQuizDiagram: caps', () => {
  it('keeps the first valid elements up to each cap and counts the rest', () => {
    const extra = 3;
    const nodes = Array.from({ length: DIAGRAM_MAX_NODES + extra }, (_, i) => node(`n${i}`, { x: i }));
    const links = Array.from({ length: DIAGRAM_MAX_LINKS + extra }, (_, i) => ({ from: 'n0', to: `n${1 + (i % 10)}` }));
    const labels = Array.from({ length: DIAGRAM_MAX_LABELS + extra }, (_, i) => ({ x: 1, y: 1, text: `L${i}` }));
    const areas = Array.from({ length: DIAGRAM_MAX_AREAS + extra }, () => ({ x: 0, y: 0, w: 10, h: 10 }));
    const result = sanitizeQuizDiagram({ w: W, h: H, nodes, links, labels, areas });
    expect(result.diagram?.nodes).toHaveLength(DIAGRAM_MAX_NODES);
    expect(result.diagram?.links).toHaveLength(DIAGRAM_MAX_LINKS);
    expect(result.diagram?.labels).toHaveLength(DIAGRAM_MAX_LABELS);
    expect(result.diagram?.areas).toHaveLength(DIAGRAM_MAX_AREAS);
    expect(result.removed).toBe(extra * 4);
    expect(result.diagram?.nodes.at(-1)?.id).toBe(`n${DIAGRAM_MAX_NODES - 1}`);
  });

  it('cuts texts to their maximum by code point', () => {
    const emoji = '\u{1F600}';
    const diagram = clean(
      base({
        nodes: [node('a', { label: emoji.repeat(DIAGRAM_LABEL_MAX + 5) }), node('b')],
        labels: [{ x: 1, y: 1, text: 'y'.repeat(DIAGRAM_TEXT_MAX * 3) }],
      }),
    );
    expect(Array.from(diagram.nodes[0].label)).toHaveLength(DIAGRAM_LABEL_MAX);
    expect(() => encodeURIComponent(diagram.nodes[0].label)).not.toThrow();
    expect(diagram.labels[0].text).toHaveLength(DIAGRAM_TEXT_MAX);
  });
});

describe('sanitizeQuizDiagram: string injection ends as harmless plain text', () => {
  it.each(INJECTIONS)('every text field neutralizes %j', (attack) => {
    const raw = base({
      nodes: [node('r1', { label: attack, sub: attack }), node('r2')],
      links: [{ from: 'r1', to: 'r2', label: attack }],
      labels: [{ x: 1, y: 1, text: `${attack} tail` }],
      areas: [{ x: 0, y: 0, w: 10, h: 10, label: attack }],
    });
    const result = sanitizeQuizDiagram(raw);
    const diagram = result.diagram;
    expect(diagram).not.toBeNull();
    // Um bloco sem fecho ("<svg ...>") leva o resto do texto, por isso a etiqueta pode sair.
    const texts = [diagram!.nodes[0].label, diagram!.nodes[0].sub, diagram!.links[0]?.label ?? '', diagram!.labels[0]?.text ?? '', diagram!.areas[0].label];
    texts.forEach((text) => {
      expect(text).not.toMatch(HARMFUL);
      expect(Array.from(text).some((c) => c.charCodeAt(0) < TAB)).toBe(false);
      expect(text).not.toMatch(/[\n\r\t]/);
      expect(text).toBe(text.trim());
      expect(() => encodeURIComponent(text)).not.toThrow();
    });
    // E o resultado volta a passar igual, sem nada contado.
    expect(sanitizeQuizDiagram(JSON.parse(JSON.stringify(diagram)))).toEqual({ diagram, removed: 0 });
  });

  it('leaves a non-HTML tag such as </text> as literal text (React escapes it)', () => {
    const diagram = clean(base({ nodes: [node('r1', { label: '</text><script>alert(1)</script>' }), node('r2')] }));
    expect(diagram.nodes[0].label).toBe('＜/text>');
  });

  it('turns markup into plain text without markdown markers', () => {
    const diagram = clean(base({ nodes: [node('r1', { label: '<b>R1</b> <i>core</i> <code>x</code>' }), node('r2')] }));
    expect(diagram.nodes[0].label).toBe('R1 core x');
  });

  it('decodes entities but never into markup', () => {
    const diagram = clean(base({ nodes: [node('r1', { label: 'A &amp; B &lt;script&gt;x&lt;/script&gt;' }), node('r2')] }));
    expect(diagram.nodes[0].label).toBe('A & B');
  });

  it('keeps technical angle brackets that are not HTML', () => {
    const diagram = clean(base({ nodes: [node('r1', { label: 'cost < 10 <interface>' }), node('r2')] }));
    expect(diagram.nodes[0].label).toBe('cost < 10 ＜interface>');
  });

  it('collapses whitespace and line breaks to single spaces', () => {
    const diagram = clean(base({ nodes: [node('r1', { label: '  a\n\n b\t c<br>d ' }), node('r2')] }));
    expect(diagram.nodes[0].label).toBe('a b c d');
  });

  it('counts a dangerous text in removed but keeps the element', () => {
    const result = sanitizeQuizDiagram(base({ nodes: [node('r1', { label: '<script>x</script>R1' }), node('r2')] }));
    expect(result.diagram?.nodes[0].label).toBe('R1');
    expect(result.removed).toBe(1);
  });
});
