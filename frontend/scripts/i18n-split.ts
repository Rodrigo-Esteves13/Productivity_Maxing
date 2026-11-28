// Parte cada dicionario em NUCLEO + RESTO (F-43).
//
// Regra (verificavel, sem lista de chaves a manter a mao):
// - O nucleo leva todas as chaves que o codigo "de arranque" pode usar: os
//   ficheiros alcancaveis a partir de src/main.tsx por imports estaticos e por
//   import() dinamicos, EXCETO os que passam por lazyWithPreload(). E o codigo
//   que pode correr antes de o resto chegar (login, registo de rotas, hosts
//   globais, toasts, modais globais, translateNow em utils, etc.).
// - Tudo o que vem por lazyWithPreload() (paginas, paleta, modais pontuais) so
//   monta depois de o dicionario inteiro estar carregado: o proprio
//   lazyWithPreload espera por ele (ver src/lib/lazyWithPreload.ts).
// - Chaves no codigo de arranque: cada string literal que e uma chave; cada
//   literal com ponto que e prefixo de chaves ('ui.' + x); cada template
//   `prefixo.${x}` (todas as chaves com esse prefixo). Chamadas t(variavel)
//   dependem de a variavel vir de literais do mesmo codigo (que ja entram pela
//   regra acima): cada uma tem de estar revista em REVIEWED_INDIRECT_CALLS, e
//   o check-i18n falha se aparecer uma nova.
//
// Sem o plugin (vite dev, vitest) os ficheiros src/i18n/split/<lang>.core.ts
// trazem o dicionario inteiro e os .rest.ts vem vazios: o comportamento e o
// mesmo, so sem a divisao. O plugin so corre no build.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { Plugin } from 'vite';

export const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));
const MESSAGES_DIR = join(SRC_DIR, 'i18n', 'messages');
const SPLIT_DIR = join(SRC_DIR, 'i18n', 'split');
const ENTRY_FILE = join(SRC_DIR, 'main.tsx');
// Quem carrega por aqui espera pelo dicionario inteiro antes de montar.
const GATED_LOADERS = new Set(['lazyWithPreload']);
// Funcoes de traducao cuja chave e verificada.
const TRANSLATE_FUNCTIONS = new Set(['t', 'translateNow']);
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', `${sep}index.ts`, `${sep}index.tsx`];
// src/i18n/split/<lang>.<core|rest>.ts (id do Vite, com / ou \).
const SPLIT_MODULE_ID = /[\\/]src[\\/]i18n[\\/]split[\\/](\w+)\.(core|rest)\.ts$/;

export type SplitPart = 'core' | 'rest';

// Chamadas t(variavel) no codigo de arranque, revistas uma a uma: a variavel
// so pode ter valores que sao literais (ou templates com prefixo) em ficheiros
// do proprio codigo de arranque, ou vir de codigo lazyWithPreload (que so
// corre com o dicionario inteiro). Formato: 'caminho/em/src: expressao'.
// Ao acrescentar uma, confirmar de onde vem o valor.
export const REVIEWED_INDIRECT_CALLS = new Set([
  // Tabelas de rotulos (Record/arrays de literais no mesmo ficheiro ou num
  // modulo de configuracao importado por ele).
  'components/Accessibility/BadgeUnlockWatcher.tsx: badgeLabelKey(badge)',
  'lib/taskReadiness.ts: hiddenKey',
  'utils/taskDateStatus.ts: noCountdownKey',
  'context/FeedbackProvider.tsx: DEFAULT_CONFIRM_TITLE',
  'context/FeedbackProvider.tsx: DEFAULT_CONFIRM_LABEL',
  'context/FeedbackProvider.tsx: DEFAULT_CANCEL_LABEL',
  'components/Layout/SectionMenu.tsx: SECTION_LABEL_KEY[section]',
  'components/Layout/SectionMenu.tsx: page.labelKey',
  'components/Layout/RelatedLinks.tsx: link.labelKey',
  'components/CommandPalette/ShortcutsHelpModal.tsx: target.labelKey',
  'components/ApprovalRules/ApprovalRulesModal.tsx: nameKey',
  'components/ApprovalRules/ApprovalRulesModal.tsx: ROUNDING_LABEL_KEY[option]',
  'components/ApprovalRules/CustomRulesFieldset.tsx: CUSTOM_RULE_KIND_LABEL_KEY[kind]',
  'components/ApprovalRules/CustomRulesFieldset.tsx: ruleErrors.label',
  'components/ApprovalRules/NumberField.tsx: error',
  'components/Feedback/FeedbackModal.tsx: errorKeyFor(getHttpStatus(err))',
  'components/Feedback/FeedbackModal.tsx: c.key',
  'components/Footer/FooterBottomBar.tsx: label',
  'components/Footer/FooterLinkGroup.tsx: item.label',
  'components/Navbar/AdminMenu.tsx: link.labelKey',
  'components/Navbar/MobileMenu.tsx: item.labelKey',
  'components/Navbar/MobileMenu.tsx: SECTION_LABEL_KEY[group.section]',
  'components/Navbar/MobileMenu.tsx: SECTION_LABEL_KEY.admin',
  'components/Navbar/UserMenu.tsx: SECTION_LABEL_KEY[group.section]',
  'components/Navbar/UserMenu.tsx: item.labelKey',
  'components/Navbar/NavLinks.tsx: item.labelKey',
  'components/Home/FaqSection.tsx: item.question',
  'components/Home/FaqSection.tsx: item.answer',
  "components/Tasks/OnTimePrompt.tsx: isTwoPhase ? QUESTION_KEY[phase] : 'onTime.askSingle'",
  // Vem das paginas (props): so corre dentro de paginas lazyWithPreload.
  'components/Layout/PageTrail.tsx: p.labelKey',
  'components/Layout/PageTrail.tsx: tabKey',
]);

// ---------------------------------------------------------------------------
// Dicionarios: lidos do codigo-fonte (sem executar), pela mesma ordem de
// spread do index.ts de cada lingua. Formato fora do esperado -> erro (o build
// falha em vez de gerar um dicionario errado).

function parseFile(file: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function exportedObject(file: string, name: string): ts.ObjectLiteralExpression {
  const source = parseFile(file);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      const init = declaration.initializer && unwrap(declaration.initializer);
      if (init && ts.isObjectLiteralExpression(init)) return init;
    }
  }
  throw new Error(`i18n-split: ${file} nao exporta o objeto literal '${name}'.`);
}

function propertyName(name: ts.PropertyName, file: string): string {
  if (ts.isStringLiteralLike(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name)) return name.text;
  throw new Error(`i18n-split: ${file} tem uma chave calculada (${name.getText()}).`);
}

function importMap(file: string): Map<string, { path: string; exported: string }> {
  const map = new Map<string, { path: string; exported: string }>();
  for (const statement of parseFile(file).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const path = resolveImport(file, statement.moduleSpecifier.text);
    if (!path) continue;
    for (const element of bindings.elements) {
      map.set(element.name.text, { path, exported: (element.propertyName ?? element.name).text });
    }
  }
  return map;
}

function addEntries(target: Map<string, string>, object: ts.ObjectLiteralExpression, file: string): void {
  const imports = importMap(file);
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property) && ts.isIdentifier(property.expression)) {
      const source = imports.get(property.expression.text);
      if (!source) throw new Error(`i18n-split: ${file} faz spread de '${property.expression.text}' sem import.`);
      addEntries(target, exportedObject(source.path, source.exported), source.path);
      continue;
    }
    if (ts.isPropertyAssignment(property)) {
      const key = propertyName(property.name, file);
      const value = unwrap(property.initializer);
      if (!ts.isStringLiteralLike(value)) {
        throw new Error(`i18n-split: ${file} tem um valor que nao e texto literal em '${key}'.`);
      }
      // Como no spread do JS: a ultima definicao ganha (e passa para o fim).
      target.delete(key);
      target.set(key, value.text);
      continue;
    }
    throw new Error(`i18n-split: ${file} tem uma entrada fora do formato 'chave: "texto"'.`);
  }
}

export function listLanguages(): string[] {
  return readdirSync(MESSAGES_DIR).filter((entry) => statSync(join(MESSAGES_DIR, entry)).isDirectory());
}

export function readDictionary(lang: string): Map<string, string> {
  const index = join(MESSAGES_DIR, lang, 'index.ts');
  const entries = new Map<string, string>();
  addEntries(entries, exportedObject(index, lang), index);
  return entries;
}

// ---------------------------------------------------------------------------
// Codigo de arranque: grafo de imports a partir de main.tsx.

function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(from), specifier);
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function isInside(file: string, dir: string): boolean {
  return file.startsWith(dir + sep) || file.startsWith(`${dir}/`);
}

function srcPath(file: string): string {
  return relative(SRC_DIR, file).split(sep).join('/');
}

function isTranslateCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return TRANSLATE_FUNCTIONS.has(callee.text);
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't';
}

// Chave que o proprio literal ja cobre: texto, template com prefixo, ternario
// ou ?? / || entre chaves cobertas, ou 'prefixo.' + algo.
function isCoveredKeyExpression(node: ts.Expression): boolean {
  const expr = unwrap(node);
  if (ts.isStringLiteralLike(expr)) return true;
  if (ts.isTemplateExpression(expr)) return expr.head.text !== '';
  if (ts.isConditionalExpression(expr)) {
    return isCoveredKeyExpression(expr.whenTrue) && isCoveredKeyExpression(expr.whenFalse);
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) return ts.isStringLiteralLike(unwrap(expr.left));
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) {
      return isCoveredKeyExpression(expr.left) && isCoveredKeyExpression(expr.right);
    }
  }
  return false;
}

export interface CoreZoneScan {
  files: string[];
  strings: Set<string>;
  prefixes: Set<string>;
  indirectCalls: string[];
}

export function scanCoreZone(entry: string = ENTRY_FILE): CoreZoneScan {
  const seen = new Set<string>();
  const stack = [entry];
  const strings = new Set<string>();
  const prefixes = new Set<string>();
  const indirectCalls: string[] = [];

  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = parseFile(file);
    const follow = (specifier: string) => {
      const target = resolveImport(file, specifier);
      // Os dicionarios em si nao sao codigo de arranque.
      if (target && !isInside(target, MESSAGES_DIR) && !isInside(target, SPLIT_DIR)) stack.push(target);
    };
    const visit = (node: ts.Node, gated: boolean): void => {
      if (ts.isImportDeclaration(node)) {
        if (!node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) follow(node.moduleSpecifier.text);
        return;
      }
      if (ts.isExportDeclaration(node)) {
        if (!node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          follow(node.moduleSpecifier.text);
        }
        return;
      }
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const [specifier] = node.arguments;
          if (!gated && specifier && ts.isStringLiteralLike(specifier)) follow(specifier.text);
          return;
        }
        if (ts.isIdentifier(node.expression) && GATED_LOADERS.has(node.expression.text)) {
          node.arguments.forEach((arg) => visit(arg, true));
          return;
        }
        const [key] = node.arguments;
        if (isTranslateCall(node) && key && !isCoveredKeyExpression(key)) {
          indirectCalls.push(`${srcPath(file)}: ${key.getText(source).replace(/\s+/g, ' ')}`);
        }
      }
      if (ts.isStringLiteralLike(node)) strings.add(node.text);
      if (ts.isTemplateExpression(node) && node.head.text !== '') prefixes.add(node.head.text);
      ts.forEachChild(node, (child) => visit(child, gated));
    };
    visit(source, false);
  }

  return { files: [...seen].map(srcPath).sort(), strings, prefixes, indirectCalls };
}

function keysWithPrefix(sortedKeys: string[], prefix: string): string[] {
  let low = 0;
  let high = sortedKeys.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sortedKeys[mid] < prefix) low = mid + 1;
    else high = mid;
  }
  const out: string[] = [];
  for (let i = low; i < sortedKeys.length && sortedKeys[i].startsWith(prefix); i++) out.push(sortedKeys[i]);
  return out;
}

export function computeCoreKeys(allKeys: Iterable<string>, scan: CoreZoneScan): Set<string> {
  const keySet = new Set(allKeys);
  const sorted = [...keySet].sort();
  const core = new Set<string>();
  for (const literal of scan.strings) {
    if (keySet.has(literal)) core.add(literal);
    else if (literal.includes('.')) keysWithPrefix(sorted, literal).forEach((key) => core.add(key));
  }
  for (const prefix of scan.prefixes) keysWithPrefix(sorted, prefix).forEach((key) => core.add(key));
  return core;
}

export function unreviewedIndirectCalls(scan: CoreZoneScan): string[] {
  return [...new Set(scan.indirectCalls)].filter((call) => !REVIEWED_INDIRECT_CALLS.has(call)).sort();
}

export function staleReviewedCalls(scan: CoreZoneScan): string[] {
  const present = new Set(scan.indirectCalls);
  return [...REVIEWED_INDIRECT_CALLS].filter((call) => !present.has(call)).sort();
}

export function splitDictionary(
  dictionary: Map<string, string>,
  coreKeys: Set<string>,
  part: SplitPart,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of dictionary) {
    if (coreKeys.has(key) === (part === 'core')) out[key] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plugin do build: troca o conteudo de src/i18n/split/<lang>.<parte>.ts pela
// parte certa do dicionario. So no build: em dev fica tudo no nucleo (HMR dos
// textos continua a funcionar como antes).
export function i18nSplitPlugin(): Plugin {
  let coreKeys: Set<string> | null = null;
  const dictionaries = new Map<string, Map<string, string>>();
  return {
    name: 'pmaxing-i18n-split',
    apply: 'build',
    enforce: 'pre',
    buildStart() {
      dictionaries.clear();
      const scan = scanCoreZone();
      coreKeys = computeCoreKeys(readDictionary('en').keys(), scan);
      const unreviewed = unreviewedIndirectCalls(scan);
      if (unreviewed.length > 0) {
        this.warn(
          `t(variavel) por rever no codigo de arranque (ver scripts/i18n-split.ts):\n${unreviewed.join('\n')}`,
        );
      }
    },
    load(id) {
      const match = SPLIT_MODULE_ID.exec(id.split('?')[0]);
      if (!match || !coreKeys) return null;
      const [, lang, part] = match;
      let dictionary = dictionaries.get(lang);
      if (!dictionary) {
        dictionary = readDictionary(lang);
        dictionaries.set(lang, dictionary);
      }
      const entries = splitDictionary(dictionary, coreKeys, part as SplitPart);
      return `export const dict = ${JSON.stringify(entries)};\n`;
    },
  };
}
