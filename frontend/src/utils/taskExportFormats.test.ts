import { describe, expect, it } from 'vitest';
import { escapeCsvField } from './taskExportFormats';

describe('escapeCsvField', () => {
  it('leaves plain fields unquoted', () => {
    expect(escapeCsvField('Essay')).toBe('Essay');
    expect(escapeCsvField('a-b')).toBe('a-b');
  });

  it('quotes commas, quotes, LF and CR', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('a\nb')).toBe('"a\nb"');
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });

  it('neutralizes a formula prefix on the first character', () => {
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
    expect(escapeCsvField('+1')).toBe("'+1");
    expect(escapeCsvField('-1')).toBe("'-1");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvField('\t=1')).toBe("'\t=1");
  });

  it('neutralizes a formula at the start of any line in the cell', () => {
    expect(escapeCsvField('rent\r=HYPERLINK("http://x","y")')).toBe('"rent\r\'=HYPERLINK(""http://x"",""y"")"');
    expect(escapeCsvField('rent\n+1')).toBe('"rent\n\'+1"');
    expect(escapeCsvField('rent\r\n@cmd')).toBe('"rent\r\n\'@cmd"');
  });

  it('a leading CR is itself neutralized and quoted', () => {
    expect(escapeCsvField('\r=1')).toBe('"\'\r\'=1"');
  });

  it('does not touch triggers in the middle of a line', () => {
    expect(escapeCsvField('a=b')).toBe('a=b');
    expect(escapeCsvField('x @y')).toBe('x @y');
  });
});
