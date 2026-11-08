import { describe, expect, it } from 'vitest';
import { parseCsv, unneutralizeFormulaPrefix } from './csvParse';
import { escapeCsvField } from './taskExportFormats';

describe('parseCsv', () => {
  it('splits plain cells and rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quotes, doubled quotes, commas and newlines inside quotes', () => {
    expect(parseCsv('"a,b","say ""hi""","line1\nline2"')).toEqual([['a,b', 'say "hi"', 'line1\nline2']]);
  });

  it('handles CRLF, lone CR and a missing final newline', () => {
    expect(parseCsv('a,b\r\n1,2\r3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('strips a leading BOM and skips blank lines', () => {
    expect(parseCsv('﻿a,b\n\n,\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps empty cells', () => {
    expect(parseCsv('a,,c,')).toEqual([['a', '', 'c', '']]);
  });
});

describe('unneutralizeFormulaPrefix', () => {
  it.each(['=SUM(A1)', '+1', '-1+2', '@Ana', '\tx', 'a\n=b', 'plain', "it's"])('round-trips %j through escapeCsvField', (value) => {
    const [[cell]] = parseCsv(escapeCsvField(value));
    expect(unneutralizeFormulaPrefix(cell)).toBe(value);
  });
});
