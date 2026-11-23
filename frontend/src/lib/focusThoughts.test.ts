import { describe, expect, it } from 'vitest';
import { appendThought, FOCUS_NOTE_TITLES, NOTE_BODY_MAX_LENGTH, THOUGHT_MAX_LENGTH } from './focusThoughts';
import { readiness as en } from '../i18n/messages/en/readiness';
import { readiness as pt } from '../i18n/messages/pt/readiness';
import { readiness as es } from '../i18n/messages/es/readiness';
import { readiness as fr } from '../i18n/messages/fr/readiness';
import { readiness as de } from '../i18n/messages/de/readiness';
import { readiness as ja } from '../i18n/messages/ja/readiness';
import { readiness as ko } from '../i18n/messages/ko/readiness';
import { readiness as zh } from '../i18n/messages/zh/readiness';

describe('appendThought', () => {
  it('adds one line per thought, newest last', () => {
    const first = appendThought('', 'check phone', '10:00');
    expect(first.body).toBe('- 10:00 check phone');
    expect(appendThought(first.body, 'buy milk', '10:05').body).toBe('- 10:00 check phone\n- 10:05 buy milk');
  });

  it('ignores an empty thought', () => {
    expect(appendThought('- a', '   ', '10:00')).toEqual({ body: '- a', dropped: 0 });
  });

  it('collapses whitespace and caps the thought length', () => {
    const out = appendThought('', `a\n\n b ${'x'.repeat(500)}`, 't').body;
    expect(out.startsWith('- t a b ')).toBe(true);
    expect(out.length).toBeLessThanOrEqual('- t '.length + THOUGHT_MAX_LENGTH);
  });

  it('never splits a character made of two UTF-16 units', () => {
    const out = appendThought('', `${'a'.repeat(THOUGHT_MAX_LENGTH - 1)}\u{1F600}\u{1F600}`, 't').body;
    expect(out.endsWith('\u{1F600}')).toBe(true);
    expect(Array.from(out.slice('- t '.length)).length).toBe(THOUGHT_MAX_LENGTH);
  });

  it('drops the oldest lines when the note is full and says how many', () => {
    const old = Array.from({ length: 80 }, (_, i) => `- ${i} ${'y'.repeat(150)}`).join('\n');
    const out = appendThought(old, 'new one', 'n');
    expect(out.body.length).toBeLessThanOrEqual(NOTE_BODY_MAX_LENGTH);
    expect(out.body.endsWith('- n new one')).toBe(true);
    expect(out.body.startsWith('- 0 ')).toBe(false);
    expect(out.dropped).toBeGreaterThan(0);
  });
});

describe('FOCUS_NOTE_TITLES', () => {
  it('lists the note title of every language', () => {
    for (const messages of [en, pt, es, fr, de, ja, ko, zh]) {
      expect(FOCUS_NOTE_TITLES).toContain(messages['focus.distractions.noteTitle']);
    }
  });
});
