import { toUtf8TextBuffer } from './attachment-text.util';

describe('toUtf8TextBuffer', () => {
  it('keeps plain UTF-8 text as is', () => {
    const input = Buffer.from('# Title\n\nSome **text**\n', 'utf8');
    expect(toUtf8TextBuffer(input)?.toString('utf8')).toBe(
      '# Title\n\nSome **text**\n',
    );
  });

  it('converts UTF-16 LE with BOM (Windows Notepad "Unicode") to UTF-8', () => {
    const input = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('# Notas\n', 'utf16le'),
    ]);
    expect(toUtf8TextBuffer(input)?.toString('utf8')).toBe('# Notas\n');
  });

  it('converts UTF-16 BE with BOM to UTF-8', () => {
    const body = Buffer.from('# Notas\n', 'utf16le');
    body.swap16();
    const input = Buffer.concat([Buffer.from([0xfe, 0xff]), body]);
    expect(toUtf8TextBuffer(input)?.toString('utf8')).toBe('# Notas\n');
  });

  it('rejects content with NUL bytes and no UTF-16 BOM', () => {
    expect(toUtf8TextBuffer(Buffer.from([0x41, 0x00, 0x42]))).toBeNull();
  });
});
