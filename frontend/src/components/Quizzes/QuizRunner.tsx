import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import { FlagIcon } from '../UI/Icons';
import QuestionView from './QuestionView';
import { useI18n } from '../../i18n/useI18n';
import { useNow } from '../../hooks/useNow';
import { useVisibleInterval } from '../../hooks/useVisibleInterval';
import { formatElapsed } from '../../lib/formatDuration';
import type { QuizQuestion, QuizResponse } from '../../lib/quizFormat';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import {
  gradeQuestion,
  heartbeatSession,
  isAnswered,
  MS_PER_SECOND,
  QUIZ_HEARTBEAT_MS,
  resumeSession,
  touchSession,
  type QuizSession,
  type SessionItem,
} from '../../lib/quizSession';

const TICK_MS = 500;
const CHOICE_KINDS = new Set(['single', 'multi', 'truefalse']);
const MAX_OPTION_KEY = 8;
// Ultimo minuto do exame: o relogio fica vermelho.
const LOW_TIME_MS = 60 * MS_PER_SECOND;

interface QuizRunnerProps {
  questions: Map<string, QuizQuestion>;
  session: QuizSession;
  onChange: (session: QuizSession) => void;
  onFinish: () => void;
}

function dotClass(q: QuizQuestion, item: SessionItem, isCurrent: boolean, instant: boolean): string {
  const state =
    instant && item.checked
      ? gradeQuestion(q, item.response)
        ? 'border-violet-400 bg-violet-900/50 text-white'
        : 'border-red-500 bg-red-950/50 text-white'
      : isAnswered(q, item.response)
        ? 'border-neutral-500 bg-neutral-800 text-neutral-100'
        : 'border-neutral-800 text-neutral-500';
  const flag = item.flagged ? ' ring-2 ring-purple-400' : '';
  const current = isCurrent ? ' outline outline-2 outline-offset-1 outline-violet-400' : '';
  return `${state}${flag}${current}`;
}

// Exame (tempo total, feedback no fim) ou pratica/erradas (feedback logo).
export default function QuizRunner({ questions, session, onChange, onFinish }: QuizRunnerProps) {
  const { t } = useI18n();
  const now = useNow(TICK_MS).getTime();
  const instant = session.mode !== 'exam';
  const item = session.items[session.index];
  const question = questions.get(item.id);
  const total = session.items.length;
  const isLast = session.index === total - 1;
  const remainingMs = session.deadline ? Math.max(0, session.deadline - now) : null;
  const answeredCount = useMemo(
    () => session.items.filter((it) => { const q = questions.get(it.id); return q ? isAnswered(q, it.response) : false; }).length,
    [session.items, questions],
  );

  // Tentativa retomada (refresh ou site fechado): o tempo fechado nao gasta exame.
  const mountSession = useRef(session);
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    const next = resumeSession(mountSession.current);
    if (next !== mountSession.current) onChange(next);
    setResumed(true);
  }, [onChange]);

  // Sinal de vida: um salto grande no proximo arranque quer dizer pagina fechada.
  useVisibleInterval(() => onChange(heartbeatSession(session)), QUIZ_HEARTBEAT_MS, { enabled: resumed });

  // Toda a interacao passa por touchSession (tempo ativo, sem pausas longas).
  const touch = useCallback((next: QuizSession) => onChange(touchSession(next)), [onChange]);
  const patchItem = useCallback(
    (patch: Partial<SessionItem>) =>
      touch({ ...session, items: session.items.map((it, i) => (i === session.index ? { ...it, ...patch } : it)) }),
    [touch, session],
  );
  const go = useCallback((index: number) => touch({ ...session, index }), [touch, session]);
  const setResponse = (response: QuizResponse) => patchItem({ response, touched: true });

  const canCheck = instant && !item.checked && question !== undefined && isAnswered(question, item.response);
  const primary = useCallback(() => {
    if (canCheck) return patchItem({ checked: true });
    if (isLast) return onFinish();
    go(session.index + 1);
  }, [canCheck, patchItem, isLast, onFinish, go, session.index]);

  useEffect(() => {
    if (resumed && remainingMs === 0) onFinish();
  }, [resumed, remainingMs, onFinish]);

  // Teclado como no quiz de exemplo: 1-8 escolhe a opcao, Enter avanca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        primary();
        return;
      }
      const n = Number(e.key);
      if (!question || !CHOICE_KINDS.has(question.kind) || !Number.isInteger(n) || n < 1 || n > Math.min(MAX_OPTION_KEY, item.perm.length)) return;
      if (instant && item.checked) return;
      const original = item.perm[n - 1];
      const selected =
        question.kind === 'multi'
          ? item.response.selected.includes(original)
            ? item.response.selected.filter((s) => s !== original)
            : [...item.response.selected, original]
          : [original];
      patchItem({ response: { ...item.response, selected }, touched: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary, question, item, instant, patchItem]);

  if (!question) return null;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-400">
        <span className="tabular-nums">
          {t('quizzes.run.progress', { current: session.index + 1, total })} · {t('quizzes.run.answered', { count: answeredCount })}
        </span>
        <div className="flex items-center gap-3">
          {remainingMs !== null && (
            <span className={`tabular-nums font-semibold ${remainingMs < LOW_TIME_MS ? 'text-red-400' : 'text-neutral-200'}`} role="timer">
              {formatElapsed(Math.ceil(remainingMs / MS_PER_SECOND))}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={onFinish}>
            {t('quizzes.run.finish')}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="navigation" aria-label={t('quizzes.run.dots')}>
        {session.items.map((it, i) => {
          const q = questions.get(it.id);
          return q ? (
            <button
              key={it.id}
              type="button"
              onClick={() => go(i)}
              aria-current={i === session.index ? 'step' : undefined}
              title={stripQuizMarkdown(q.topic)}
              className={`press h-7 min-w-7 rounded-md border px-1 text-xs tabular-nums ${dotClass(q, it, i === session.index, instant)}`}
            >
              {i + 1}
            </button>
          ) : null;
        })}
      </div>

      <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {stripQuizMarkdown(question.topic)} · {t(`quizzes.kind.${question.kind}`)}
      </p>
      <QuestionView question={question} item={item} onChange={setResponse} reveal={instant && item.checked} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={session.index === 0} onClick={() => go(session.index - 1)}>
            {t('quizzes.run.prev')}
          </Button>
          <Button variant="secondary" size="sm" aria-pressed={item.flagged} onClick={() => patchItem({ flagged: !item.flagged })}>
            <span className="inline-flex items-center gap-1.5">
              <FlagIcon className={`h-4 w-4 ${item.flagged ? 'text-purple-400' : ''}`} aria-hidden="true" />
              {item.flagged ? t('quizzes.run.unflag') : t('quizzes.run.flag')}
            </span>
          </Button>
        </div>
        <Button size="sm" onClick={primary}>
          {canCheck ? t('quizzes.run.check') : isLast ? t('quizzes.run.finish') : t('quizzes.run.next')}
        </Button>
      </div>
      <p className="mt-3 text-xs text-neutral-500">{t('quizzes.run.keys')}</p>
    </Card>
  );
}
