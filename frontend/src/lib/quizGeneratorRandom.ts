// Aleatorio deterministico dos geradores.

import type { Rand } from './quizGeneratorIds';

// ---------------------------------------------------------------------------
// Aleatorio com seed (mulberry32, igual ao `rng` do quiz de exemplo).
// Constantes do proprio algoritmo.
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFT_A = 15;
const MULBERRY_SHIFT_B = 7;
const MULBERRY_SHIFT_C = 14;
const MULBERRY_ODD = 61;
export const UINT32_RANGE = 2 ** 32;

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + MULBERRY_INCREMENT) | 0;
    let x = Math.imul(a ^ (a >>> MULBERRY_SHIFT_A), 1 | a);
    x = (x + Math.imul(x ^ (x >>> MULBERRY_SHIFT_B), MULBERRY_ODD | x)) ^ x;
    return ((x ^ (x >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_RANGE;
  };
}

export const HALF = 0.5;
export const randInt = (r: Rand, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
export const pickOne = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)];

export function shuffleWith<T>(r: Rand, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
