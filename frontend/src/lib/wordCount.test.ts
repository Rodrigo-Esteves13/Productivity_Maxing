import { describe, expect, it } from 'vitest';
import { countWords } from './wordCount';

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
    expect(countWords('Olá  mundo\nsegunda\tlinha')).toBe(4);
  });

  it('ignores punctuation on its own and keeps joined words whole', () => {
    expect(countWords('Aula 3 - redes: TCP/IP, guarda-chuva e 3,14 — fim.')).toBe(8);
    expect(countWords('* - • ...')).toBe(0);
  });

  it('counts each Chinese or Japanese character as a word', () => {
    expect(countWords('我们学习网络')).toBe(6);
    expect(countWords('コーヒーを飲む')).toBe(7);
    expect(countWords('TCP 协议')).toBe(3);
  });

  it('counts Korean by spaces, like other languages', () => {
    expect(countWords('네트워크 수업 노트')).toBe(3);
  });
});
