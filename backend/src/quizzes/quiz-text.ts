// Limpeza de texto dos quizzes, partilhada pela verificacao do import
// (quizImport.ts) e pelos diagramas (quizDiagram.ts).
// Copia de frontend/src/lib/quizText.ts: manter as duas iguais.
//
// O resultado e sempre um ponto fixo: limpar outra vez o texto limpo nao muda
// nada (nem conta como perigoso). O servidor depende disto para aceitar so
// quizzes que ja chegam na forma canonica (ver recheckCanonicalQuiz).

// Etiquetas HTML conhecidas: so estas sao removidas, para nao comer texto
// como "<interface>" ou "a < b" em perguntas tecnicas. [^<>] (e nao [^>])
// para que "<b<b<b..." nao faca a procura voltar ao fim do texto a cada "<".
const HTML_TAGS =
  'a|abbr|audio|b|base|blockquote|body|br|button|code|del|details|div|em|embed|form|frame|frameset|h[1-6]|head|hr|html|i|iframe|img|input|ins|kbd|label|li|link|mark|math|meta|object|ol|option|p|pre|s|script|select|small|source|span|strong|style|sub|summary|sup|svg|table|tbody|td|template|textarea|th|thead|tr|u|ul|video';
const TAG = new RegExp(`<\\/?(?:${HTML_TAGS})\\b[^<>]*>`, 'gi');
// Blocos cujo conteudo tambem sai (codigo ou estilos, nunca texto util). O
// conteudo para no proximo "<bloco" ou "</bloco", por isso a procura e linear.
const DROP_BLOCK =
  /<(script|style|iframe|object|embed|template|svg|math)\b[^<>]*>(?:(?!<\/?\1\b)[\s\S])*<\/\1\s*>/gi;
const BREAK = /<br\b[^<>]*>/gi;
const BOLD = /<\/?(?:b|strong)\b[^<>]*>/gi;
const ITALIC = /<\/?(?:i|em)\b[^<>]*>/gi;
const CODE = /<\/?code\b[^<>]*>/gi;
const DANGER_TAG_NAMES =
  'script|iframe|object|embed|style|svg|img|link|meta|form|base|frame';
// Conteudo perigoso (conta no aviso 'content'). Cada parte tem a sua
// neutralizacao abaixo, por isso o texto limpo nunca volta a corresponder.
const DANGER = new RegExp(
  `<\\s*\\/?\\s*(?:${DANGER_TAG_NAMES})\\b|javascript\\s*:|vbscript\\s*:|data\\s*:\\s*text\\/html|<\\/?[a-z][a-z0-9-]*[\\s/][^<>]*\\bon[a-z]+\\s*=`,
  'i',
);
// "<" de uma etiqueta perigosa que nao saiu acima (ex.: "< script", sem ">").
const DANGER_TAG_START = new RegExp(
  `<(?=\\s*\\/?\\s*(?:${DANGER_TAG_NAMES})\\b)`,
  'gi',
);
const SCHEME = /javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/gi;
// "<" de uma etiqueta com atributo de evento (ex.: "<foo onerror=x>"); texto
// como "a < b; x.onclick = f" fica igual.
const HANDLER_TAG_START = /<(?=\/?[a-z][a-z0-9-]*[\s/][^<>]*\bon[a-z]+\s*=)/gi;
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
const MAX_CODE_POINT = 0x10ffff;
const HEX_RADIX = 16;
const DECIMAL_RADIX = 10;

// Passagens maximas ate o texto estabilizar ("&amp;amp;lt;..." perde um nivel
// por passagem). Se nao estabilizar, o texto sai inteiro.
const CLEAN_MAX_PASSES = 8;
// Antes de limpar, o texto e cortado a max * este fator (unidades UTF-16): um
// campo enorme nunca custa mais do que um campo grande.
const CLEAN_INPUT_FACTOR = 8;

// Controlo (menos tab e nova linha), zero-width, marcas de direcao (texto trocado),
// carateres invisiveis (hifen suave, preenchimentos Hangul, formatacao) e tags
// Unicode ("ASCII smuggling"), em intervalos de code points para nao por
// caracteres invisiveis no codigo. O U+200D (ZWJ) fica: junta os emoji compostos.
const UNSAFE_CHAR_RANGES: [number, number][] = [
  [0x00, 0x08],
  [0x0b, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x34f, 0x34f],
  [0x61c, 0x61c],
  [0x115f, 0x1160],
  [0x200b, 0x200c],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  // Inclui 2060-2064 (invisiveis), 2066-2069 (isolamento bidi) e 206A-206F (obsoletos).
  [0x2060, 0x206f],
  [0x3164, 0x3164],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xe0000, 0xe007f],
  // Surrogates soltos (rebentam o jsonb e encodeURIComponent) e nao-caracteres.
  [0xd800, 0xdfff],
  [0xfffe, 0xffff],
];
const isUnsafeChar = (char: string) => {
  const code = char.codePointAt(0) ?? 0;
  return UNSAFE_CHAR_RANGES.some(([from, to]) => code >= from && code <= to);
};
export const stripUnsafeChars = (text: string) =>
  Array.from(text)
    .filter((char) => !isUnsafeChar(char))
    .join('');

function decodeEntities(text: string): string {
  return text.replace(ENTITY, (whole, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1].toLowerCase() === 'x';
      const code = isHex
        ? parseInt(body.slice(2), HEX_RADIX)
        : parseInt(body.slice(1), DECIMAL_RADIX);
      return Number.isFinite(code) && code > 0 && code <= MAX_CODE_POINT
        ? String.fromCodePoint(code)
        : '';
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

// Espacos e tabs no fim de cada linha, sem regex (um regex aqui seria quadratico
// numa linha so de espacos).
function trimLineEnds(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let end = line.length;
      while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t'))
        end -= 1;
      return line.slice(0, end);
    })
    .join('\n');
}

export interface QuizTextOptions {
  // Mantem quebras de linha (enunciados, explicacoes, codigo).
  multiline: boolean;
  // <b>, <i> e <code> passam a markdown minimo; sem isto saem como as outras.
  markdown: boolean;
}

export interface QuizTextResult {
  text: string;
  // Havia HTML perigoso, esquemas ou eventos (ou o texto nao estabilizou).
  dangerous: boolean;
}

// Uma passagem de limpeza. Nunca aumenta o numero de code points.
function cleanPass(
  text: string,
  options: QuizTextOptions,
  flag: { dangerous: boolean },
): string {
  let out = stripUnsafeChars(decodeEntities(stripUnsafeChars(text)));
  if (DANGER.test(out)) flag.dangerous = true;
  out = out
    .replace(DROP_BLOCK, '')
    .replace(BREAK, '\n')
    .replace(BOLD, options.markdown ? '**' : '')
    .replace(ITALIC, options.markdown ? '*' : '')
    .replace(CODE, options.markdown ? '`' : '')
    .replace(TAG, '')
    .replace(DANGER_TAG_START, '')
    .replace(SCHEME, '')
    .replace(HANDLER_TAG_START, '')
    .replace(/\r\n?/g, '\n');
  out = trimLineEnds(out).replace(/\n{3,}/g, '\n\n');
  if (!options.multiline) out = out.replace(/\s+/g, ' ');
  return out.trim();
}

// Repete a passagem ate o texto nao mudar; null se nao estabilizar.
function converge(
  text: string,
  options: QuizTextOptions,
  flag: { dangerous: boolean },
): string | null {
  let current = text;
  for (let pass = 0; pass < CLEAN_MAX_PASSES; pass += 1) {
    const next = cleanPass(current, options, flag);
    if (next === current) return current;
    current = next;
  }
  return null;
}

// Texto limpo e canonico: cleanQuizText(cleanQuizText(x).text) === cleanQuizText(x).text.
export function cleanQuizText(
  raw: unknown,
  max: number,
  options: QuizTextOptions,
): QuizTextResult {
  if (typeof raw !== 'string' && typeof raw !== 'number')
    return { text: '', dangerous: false };
  const flag = { dangerous: false };
  let text = converge(
    String(raw).slice(0, max * CLEAN_INPUT_FACTOR),
    options,
    flag,
  );
  // Corta por code point (um slice podia partir um par de surrogates) e volta a
  // estabilizar: o corte pode deixar espacos no fim ou um "<script" sem fim.
  if (text !== null && Array.from(text).length > max)
    text = converge(Array.from(text).slice(0, max).join(''), options, flag);
  if (text === null) return { text: '', dangerous: true };
  return { text, dangerous: flag.dangerous };
}
