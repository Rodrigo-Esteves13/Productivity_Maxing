// Leitor CSV pequeno (RFC 4180): aspas, aspas duplicadas, virgulas e
// quebras de linha dentro de aspas, CRLF/LF/CR e BOM no inicio.

const BOM = '\uFEFF';
const QUOTE = '"';
const COMMA = ',';
const CR = '\r';
const LF = '\n';

/** Linhas de celulas. Linhas totalmente vazias saem fora. */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== QUOTE) cell += ch;
      else if (src[i + 1] === QUOTE) {
        cell += QUOTE;
        i++;
      } else quoted = false;
      continue;
    }
    if (ch === QUOTE) quoted = true;
    else if (ch === COMMA) endCell();
    else if (ch === LF) endRow();
    else if (ch === CR) {
      if (src[i + 1] === LF) i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

// Inverso do neutralizeFormulaPrefix de escapeCsvField (taskExportFormats.ts):
// tira o apostrofo posto antes de = + - @ TAB CR no inicio de cada linha.
const NEUTRALIZED_FORMULA_PREFIX = /(^|[\r\n])'(?=[=+\-@\t\r])/g;

export function unneutralizeFormulaPrefix(value: string): string {
  return value.replace(NEUTRALIZED_FORMULA_PREFIX, '$1');
}
