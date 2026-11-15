import { describe, expect, it } from 'vitest';
import { cleanQuizText } from './quizText';

const MAX = 500;
const opts = { multiline: true, markdown: true };
const clean = (raw: string) => cleanQuizText(raw, MAX, opts).text;
// Nenhum '<' seguido de letra, '!', '?' ou '/': nenhuma etiqueta HTML possivel.
const TAG_LIKE = /<[a-z!/?]/i;

describe('cleanQuizText final tag guard', () => {
  it('never leaves a tag opener, whatever the nesting trick', () => {
    const inputs = [
      '<<script>alert(1)</script>',
      '<scr<script>ipt>alert(1)</script>',
      '<<iframe src=x>',
      '<img src=x onerror=alert(1)>',
      '<!-- x --><svg/onload=alert(1)>',
      '&lt;script&gt;alert(1)&lt;/script&gt;',
      '<a href="javascript:alert(1)">x</a>',
      '<?xml version="1.0"?><x/>',
    ];
    for (const input of inputs) {
      const out = clean(input);
      expect(out).not.toMatch(TAG_LIKE);
      expect(clean(out)).toBe(out);
    }
  });

  it('keeps technical text readable', () => {
    expect(clean('a < b and 3<5')).toBe('a < b and 3<5');
    expect(clean('show ip ospf interface <interface-id>')).toBe('show ip ospf interface ＜interface-id>');
  });
});

describe('cleanQuizText markup scanner', () => {
  const plain = (raw: string) => cleanQuizText(raw, MAX, { multiline: true, markdown: false }).text;

  it('turns known formatting tags into markdown, or drops them', () => {
    expect(clean('<b>bold</b>')).toBe('**bold**');
    expect(clean('<STRONG>x</Strong> <EM>y</em> <code>z</CODE>')).toBe('**x** *y* `z`');
    expect(plain('<b>bold</b> <i>x</i>')).toBe('bold x');
    expect(clean('a<br>b<BR/>c')).toBe('a\nb\nc');
    expect(clean('x</b >y')).toBe('x**y');
    expect(clean('<DIV class="c">x</DIV>')).toBe('x');
  });

  it('drops script-like blocks with their content, to the end when unterminated', () => {
    expect(clean('a<SCRIPT>x</script >b')).toBe('ab');
    expect(clean('a<script>x')).toBe('a');
    expect(clean('a<style>x</style>b<svg><g/></svg>c')).toBe('abc');
    expect(clean('a<scr<script>ipt>alert(1)</script>b')).toBe('a＜scrb');
    expect(clean('<<script>alert(1)</script>')).toBe('<');
  });

  it('drops comments, to the end when unterminated', () => {
    expect(clean('a<!-- x -->b')).toBe('ab');
    expect(clean('a<!-- x')).toBe('a');
  });

  it('drops the opener of dangerous or event-handler tags', () => {
    expect(clean('a<script')).toBe('ascript');
    expect(clean('< script >x')).toBe('script >x');
    expect(clean('< / iframe')).toBe('/ iframe');
    expect(clean('<foo onerror=x>y')).toBe('foo onerror=x>y');
  });

  it('ends a tag at its first ">", quotes are not read', () => {
    expect(clean('<b title="a>b">x</b>')).toBe('**b">x**');
  });

  it('keeps other angle brackets, neutralizing tag-like ones', () => {
    expect(clean('<interface>')).toBe('＜interface>');
    expect(clean('<?xml?><!DOCTYPE x></x>')).toBe('＜?xml?>＜!DOCTYPE x>＜/x>');
    expect(clean('3<5 and a <= b << c')).toBe('3<5 and a <= b << c');
  });

  it('removes dangerous schemes', () => {
    expect(clean('go javascript:alert(1) VBScript :x data: text/html,y')).toBe('go alert(1) x ,y');
  });
});
