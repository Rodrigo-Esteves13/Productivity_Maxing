import { describe, expect, it } from 'vitest';
import { foldText, snippetAround } from './textSearch';

describe('foldText', () => {
  it('ignores case and accents', () => {
    expect(foldText('Revisão ÁLGEBRA Ç')).toBe('revisao algebra c');
  });
});

describe('snippetAround', () => {
  it('returns null when the query is not there', () => {
    expect(snippetAround('Ler o capítulo 3', foldText('exame'))).toBeNull();
    expect(snippetAround('Ler o capítulo 3', '')).toBeNull();
  });

  it('keeps the original accents and case of the match', () => {
    expect(snippetAround('Fazer a revisão do teste', foldText('REVISAO'))).toEqual({
      before: 'Fazer a ',
      match: 'revisão',
      after: ' do teste',
    });
  });

  it('cuts long text before the match and flattens line breaks', () => {
    const text = `${'x'.repeat(50)} antes\n\nprotocolo TCP\ndepois`;
    expect(snippetAround(text, foldText('tcp'), 10)).toEqual({
      before: '...protocolo ',
      match: 'TCP',
      after: ' depois',
    });
  });

  it('maps positions when folding changes the length', () => {
    // Acento como caractere a parte: "a" + U+0303 perde um caractere.
    const decomposed = 'Fazer a revisão do teste';
    expect(snippetAround(decomposed, foldText('revisao do'))).toEqual({
      before: 'Fazer a ',
      match: 'revisão do',
      after: ' teste',
    });
  });
});
