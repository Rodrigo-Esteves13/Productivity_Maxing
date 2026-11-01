export type FlashcardGrade = 'AGAIN' | 'GOOD' | 'EASY';

export const FLASHCARD_GRADES: FlashcardGrade[] = ['AGAIN', 'GOOD', 'EASY'];

export const AGAIN_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EASE_MIN = 1.3;
const EASE_AGAIN_STEP = 0.2;
const EASE_EASY_STEP = 0.15;
const EASY_BONUS = 1.3;
const FIRST_INTERVAL_DAYS = 1;
const SECOND_INTERVAL_DAYS = 3;

export interface FlashcardState {
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
}

// SM-2 simplificado: AGAIN volta a 10 min, GOOD/EASY crescem 1d, 3d, depois x ease.
export function scheduleReview(
  card: FlashcardState,
  grade: FlashcardGrade,
  now: Date,
): FlashcardState & { dueAt: Date } {
  if (grade === 'AGAIN') {
    return {
      intervalDays: 0,
      ease: Math.max(EASE_MIN, card.ease - EASE_AGAIN_STEP),
      reps: 0,
      lapses: card.lapses + 1,
      dueAt: new Date(now.getTime() + AGAIN_DELAY_MS),
    };
  }
  const easy = grade === 'EASY';
  const ease = easy ? card.ease + EASE_EASY_STEP : card.ease;
  const base =
    card.reps === 0
      ? FIRST_INTERVAL_DAYS
      : card.reps === 1
        ? SECOND_INTERVAL_DAYS
        : Math.round(card.intervalDays * card.ease);
  const intervalDays = Math.max(
    FIRST_INTERVAL_DAYS,
    easy ? Math.round(base * EASY_BONUS) : base,
  );
  return {
    intervalDays,
    ease,
    reps: card.reps + 1,
    lapses: card.lapses,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}
