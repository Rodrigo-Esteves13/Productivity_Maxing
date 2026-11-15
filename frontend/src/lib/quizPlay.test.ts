import { describe, expect, it } from 'vitest';
import { QUIZ_FORMAT_ID, type Quiz } from './quizFormat';
import { generatedId, generatorStatKey, statKeyOf } from './quizGenerators';
import { enabledKinds, generatedShare, makeGenerated, withGenerated } from './quizPlay';
import { generatorInsights, quizOverview } from './quizInsights';
import { scoreSession, sessionFitsQuiz, startSession } from './quizSession';

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key);

const quiz = { format: QUIZ_FORMAT_ID, title: 'T', language: 'en', secondsPerQuestion: 60, topics: [], figures: {}, questions: [] } as unknown as Quiz;

describe('quizPlay', () => {
  it('enabledKinds keeps known kinds once', () => {
    expect(enabledKinds(['wildcard', 'nope', 'wildcard', 'spfPath', 7])).toEqual(['wildcard', 'spfPath']);
    expect(enabledKinds(undefined)).toEqual([]);
  });

  it('withGenerated rebuilds questions and figures from ids, only for enabled kinds', () => {
    const ids = [generatedId('spfPath', 42), generatedId('wildcard', 7), generatedId('ospfCost', 9), 'gen-fake-1'];
    const play = withGenerated(quiz, ids, ['spfPath', 'wildcard'], t);
    expect(play.questions.map((q) => q.id)).toEqual([generatedId('spfPath', 42), generatedId('wildcard', 7)]);
    expect(Object.keys(play.figures)).toEqual([generatedId('spfPath', 42)]);
    expect(withGenerated(quiz, ids, ['spfPath', 'wildcard'], t)).toEqual(play);
  });

  it('a session of generated questions fits the play quiz and scores', () => {
    const picked = makeGenerated(['wildcard', 'binaryDecimal'], 6, t, () => 0.3);
    expect(picked).toHaveLength(6);
    const session = startSession('practice', picked, 60);
    const play = withGenerated(quiz, session.items.map((it) => it.id), ['wildcard', 'binaryDecimal'], t);
    expect(sessionFitsQuiz(session, play)).toBe(true);
    expect(scoreSession(play, session).total).toBe(6);
    expect(statKeyOf(picked[0].id)).toMatch(/^gen-(wildcard|binaryDecimal)$/);
  });

  it('generatedShare is about a quarter', () => {
    expect(generatedShare(40)).toBe(10);
    expect(makeGenerated([], 5, t)).toEqual([]);
  });

  it('generator stats count in overview and insights', () => {
    const stats = { [generatorStatKey('wildcard')]: { seen: 4, correct: 1, last: false, timeMs: 8000, timed: 4 } };
    const o = quizOverview(quiz, stats, [], 0, ['wildcard']);
    expect(o.answers).toBe(4);
    expect(o.accuracy).toBe(25);
    const [w, s] = generatorInsights(stats, ['wildcard', 'subnetInfo'], (k) => k);
    expect(w).toMatchObject({ generator: 'wildcard', accuracy: 25, wrongNow: 1, avgMs: 2000 });
    expect(s).toMatchObject({ generator: 'subnetInfo', answers: 0, accuracy: null });
  });
});
