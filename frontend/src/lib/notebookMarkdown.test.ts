import { describe, expect, it } from 'vitest';
import type { NotebookEntry } from '../types/models';
import { courseToMarkdown, entryToMarkdown, markdownFileName } from './notebookMarkdown';

// Devolve a chave e as variaveis, para o teste nao depender das traducoes.
const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}(${Object.values(vars).join(',')})` : key;

function makeEntry(overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return {
    id: 'e1',
    userId: 'u1',
    areaId: 'a1',
    classOccurrenceId: null,
    title: 'Camada de transporte',
    entryType: 'CLASS',
    classNumber: 3,
    textContent: 'TCP e UDP.',
    drawingStrokes: null,
    tables: null,
    canvasShapes: null,
    canvasLinks: null,
    canvasTexts: null,
    usefulLinks: null,
    canvasHeight: null,
    date: '2026-10-01T00:00:00.000Z',
    photos: [],
    attachments: [],
    ...overrides,
  };
}

describe('entryToMarkdown', () => {
  it('writes the title, the course line and the text', () => {
    expect(entryToMarkdown(makeEntry(), 'Redes', t)).toBe(
      '# notebook.classLabel(3): Camada de transporte\n\n_Redes · notebook.type.class · 2026-10-01_\n\nTCP e UDP.\n',
    );
  });

  it('turns tables into Markdown tables without breaking on pipes or line breaks', () => {
    const md = entryToMarkdown(
      makeEntry({
        textContent: null,
        tables: [
          { id: 't1', rows: [['Protocolo', 'Porta'], ['HTTP | HTTPS', '80\n443'], ['DNS']] },
          { id: 't2', rows: [['', ''], ['', '']] },
        ],
      }),
      'Redes',
      t,
    );
    expect(md).toContain(
      '| Protocolo | Porta |\n| --- | --- |\n| HTTP \\| HTTPS | 80<br>443 |\n| DNS |  |',
    );
    // A tabela vazia nao aparece.
    expect(md.match(/\| --- \|/g)).toHaveLength(1);
  });

  it('lists links, board text and files, and flags what is not included', () => {
    const md = entryToMarkdown(
      makeEntry({
        textContent: '',
        usefulLinks: [
          { id: 'l1', label: 'RFC [793]', url: 'https://www.rfc-editor.org/rfc/rfc793 (TCP)' },
          { id: 'l2', label: '', url: '   ' },
        ],
        canvasTexts: [{ id: 'c1', x: 0, y: 0, text: 'SYN\nACK' }],
        drawingStrokes: [{ points: [] } as never],
        photos: [{ id: 'p1', notebookEntryId: 'e1', storagePath: 'x', position: 0, url: null }],
        attachments: [
          { id: 'f1', notebookEntryId: 'e1', storagePath: 'y', originalFileName: 'slides.pdf', extension: 'pdf', sizeBytes: 2_500_000, url: null },
        ],
      }),
      'Redes',
      t,
    );
    expect(md).toContain('## notebook.md.links\n\n- [RFC \\[793\\]](<https://www.rfc-editor.org/rfc/rfc793 (TCP)>)\n');
    expect(md).toContain('## notebook.md.whiteboard\n\n- SYN ACK\n\n_notebook.md.drawingNotIncluded_');
    expect(md).toContain('- slides.pdf (2.4 MB)\n- notebook.md.photos(1)\n\n_notebook.md.filesNotIncluded_');
    expect(md).not.toContain('https://cdn');
  });
});

describe('courseToMarkdown', () => {
  it('puts the oldest entry first, one level down, separated by rules', () => {
    const md = courseToMarkdown(
      'Redes',
      [
        makeEntry({ id: 'b', title: 'Segunda', classNumber: 2, date: '2026-10-08T00:00:00.000Z' }),
        makeEntry({ id: 'a', title: 'Primeira', entryType: 'NOTE', classNumber: null, date: '2026-10-01T00:00:00.000Z' }),
      ],
      t,
    );
    expect(md.startsWith('# Redes\n\n## Primeira\n')).toBe(true);
    expect(md).toContain('\n\n---\n\n## notebook.classLabel(2): Segunda\n');
  });
});

describe('markdownFileName', () => {
  it('makes a safe file name without accents', () => {
    expect(markdownFileName('Programação Web', '2026-10-01', 'Aula nº 3: Formulários')).toBe(
      'programacao-web-2026-10-01-aula-n-3-formularios.md',
    );
    expect(markdownFileName('???')).toBe('notebook.md');
  });
});
