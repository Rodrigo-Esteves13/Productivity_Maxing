import { describe, expect, it } from 'vitest';
import { judgeAttempt } from './quizAttempt';
import type { Quiz } from './quizFormat';
import type { QuizSession } from './quizSession';

describe('judgeAttempt', () => {
  it('devolve null quando a sessao guardada esta estragada', () => {
    const broken = { items: null } as unknown as QuizSession;
    expect(judgeAttempt({ questions: [] } as unknown as Quiz, broken, 0)).toBeNull();
  });
});
