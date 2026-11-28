import { useEffect, useRef, useState } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import type { FlashcardSchedule } from '../../api/flashcardsService';
import { SHORTCUTS_OFF_PROPS } from '../../lib/shortcutGuards';
import { useI18n } from '../../i18n/useI18n';
import type { Flashcard, FlashcardGrade } from '../../types/models';

interface GradeOption {
  grade: FlashcardGrade;
  key: string;
  label: string;
  variant: 'primary' | 'secondary';
}

// Desfazer a ultima classificacao: Backspace ou Z.
const UNDO_KEYS = ['Backspace', 'z', 'Z'];

const GRADES: GradeOption[] = [
  { grade: 'AGAIN', key: '1', label: 'flashcards.again', variant: 'secondary' },
  { grade: 'GOOD', key: '2', label: 'flashcards.good', variant: 'primary' },
  { grade: 'EASY', key: '3', label: 'flashcards.easy', variant: 'secondary' },
];

interface ReviewSessionProps {
  // Fila fixada ao iniciar: nao muda enquanto se estuda.
  queue: Flashcard[];
  onGrade: (id: string, grade: FlashcardGrade) => Promise<boolean>;
  // Repoe a agenda que o cartao tinha antes de ser classificado.
  onUndo: (id: string, schedule: FlashcardSchedule) => Promise<boolean>;
  onExit: () => void;
}

export default function ReviewSession({ queue, onGrade, onUndo, onExit }: ReviewSessionProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const busy = useRef(false);
  const current = queue[index];

  const grade = async (g: FlashcardGrade) => {
    if (!current || !revealed || busy.current) return;
    busy.current = true;
    const ok = await onGrade(current.id, g);
    busy.current = false;
    if (!ok) return;
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  // O cartao anterior da fila ainda guarda a agenda de antes de ser classificado.
  const previous = index > 0 ? queue[index - 1] : undefined;

  const undo = async () => {
    if (!previous || busy.current) return;
    busy.current = true;
    const ok = await onUndo(previous.id, {
      dueAt: previous.dueAt,
      intervalDays: previous.intervalDays,
      ease: previous.ease,
      reps: previous.reps,
      lapses: previous.lapses,
    });
    busy.current = false;
    if (!ok) return;
    // Volta ao cartao com a resposta a vista, pronto a classificar de novo.
    setIndex((i) => i - 1);
    setRevealed(true);
  };

  // Atalhos: Espaco mostra a resposta, 1/2/3 classificam, Backspace/Z desfaz.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  onKey.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (UNDO_KEYS.includes(e.key)) {
      e.preventDefault();
      void undo();
      return;
    }
    if (!current) return;
    if (e.key === ' ') {
      e.preventDefault();
      setRevealed(true);
      return;
    }
    const option = GRADES.find((g) => g.key === e.key);
    if (option) void grade(option.grade);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!current) {
    return (
      <Card className="text-center">
        <p className="text-lg font-semibold text-white">{t('flashcards.allDone')}</p>
        <p className="mt-1 text-sm text-neutral-400">{t('flashcards.reviewed', { count: queue.length })}</p>
        <Button className="mt-4" size="sm" onClick={onExit}>
          {t('flashcards.backToDecks')}
        </Button>
        {previous && (
          <Button className="ml-2 mt-4" size="sm" variant="secondary" onClick={() => void undo()}>
            {t('ux4study.undoGrade')} <kbd className="ml-1 text-xs text-neutral-400">Z</kbd>
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div {...SHORTCUTS_OFF_PROPS}>
      <Card>
        <div className="mb-4 flex items-center justify-between text-sm text-neutral-400">
          <span className="tabular-nums">{t('flashcards.progress', { current: index + 1, total: queue.length })}</span>
          <div className="flex gap-2">
            {previous && (
              <Button variant="secondary" size="sm" title={t('ux4study.undoGradeHelp')} onClick={() => void undo()}>
                {t('ux4study.undoGrade')} <kbd className="ml-1 text-xs text-neutral-400">Z</kbd>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onExit}>
              {t('flashcards.endSession')}
            </Button>
          </div>
        </div>
        <p className="min-h-[4rem] whitespace-pre-wrap break-words text-xl font-semibold text-white">{current.front}</p>
        {revealed ? (
          <>
            <p className="mt-4 whitespace-pre-wrap break-words border-t border-neutral-800 pt-4 text-neutral-200">
              {current.back}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {GRADES.map((g) => (
                <Button key={g.grade} variant={g.variant} className="min-h-10" onClick={() => void grade(g.grade)}>
                  {t(g.label)} <kbd className="ml-1 text-xs text-neutral-400">{g.key}</kbd>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <Button className="mt-6 min-h-10 w-full" onClick={() => setRevealed(true)}>
            {t('flashcards.showAnswer')} <kbd className="ml-1 text-xs text-violet-200">{t('flashcards.spaceKey')}</kbd>
          </Button>
        )}
      </Card>
    </div>
  );
}
