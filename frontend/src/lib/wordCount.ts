// Contagem de palavras das notas do Notebook, com as regras do Word:
// ideogramas chineses/japoneses e kana contam um a um (essas linguas nao
// separam palavras com espacos); o resto conta por blocos entre espacos
// que tenham pelo menos uma letra ou numero ("guarda-chuva" e 1, "-" e 0).
// Regex e nao Intl.Segmenter: corre a cada tecla em textos de 50 000
// caracteres e tem de dar o mesmo numero em todos os browsers.

const EAST_ASIAN_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/gu;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function countWords(text: string): number {
  const eastAsian = text.match(EAST_ASIAN_CHAR)?.length ?? 0;
  let words = 0;
  for (const token of text.replace(EAST_ASIAN_CHAR, ' ').split(/\s+/)) {
    if (HAS_LETTER_OR_DIGIT.test(token)) words++;
  }
  return eastAsian + words;
}
