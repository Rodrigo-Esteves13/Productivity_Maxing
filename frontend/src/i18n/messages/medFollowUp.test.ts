import { describe, expect, it } from 'vitest';
import { medFollowUp as de } from './de/medFollowUp';
import { medFollowUp as en } from './en/medFollowUp';
import { medFollowUp as es } from './es/medFollowUp';
import { medFollowUp as fr } from './fr/medFollowUp';
import { medFollowUp as ja } from './ja/medFollowUp';
import { medFollowUp as ko } from './ko/medFollowUp';
import { medFollowUp as pt } from './pt/medFollowUp';
import { medFollowUp as zh } from './zh/medFollowUp';

const PREFIX = 'medFollowUp.';
const TIME_VAR = '{time}';
const ALL = { de, en, es, fr, ja, ko, pt, zh };

describe('medFollowUp i18n', () => {
  const enKeys = Object.keys(en).sort();

  it.each(Object.entries(ALL))('%s has the same prefixed keys as en', (_lang, dict) => {
    expect(Object.keys(dict).sort()).toEqual(enKeys);
    for (const key of Object.keys(dict)) expect(key.startsWith(PREFIX)).toBe(true);
  });

  it.each(Object.entries(ALL))('%s keeps the {time} placeholder', (_lang, dict) => {
    expect(dict['medFollowUp.sent']).toContain(TIME_VAR);
  });
});
