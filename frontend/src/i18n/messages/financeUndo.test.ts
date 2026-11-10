import { describe, expect, it } from 'vitest';
import { financeUndo as de } from './de/financeUndo';
import { financeUndo as en } from './en/financeUndo';
import { financeUndo as es } from './es/financeUndo';
import { financeUndo as fr } from './fr/financeUndo';
import { financeUndo as ja } from './ja/financeUndo';
import { financeUndo as ko } from './ko/financeUndo';
import { financeUndo as pt } from './pt/financeUndo';
import { financeUndo as zh } from './zh/financeUndo';

const PREFIX = 'financeUndo.';
const CONFIRM_VARS = ['{amount}', '{name}', '{date}'];
const EM_DASH = '—';
const ALL = { de, en, es, fr, ja, ko, pt, zh };

describe('financeUndo i18n', () => {
  const enKeys = Object.keys(en).sort();

  it.each(Object.entries(ALL))('%s has the same prefixed keys as en', (_lang, dict) => {
    expect(Object.keys(dict).sort()).toEqual(enKeys);
    for (const key of Object.keys(dict)) expect(key.startsWith(PREFIX)).toBe(true);
  });

  it.each(Object.entries(ALL))('%s keeps the confirm placeholders and has no em dashes', (_lang, dict) => {
    for (const v of CONFIRM_VARS) expect(dict['financeUndo.confirmMessage']).toContain(v);
    for (const text of Object.values(dict)) {
      expect(text.trim()).not.toBe('');
      expect(text).not.toContain(EM_DASH);
    }
  });
});
