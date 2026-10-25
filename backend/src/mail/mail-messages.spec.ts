import { PUSH_LANGUAGES } from '../push/push-messages';
import {
  deadlineEmailText,
  fillMailTemplate,
  MAIL_DATE_LOCALE,
  resolveMailLanguage,
} from './mail-messages';

describe('mail-messages (D-12)', () => {
  it('has deadline email text and a date locale for every app language', () => {
    for (const lang of PUSH_LANGUAGES) {
      const text = deadlineEmailText(lang);
      expect(text.subjectOne).toContain('{title}');
      expect(text.subjectMany).toContain('{count}');
      expect(text.dueOn).toContain('{date}');
      expect(text.dueInHours).toContain('{hours}');
      expect(MAIL_DATE_LOCALE[lang]).toBeTruthy();
    }
  });

  it('falls back to English for unknown or missing languages', () => {
    expect(resolveMailLanguage('xx')).toBe('en');
    expect(resolveMailLanguage(undefined)).toBe('en');
    expect(resolveMailLanguage('de')).toBe('de');
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(fillMailTemplate('Due soon: {title} {x}', { title: 'A' })).toBe(
      'Due soon: A {x}',
    );
  });
});
