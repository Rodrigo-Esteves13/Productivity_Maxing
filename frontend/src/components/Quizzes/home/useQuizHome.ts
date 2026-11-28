import { useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizDetail } from '../../../api/quizzesService';
import { evolution } from '../../../lib/quizInsights';
import { CALC_SIZES } from '../../../lib/quizPlay';
import type { GeneratorKind } from '../../../lib/quizGenerators';
import { QUIZ_KINDS, type QuizKind, type QuizQuestion } from '../../../lib/quizFormat';
import {
  EXAM_SIZES,
  pickPractice,
  poolQuestions,
  PRACTICE_SIZES,
  QUESTION_POOLS,
  topicMastery,
  wrongQuestions,
  type QuestionPool,
  type QuizSession,
} from '../../../lib/quizSession';
import { countAnswered, filterBank, mixWithGenerated, toggleGeneratorKind, toggleItem } from '../../../lib/quizHome';

export type HomeTab = 'modes' | 'wrong' | 'stats' | 'bank' | 'history';

interface UseQuizHomeOptions {
  quiz: QuizDetail;
  session: QuizSession | null;
  generators: GeneratorKind[];
  onSaveGenerators: (next: GeneratorKind[]) => void;
}

// Escolhas do inicio de um quiz. Vive acima dos separadores para as
// escolhas sobreviverem a troca.
export function useQuizHome({ quiz, session, generators, onSaveGenerators }: UseQuizHomeOptions) {
  const { t } = useI18n();
  const [tab, setTab] = useState<HomeTab>('modes');
  const [examSize, setExamSize] = useState<number>(EXAM_SIZES[0]);
  const [topics, setTopics] = useState<string[]>([]);
  const [kinds, setKinds] = useState<QuizKind[]>([]);
  const [practiceSize, setPracticeSize] = useState<number>(PRACTICE_SIZES[0]);
  const [search, setSearch] = useState('');
  const [weakFirst, setWeakFirst] = useState(false);
  // De onde o exame e a pratica escolhem: todas, nunca vistas, erradas ou as duas.
  const [pool, setPool] = useState<QuestionPool>('all');
  const poolCounts = useMemo(
    () => Object.fromEntries(QUESTION_POOLS.map((p) => [p, poolQuestions(quiz, quiz.stats, p).length])) as Record<QuestionPool, number>,
    [quiz],
  );
  const poolQuiz = useMemo(() => ({ ...quiz, questions: poolQuestions(quiz, quiz.stats, pool) }), [quiz, pool]);
  const poolSize = poolQuiz.questions.length;
  const [mixGenerated, setMixGenerated] = useState(true);
  const [calcKinds, setCalcKinds] = useState<GeneratorKind[]>([]);
  const [calcSize, setCalcSize] = useState<number>(CALC_SIZES[0]);
  const hasGenerators = generators.length > 0;
  const withMix = (size: number, pick: (n: number) => QuizQuestion[]) =>
    mixWithGenerated(size, pick, mixGenerated ? generators : [], t);
  const points = useMemo(() => evolution(quiz.attempts), [quiz.attempts]);

  const presentKinds = useMemo(() => QUIZ_KINDS.filter((k) => quiz.questions.some((q) => q.kind === k)), [quiz.questions]);
  const wrong = useMemo(() => wrongQuestions(quiz, quiz.stats), [quiz]);
  const mastery = useMemo(() => topicMastery(quiz, quiz.stats), [quiz]);
  const practicePool = pickPractice(poolQuiz, topics, kinds, poolSize).length;
  const bank = useMemo(() => filterBank(quiz.questions, topics, search), [quiz.questions, search, topics]);
  const answeredInSession = useMemo(() => countAnswered(quiz.questions, session), [session, quiz.questions]);

  return {
    tab,
    setTab,
    pool,
    setPool,
    poolCounts,
    poolQuiz,
    poolSize,
    examSizes: EXAM_SIZES.filter((n) => n < poolSize),
    examCount: Math.min(examSize, poolSize),
    setExamSize,
    weakFirst,
    setWeakFirst,
    topics,
    toggleTopic: (topic: string) => setTopics((prev) => toggleItem(prev, topic)),
    kinds,
    toggleKind: (kind: QuizKind) => setKinds((prev) => toggleItem(prev, kind)),
    presentKinds,
    practiceSize,
    setPracticeSize,
    practicePool,
    hasGenerators,
    mixGenerated,
    setMixGenerated,
    withMix,
    calcChosen: calcKinds.filter((k) => generators.includes(k)),
    toggleCalcKind: (kind: GeneratorKind) => setCalcKinds((prev) => toggleItem(prev, kind)),
    calcSize,
    setCalcSize,
    toggleGenerator: (kind: GeneratorKind) => onSaveGenerators(toggleGeneratorKind(generators, kind)),
    search,
    setSearch,
    bank,
    wrong,
    mastery,
    points,
    answeredInSession,
  };
}

export type QuizHomeState = ReturnType<typeof useQuizHome>;
