import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import QuizDiagram from './QuizDiagram';
import type { QuizDiagram as QuizDiagramData } from '../../lib/quizDiagram';

const node = (id: string, kind: QuizDiagramData['nodes'][number]['kind'], x: number, y: number, label: string, sub = '') => ({
  id,
  kind,
  x,
  y,
  label,
  sub,
  tone: 'default' as const,
  highlight: false,
});

const diagram: QuizDiagramData = {
  w: 480,
  h: 260,
  nodes: [node('r1', 'router', 90, 80, 'R1', 'RID 1.1.1.1'), node('r2', 'switch', 390, 80, '<script>alert(1)</script>'), node('c', 'cloud', 240, 190, 'Internet'), node('x', 'cross', 240, 80, '')],
  links: [
    { from: 'r1', to: 'r2', label: '10.1.1.0/30', style: 'dashed', weight: 'thick', tone: 'blue', arrow: 'both', bend: 30 },
    { from: 'r1', to: 'c', label: '', style: 'solid', weight: 'normal', tone: 'default', arrow: 'none', bend: 0 },
  ],
  labels: [{ x: 130, y: 70, text: 'G0/0 .1', tone: 'default', size: 'sm', anchor: 'start', mono: true }],
  areas: [{ x: 20, y: 20, w: 440, h: 220, label: 'Area 0', tone: 'muted' }],
};

describe('QuizDiagram', () => {
  const html = renderToStaticMarkup(<QuizDiagram diagram={diagram} title="Figure" />);

  it('renders labels as text and exposes an accessible name', () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Figure"');
    expect(html).toContain('>R1<');
    expect(html).toContain('>RID 1.1.1.1<');
    expect(html).toContain('>10.1.1.0/30<');
    expect(html).toContain('>Area 0<');
  });

  it('never creates active or external elements, even from hostile labels', () => {
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<foreignObject');
    expect(html).not.toContain('<image');
    expect(html).not.toContain('<use');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/url\((?!#)/);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}["' ;]/);
  });

  it('uses only local marker references', () => {
    const refs = [...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const id of refs) expect(html).toContain(`id="${id}"`);
  });
});
