// Logica pura do quiz: correcao por tipo, montar sessoes (exame,
// pratica, erradas), baralhar opcoes por tentativa e estatisticas.
// Implementacao nos ficheiros reexportados abaixo.
export type {
  QuizMode,
  SessionItem,
  QuizSession,
  QuestionStat,
  QuizStats,
  QuizAttemptSummary,
} from './quizSessionTypes';
export { QUIZ_MODES, EXAM_SIZES, PRACTICE_SIZES, NO_MATCH, MS_PER_SECOND, statOf } from './quizSessionTypes';
export { shuffle, normalizeTyped, gradeQuestion, isAnswered } from './quizGrading';
export { makeItem, startSession } from './quizSessionStart';
export type { AttemptOutcome, AttemptClassification } from './quizSessionTiming';
export {
  QUIZ_IDLE_GAP_MS,
  QUIZ_HEARTBEAT_MS,
  QUIZ_HEARTBEAT_GRACE_MS,
  QUIZ_MIN_ATTEMPT_MS,
  QUIZ_MIN_ANSWERED,
  touchSession,
  heartbeatSession,
  resumeSession,
  wasAnswered,
  classifyAttempt,
  answeredOnly,
} from './quizSessionTiming';
export {
  QUIZ_CARDS_SENT_MAX_IDS,
  QUIZ_CARDS_SENT_MAX_QUIZZES,
  mergeSentIds,
  correctAnswerText,
  answerKeyItem,
  quizQuestionsToCards,
} from './quizCards';
export type { ExamPickOptions, QuestionPool } from './quizPicking';
export {
  EXAM_WEIGHT,
  pickExam,
  pickPractice,
  timesWrong,
  wrongQuestions,
  QUESTION_POOLS,
  poolQuestions,
} from './quizPicking';
export type { SessionScore, TopicScore, TopicMastery } from './quizScoring';
export { scoreSession, scoreByTopic, applyScore, topicMastery } from './quizScoring';
export {
  SESSION_MAX_ITEMS,
  SESSION_MAX_INDEX_LIST,
  SESSION_MAX_TEXT,
  parseStoredSession,
  sessionFitsQuiz,
  moveOrder,
  dropIndex,
  parseStoredResponse,
  responseFitsQuestion,
} from './quizSessionStorage';
