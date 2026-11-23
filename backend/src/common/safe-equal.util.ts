import { timingSafeEqual } from 'crypto';

/**
 * Compara duas strings em tempo constante. timingSafeEqual lanca excepcao
 * quando os buffers tem tamanhos diferentes: nesse caso compara `a` consigo
 * proprio (para manter o tempo de execucao parecido) e devolve false.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
