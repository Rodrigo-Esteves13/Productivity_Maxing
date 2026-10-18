// Confere as 8 linguas contra o ingles: chaves em falta/a mais e placeholders
// {nome} iguais. Uso (na pasta frontend): node scripts/check-i18n.mjs
// Sai com codigo 1 se houver problemas (podes pô-lo no CI).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'src', 'i18n', 'messages');
const langs = readdirSync(root).filter((d) => !d.includes('.'));
const entry = /^\s*'([^']+)':\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),?\s*$/gm;

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

const en = load('en');
let problems = 0;
for (const lang of langs.filter((l) => l !== 'en')) {
  const dict = load(lang);
  for (const key of Object.keys(en)) {
    if (!(key in dict)) { console.log(`${lang}: falta ${key}`); problems++; }
    else if (ph(en[key]) !== ph(dict[key])) { console.log(`${lang}: placeholders diferentes em ${key}`); problems++; }
  }
  for (const key of Object.keys(dict)) {
    if (!(key in en)) { console.log(`${lang}: chave a mais ${key}`); problems++; }
  }
}
console.log(`${Object.keys(en).length} chaves, ${langs.length} linguas, ${problems} problemas`);
process.exit(problems ? 1 : 0);
