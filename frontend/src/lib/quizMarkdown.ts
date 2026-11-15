// Markdown minimo dos quizzes, desenhado como elementos React (nunca HTML):
// **negrito**, *italico*, `codigo`, blocos ``` e quebras de linha. O resto
// aparece tal como foi escrito.

export type InlineToken = { type: 'text' | 'bold' | 'italic' | 'code'; text: string };
export type QuizBlock = { type: 'code'; text: string } | { type: 'text'; lines: InlineToken[][] };

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g;

const INLINE_TYPES: { open: string; type: InlineToken['type'] }[] = [
  { open: '`', type: 'code' },
  { open: '**', type: 'bold' },
  { open: '*', type: 'italic' },
];

// split com grupo de captura: as partes impares sao as marcas encontradas.
export function parseInline(line: string): InlineToken[] {
  return line
    .split(INLINE)
    .map((part, i): InlineToken => {
      const mark = i % 2 === 1 ? INLINE_TYPES.find(({ open }) => part.startsWith(open)) : undefined;
      return mark
        ? { type: mark.type, text: part.slice(mark.open.length, part.length - mark.open.length) }
        : { type: 'text', text: part };
    })
    .filter((token) => token.text !== '');
}

export function parseQuizMarkdown(text: string): QuizBlock[] {
  const blocks: QuizBlock[] = [];
  const parts = text.split(/```[^\n]*\n?/);
  parts.forEach((part, i) => {
    // Partes impares estao dentro de um bloco de codigo.
    if (i % 2 === 1) {
      blocks.push({ type: 'code', text: part.replace(/\n$/, '') });
      return;
    }
    const trimmed = part.replace(/^\n+|\n+$/g, '');
    if (trimmed) blocks.push({ type: 'text', lines: trimmed.split('\n').map(parseInline) });
  });
  return blocks;
}

// Texto sem marcas (para as flashcards).
export function stripQuizMarkdown(text: string): string {
  return text.replace(/```[^\n]*\n?/g, '').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\s][^*\n]*)\*/g, '$1').replace(/`([^`\n]+)`/g, '$1').trim();
}
