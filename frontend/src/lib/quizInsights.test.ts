import { describe, expect, it } from 'vitest';
import { EMPTY_RESPONSE, QUIZ_FORMAT_ID, type Quiz, type QuizQuestion } from './quizFormat';
import { makeItem, pickExam, scoreSession, startSession, touchSession, wrongQuestions, QUIZ_IDLE_GAP_MS, type QuizStats } from './quizSession';
import {
  attemptTiming,
  evolution,
  mostMissedQuestions,
  quizOverview,
  reviewVerdict,
  scoreBand,
  scoreByKind,
  scoreByTopicWorstFirst,
  slowestQuestions,
  topicInsights,
  weakestTopics,
} from './quizInsights';

const q = (id: string, topic: string, answer = 0): QuizQuestion => ({
  id,
  topic,
  kind: 'single',
  prompt: `Prompt ${id}`,
  code: null,
  figure: null,
  options: ['a', 'b', 'c'],
  answer: [answer],
  accepted: [],
  items: [],
  left: [],
  right: [],
  pairs: [],
  explanation: '',
  sources: [],
});

const quiz: Quiz = {
  format: QUIZ_FORMAT_ID,
  title: 'T',
  language: 'en',
  secondsPerQuestion: 60,
  topics: ['A', 'B'],
  figures: {},
  questions: [q('a1', 'A'), q('a2', 'A'), q('b1', 'B'), q('b2', 'B')],
} as unknown as Quiz;

const fixed = () => 0.5;

describe('time per question', () => {
  it('touchSession gives the gap to the open question, capped', () => {
    const s = startSession('practice', quiz.questions, 60, 0, fixed);
    const t1 = touchSession(s, 5000);
    expect(t1.items[0].timeMs).toBe(5000);
    const t2 = touchSession({ ...t1, index: 1 }, 5000 + QUIZ_IDLE_GAP_MS * 3);
    expect(t2.items[1].timeMs).toBe(QUIZ_IDLE_GAP_MS);
    expect(t2.items[0].timeMs).toBe(5000);
  });

  it('attemptTiming finds the slowest question and the average', () => {
    const s = startSession('exam', quiz.questions.slice(0, 2), 60, 0, fixed);
    s.items[0].timeMs = 1000;
    s.items[1].timeMs = 9000;
    const timing = attemptTiming(scoreSession(quiz, s), 10000);
    expect(timing.slowest).toEqual({ index: 1, ms: 9000 });
    expect(timing.avgMs).toBe(5000);
  });
});

describe('attempt breakdown', () => {
  it('sorts topics worst first and groups kinds', () => {
    const s = startSession('exam', quiz.questions, 60, 0, fixed);
    s.items[0].response = { ...EMPTY_RESPONSE, selected: [0] };
    s.items[1].response = { ...EMPTY_RESPONSE, selected: [0] };
    const score = scoreSession(quiz, s);
    expect(scoreByTopicWorstFirst(score).map((g) => g.key)).toEqual(['B', 'A']);
    expect(scoreByKind(score)).toEqual([{ key: 'single', correct: 2, total: 4 }]);
  });

  it('reviewVerdict tells wrong from blank', () => {
    const item = makeItem(quiz.questions[0], fixed);
    expect(reviewVerdict(quiz.questions[0], item.response, false)).toBe('blank');
    expect(reviewVerdict(quiz.questions[0], { ...item.response, selected: [1] }, false)).toBe('wrong');
    expect(reviewVerdict(quiz.questions[0], item.response, true)).toBe('right');
  });

  it('scoreBand uses the reference score', () => {
    expect(scoreBand(75)).toBe('good');
    expect(scoreBand(50)).toBe('mid');
    expect(scoreBand(49)).toBe('bad');
  });
});

const stats: QuizStats = {
  a1: { seen: 4, correct: 1, last: false, timeMs: 40000, timed: 4, wrongAt: 200 },
  a2: { seen: 2, correct: 2, last: true, timeMs: 4000, timed: 2 },
  b1: { seen: 2, correct: 1, last: false, timeMs: 60000, timed: 2, wrongAt: 300, dismissed: true },
};

describe('quiz stats', () => {
  it('overview counts seen, accuracy, exams and time', () => {
    const attempts = [
      { mode: 'EXAM', total: 4, correct: 3, durationMs: 1, finishedAt: '2026-11-02T00:00:00Z' },
      { mode: 'PRACTICE', total: 2, correct: 2, durationMs: 1, finishedAt: '2026-11-01T00:00:00Z' },
      { mode: 'EXAM', total: 4, correct: 1, durationMs: 1, finishedAt: '2026-10-01T00:00:00Z' },
    ];
    const o = quizOverview(quiz, stats, attempts, 1);
    expect(o.seen).toBe(3);
    expect(o.answers).toBe(8);
    expect(o.accuracy).toBe(50);
    expect(o.bestExam).toBe(75);
    expect(o.recentExamAvg).toBe(50);
    expect(o.avgMsPerQuestion).toBe(13000);
  });

  it('ranks the weakest topic first and needs enough answers', () => {
    const insights = topicInsights(quiz, stats);
    const b = insights.find((t) => t.topic === 'B');
    expect(b).toMatchObject({ seen: 1, wrongNow: 1, avgMs: 30000, accuracy: 50 });
    expect(weakestTopics(insights).map((t) => t.topic)).toEqual(['B', 'A']);
    expect(weakestTopics(topicInsights(quiz, { a1: { seen: 1, correct: 0, last: false } }))).toEqual([]);
  });

  it('lists slowest and most missed questions', () => {
    expect(slowestQuestions(quiz, stats).map((x) => x.question.id)).toEqual(['b1', 'a1', 'a2']);
    expect(mostMissedQuestions(quiz, stats).map((x) => x.question.id)).toEqual(['a1', 'b1']);
  });

  it('wrong list skips dismissed and sorts by times wrong', () => {
    const more: QuizStats = { ...stats, b2: { seen: 1, correct: 0, last: false, wrongAt: 900 } };
    expect(wrongQuestions(quiz, more).map((x) => x.id)).toEqual(['a1', 'b2']);
  });

  it('evolution is oldest first', () => {
    const points = evolution([
      { mode: 'EXAM', total: 2, correct: 2, durationMs: 1, finishedAt: '2026-11-02T00:00:00Z' },
      { mode: 'PRACTICE', total: 2, correct: 1, durationMs: 1, finishedAt: '2026-11-01T00:00:00Z' },
    ]);
    expect(points.map((p) => [p.percent, p.exam])).toEqual([
      [50, false],
      [100, true],
    ]);
  });
});

describe('pickExam', () => {
  it('balances topics and fills the size', () => {
    const picked = pickExam(quiz, 2, Math.random);
    expect(new Set(picked.map((x) => x.topic))).toEqual(new Set(['A', 'B']));
    expect(pickExam(quiz, 99).length).toBe(4);
  });

  it('weak mode prefers wrong and unseen, avoid pushes last exam back', () => {
    const picked = pickExam(quiz, 2, fixed, { weak: true, stats, avoid: [] }).map((x) => x.id);
    expect(picked.sort()).toEqual(['a1', 'b1']);
    const avoided = pickExam(quiz, 2, fixed, { avoid: ['a1', 'b1'] }).map((x) => x.id);
    expect(avoided.sort()).toEqual(['a2', 'b2']);
  });
});
