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
