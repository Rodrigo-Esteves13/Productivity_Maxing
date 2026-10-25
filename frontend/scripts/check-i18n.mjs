// Confere as 8 linguas contra o ingles: chaves em falta/a mais, placeholders
// {nome} iguais e textos que ficaram iguais ao ingles (copia por traduzir).
// Uso (na pasta frontend): node scripts/check-i18n.mjs
// Sai com codigo 1 se houver problemas (podes pô-lo no CI).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'src', 'i18n', 'messages');
const langs = readdirSync(root).filter((d) => !d.includes('.'));
const entry = /^\s*['"]([^'"]+)['"]:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),?\s*$/gm;

// Texto igual ao ingles so conta como problema se tiver pelo menos esta
// quantidade de letras seguidas (palavras curtas como "OK", "Email", "Status"
// sao iguais em varias linguas de proposito).
const MIN_WORD_FOR_SAME_CHECK = /\p{L}{4,}.*\s.*\p{L}{4,}/u;

// Valores que podem ficar iguais ao ingles em qualquer lingua: nomes de
// marcas/produtos, termos tecnicos e exemplos. Acrescentar aqui (com razao)
// em vez de traduzir um nome proprio.
const SAME_AS_EN_ALLOWED_VALUES = new Set([
  'Productivity Maxing',
  'Google Calendar',
  'Google Maps',
  // Em alemao "Agent" escreve-se igual.
  'EULA (Agent)',
]);
// Chaves (prefixo) que podem ficar iguais ao ingles em todas as linguas.
const SAME_AS_EN_ALLOWED_KEY_PREFIXES = [
  // Placeholders do import de horario: exemplos de palavras-chave que
  // aparecem nos .ics/Excel reais (ja misturam linguas de proposito).
  'ui.teacherProfessor',
  'ui.holidayExam',
  // Termo tecnico (cabecalho HTTP), igual em todas as linguas.
  'ui.userAgent',
];

const load = (lang) => {
  const out = {};
  for (const file of readdirSync(join(root, lang))) {
    if (file === 'index.ts') continue;
    const src = readFileSync(join(root, lang, file), 'utf8');
    for (const m of src.matchAll(entry)) out[m[1]] = m[2];
  }
  return out;
};
const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
const unquote = (s) => s.slice(1, -1);
const sameAsEnAllowed = (key, value) =>
  SAME_AS_EN_ALLOWED_VALUES.has(unquote(value)) ||
  SAME_AS_EN_ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
  !MIN_WORD_FOR_SAME_CHECK.test(unquote(value).replace(/\{\w+\}/g, ''));

const en = load('en');
let problems = 0;
for (const lang of langs.filter((l) => l !== 'en')) {
  const dict = load(lang);
  for (const key of Object.keys(en)) {
    if (!(key in dict)) { console.log(`${lang}: falta ${key}`); problems++; }
    else if (ph(en[key]) !== ph(dict[key])) { console.log(`${lang}: placeholders diferentes em ${key}`); problems++; }
    else if (dict[key] === en[key] && !sameAsEnAllowed(key, en[key])) {
      console.log(`${lang}: igual ao ingles em ${key}`);
      problems++;
    }
  }
  for (const key of Object.keys(dict)) {
    if (!(key in en)) { console.log(`${lang}: chave a mais ${key}`); problems++; }
  }
}
console.log(`${Object.keys(en).length} chaves, ${langs.length} linguas, ${problems} problemas`);
process.exit(problems ? 1 : 0);
