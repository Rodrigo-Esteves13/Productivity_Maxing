import { describe, expect, it } from 'vitest';
import { countAnswered, filterBank, mixWithGenerated, toggleGeneratorKind, toggleItem } from './quizHome';
import { GENERATOR_KINDS } from './quizGenerators';
import type { QuizQuestion } from './quizFormat';

const question = (id: string, topic: string, prompt: string, options: string[] = []) =>
  ({ id, topic, prompt, options }) as unknown as QuizQuestion;

describe('toggleItem', () => {
  it('acrescenta e retira', () => {
    expect(toggleItem(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleItem(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('toggleGeneratorKind', () => {
  it('mantem a ordem do catalogo', () => {
    const [first, second] = GENERATOR_KINDS;
    expect(toggleGeneratorKind([second], first)).toEqual([first, second]);
    expect(toggleGeneratorKind([first, second], first)).toEqual([second]);
  });
});

describe('countAnswered', () => {
  it('e zero sem tentativa', () => {
    expect(countAnswered([], null)).toBe(0);
  });
});

describe('filterBank', () => {
  const bank = [question('1', 'A', 'Função linear'), question('2', 'B', 'Outra', ['Matriz'])];
  it('filtra por topico', () => {
    expect(filterBank(bank, ['B'], '').map((q) => q.id)).toEqual(['2']);
  });
  it('procura sem acentos no enunciado e nas opcoes', () => {
    expect(filterBank(bank, [], 'funcao').map((q) => q.id)).toEqual(['1']);
    expect(filterBank(bank, [], 'matriz').map((q) => q.id)).toEqual(['2']);
  });
});

describe('mixWithGenerated', () => {
  it('sem geradores pede o tamanho inteiro', () => {
    const asked: number[] = [];
    mixWithGenerated(8, (n) => (asked.push(n), []), [], (key) => key);
    expect(asked).toEqual([8]);
  });
  it('com geradores troca parte por perguntas geradas', () => {
    const asked: number[] = [];
    const result = mixWithGenerated(8, (n) => (asked.push(n), []), [GENERATOR_KINDS[0]], (key) => key);
    expect(asked[0]).toBeLessThan(8);
    expect(result).toHaveLength(8 - asked[0]);
  });
});
