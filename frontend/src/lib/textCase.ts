// Conversões de maiúsculas/minúsculas usadas na ferramenta do Notebook.
// Todas trabalham linha a linha, para que converter várias linhas de
// uma vez (ex.: uma lista) mantenha a estrutura.

export type TextCaseId =
  | 'lower'
  | 'upper'
  | 'sentence'
  | 'title'
  | 'invert'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab';

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Parte "myVarName" / "my_var-name" / "My var name" em palavras.
function splitWords(line: string): string[] {
  const spaced = line.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2');
  return spaced.match(WORD_PATTERN) ?? [];
}

function mapLines(text: string, fn: (line: string) => string): string {
  return text.split('\n').map(fn).join('\n');
}

const CONVERTERS: Record<TextCaseId, (text: string) => string> = {
  lower: (text) => text.toLowerCase(),
  upper: (text) => text.toUpperCase(),
  sentence: (text) =>
    // Maiúscula no início de cada linha e depois de ". ", "! " ou "? ".
    text
      .toLowerCase()
      .replace(/(^|\n|[.!?]\s+)(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase()),
  title: (text) =>
    text.toLowerCase().replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase()),
  invert: (text) =>
    Array.from(text)
      .map((char) => {
        const lower = char.toLowerCase();
        const upper = char.toUpperCase();
        if (lower === upper) return char;
        return char === lower ? upper : lower;
      })
      .join(''),
  camel: (text) =>
    mapLines(text, (line) =>
      splitWords(line)
        .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word)))
        .join(''),
    ),
  pascal: (text) => mapLines(text, (line) => splitWords(line).map(capitalize).join('')),
  snake: (text) => mapLines(text, (line) => splitWords(line).map((w) => w.toLowerCase()).join('_')),
  kebab: (text) => mapLines(text, (line) => splitWords(line).map((w) => w.toLowerCase()).join('-')),
};

export function convertTextCase(text: string, id: TextCaseId): string {
  return CONVERTERS[id](text);
}

// Ordem das opções na UI; labelKey vem de i18n.
export const TEXT_CASE_OPTIONS: { id: TextCaseId; labelKey: string }[] = [
  { id: 'lower', labelKey: 'notebook.case.lower' },
  { id: 'upper', labelKey: 'notebook.case.upper' },
  { id: 'sentence', labelKey: 'notebook.case.sentence' },
  { id: 'title', labelKey: 'notebook.case.title' },
  { id: 'invert', labelKey: 'notebook.case.invert' },
  { id: 'camel', labelKey: 'notebook.case.camel' },
  { id: 'pascal', labelKey: 'notebook.case.pascal' },
  { id: 'snake', labelKey: 'notebook.case.snake' },
  { id: 'kebab', labelKey: 'notebook.case.kebab' },
];
