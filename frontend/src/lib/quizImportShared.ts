// Base comum da verificacao: leitura de campos, ids reservados e texto limpo.

import { foldText } from './textSearch';
import type { QuizDiagram } from './quizDiagram';
import { cleanQuizText } from './quizText';

// Chaves que nunca podem aparecer (poluicao de prototipos), nem como ids.
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Ids de perguntas e figuras servem de chave (estatisticas, figuras): nunca um
// nome herdado de Object.prototype ("toString", "valueOf", "hasOwnProperty"...).
export const isReservedId = (id: string): boolean =>
  FORBIDDEN_KEYS.has(id) || id in Object.prototype;

export interface Counters {
  dangerous: number;
  badLinks: number;
  // Figuras recusadas, partes retiradas de figuras e referencias sem figura.
  badFigures: number;
}

// Figuras lidas do quiz: id -> diagrama canonico. As usadas passam para o quiz final.
export type Figures = Map<string, QuizDiagram>;

export type Json = Record<string, unknown>;

export const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
export const pick = (obj: Json, ...keys: string[]): unknown => keys.map((k) => obj[k]).find((v) => v !== undefined);

// Texto limpo: HTML conhecido passa a markdown minimo, o resto sai.
export function sanitizeQuizText(raw: unknown, max: number, counters?: Counters, multiline = true): string {
  const { text, dangerous } = cleanQuizText(raw, max, { multiline, markdown: true });
  if (dangerous && counters) counters.dangerous += 1;
  return text;
}

export const intList = (raw: unknown): number[] =>
  (Array.isArray(raw) ? raw : [raw]).filter((n): n is number => Number.isInteger(n));

export const textList = (raw: unknown, max: number, counters: Counters): string[] =>
  Array.isArray(raw) ? raw.map((v) => sanitizeQuizText(v, max, counters)) : [];

export const unique = (values: string[]) => new Set(values.map((v) => foldText(v))).size === values.length;
