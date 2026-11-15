import { useContext, useRef, useState, type PointerEvent } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import IconButton from '../UI/IconButton';
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from '../UI/Icons';
import QuizRichText from './QuizRichText';
import QuizDiagram from './QuizDiagram';
import { useI18n } from '../../i18n/useI18n';
import type { QuizQuestion, QuizResponse } from '../../lib/quizFormat';
import { correctAnswerText, dropIndex, gradeQuestion, moveOrder, NO_MATCH, type SessionItem } from '../../lib/quizSession';
import { QuizFiguresContext } from '../../lib/quizFigures';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';

const LETTER_A = 65;

interface QuestionViewProps {
  question: QuizQuestion;
  item: SessionItem;
  // Sem onChange a pergunta fica so de leitura.
  onChange?: (response: QuizResponse) => void;
  reveal: boolean;
  // Banco de perguntas: mostra a chave sem dizer certo/errado.
  showVerdict?: boolean;
  // Banco de perguntas: o enunciado ja esta visivel por cima.
  hidePrompt?: boolean;
}

function optionClass(isSelected: boolean, isKey: boolean, reveal: boolean): string {
  if (reveal && isKey) return 'border-violet-400 bg-violet-950/40 text-white';
  if (reveal && isSelected) return 'border-red-500 bg-red-950/30 text-white';
  if (isSelected) return 'border-violet-500 bg-violet-950/30 text-white';
  return 'border-neutral-700 text-neutral-200 hover:border-neutral-500';
}

// Enunciado, figura e bloco de codigo (tambem usado sozinho no banco de perguntas).
export function QuestionPrompt({ question: q }: { question: QuizQuestion }) {
  const { t } = useI18n();
  const figures = useContext(QuizFiguresContext);
  // Object.hasOwn: um id como "toString" nao pode apanhar uma funcao herdada.
  const figure = q.figure && Object.hasOwn(figures, q.figure) ? figures[q.figure] : undefined;
  return (
    <>
      <QuizRichText text={q.prompt} className="text-base text-neutral-100" />
      {/* Dados validados no carregamento: a app desenha o diagrama, nunca markup da IA. */}
      {figure && <QuizDiagram diagram={figure} title={t('quizzes.run.figure')} />}
      {q.code && <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-200">{q.code}</pre>}
    </>
  );
}

const HALF = 2;
// No toque so a pega arrasta, para o resto da linha continuar a fazer scroll.
const MOUSE_POINTER = 'mouse';

export default function QuestionView({ question: q, item, onChange, reveal, showVerdict = true, hidePrompt = false }: QuestionViewProps) {
  const { t } = useI18n();
  const r = item.response;
  const readOnly = !onChange || reveal;
  const set = (patch: Partial<QuizResponse>) => onChange?.({ ...r, ...patch });
  const isChoice = q.kind === 'single' || q.kind === 'multi' || q.kind === 'truefalse';
  const orderList = useRef<HTMLOListElement>(null);
  // Item (indice original) a ser arrastado na pergunta de ordenar.
  const [dragged, setDragged] = useState<number | null>(null);

  const startDrag = (e: PointerEvent<HTMLLIElement>, original: number) => {
    if (readOnly || e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('button')) return;
    if (e.pointerType !== MOUSE_POINTER && !target.closest('[data-drag-handle]')) return;
    e.preventDefault();
    setDragged(original);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ponteiro ja libertado: o arrasto segue pelos eventos da propria lista.
    }
  };

  const dragOver = (e: PointerEvent<HTMLLIElement>) => {
    if (dragged === null || !orderList.current) return;
    const from = r.order.indexOf(dragged);
    const mids = Array.from(orderList.current.children)
      .filter((_, pos) => pos !== from)
      .map((row) => {
        const box = row.getBoundingClientRect();
        return box.top + box.height / HALF;
      });
    const to = dropIndex(mids, e.clientY);
    if (to !== from) set({ order: moveOrder(r.order, from, to) });
  };

  const endDrag = () => setDragged(null);

  const choose = (original: number) => {
    if (readOnly) return;
    if (q.kind !== 'multi') return set({ selected: [original] });
    set({ selected: r.selected.includes(original) ? r.selected.filter((s) => s !== original) : [...r.selected, original] });
  };

  return (
    <div className="space-y-3">
      {!hidePrompt && <QuestionPrompt question={q} />}
      {q.kind === 'multi' && <p className="text-xs text-violet-300">{t('quizzes.run.pick', { count: q.answer.length })}</p>}

      {isChoice && (
        <div className="grid gap-2">
          {item.perm.map((original, shown) => (
            <button
              key={original}
              type="button"
              aria-pressed={r.selected.includes(original)}
              disabled={readOnly && !reveal}
              onClick={() => choose(original)}
              className={`press flex min-h-10 items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm ${optionClass(r.selected.includes(original), q.answer.includes(original), reveal)}`}
            >
              <span className="font-mono text-xs text-neutral-500">{String.fromCharCode(LETTER_A + shown)}</span>
              <QuizRichText text={q.options[original]} />
            </button>
          ))}
        </div>
      )}

      {q.kind === 'typed' && (
        <Input
          aria-label={t('quizzes.run.yourAnswer')}
          placeholder={t('quizzes.run.yourAnswer')}
          value={r.text}
          readOnly={readOnly}
          onChange={(e) => set({ text: e.target.value })}
          className={reveal ? (gradeQuestion(q, r) ? 'border-violet-400' : 'border-red-500') : ''}
        />
      )}

      {q.kind === 'order' && (
        <ol ref={orderList} className="space-y-2">
          {r.order.map((original, pos) => (
            <li
              key={original}
              onPointerDown={(e) => startDrag(e, original)}
              onPointerMove={dragOver}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${reveal ? (original === pos ? 'border-violet-400' : 'border-red-500') : 'border-neutral-700'} ${readOnly ? '' : 'cursor-grab select-none hover:border-neutral-500'} ${dragged === original ? 'cursor-grabbing border-violet-500 bg-violet-950/30' : ''}`}
            >
              {!readOnly && (
                <span data-drag-handle title={t('ui.dragToReorder')} className="touch-none text-neutral-500">
                  <GripVerticalIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
              <span className="w-5 font-mono text-xs text-neutral-500">{pos + 1}</span>
              <QuizRichText text={q.items[original]} className="flex-1" />
              {!readOnly && (
                <>
                  <IconButton label={t('quizzes.run.moveUp')} disabled={pos === 0} onClick={() => set({ order: moveOrder(r.order, pos, pos - 1) })}>
                    <ArrowUpIcon className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={t('quizzes.run.moveDown')} disabled={pos === r.order.length - 1} onClick={() => set({ order: moveOrder(r.order, pos, pos + 1) })}>
                    <ArrowDownIcon className="h-4 w-4" />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {q.kind === 'match' && (
        <div className="space-y-2">
          {q.left.map((left, i) => (
            <div key={left} className="grid items-center gap-2 sm:grid-cols-2">
              <QuizRichText text={left} className="text-sm text-neutral-200" />
              <Select
                aria-label={left}
                value={r.match[i] ?? NO_MATCH}
                disabled={readOnly}
                onChange={(e) => set({ match: r.match.map((m, j) => (j === i ? Number(e.target.value) : m)) })}
                className={reveal ? (r.match[i] === q.pairs[i] ? 'border-violet-400' : 'border-red-500') : ''}
              >
                <option value={NO_MATCH}>{t('quizzes.run.choose')}</option>
                {item.perm.map((original) => (
                  <option key={original} value={original}>
                    {q.right[original]}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}

      {reveal && (
        <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-sm">
          {showVerdict && (
            <p className={gradeQuestion(q, r) ? 'font-medium text-violet-300' : 'font-medium text-red-400'}>
              {gradeQuestion(q, r) ? t('quizzes.run.right') : t('quizzes.run.wrong')}
            </p>
          )}
          {!isChoice && (
            <div>
              <p className="text-xs text-neutral-500">{t('quizzes.run.correctAnswer')}</p>
              <QuizRichText text={correctAnswerText(q)} className="text-neutral-200" />
            </div>
          )}
          {q.explanation && <QuizRichText text={q.explanation} className="text-neutral-300" />}
          {q.sources.length > 0 && (
            <ul className="space-y-1 text-xs">
              {q.sources.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-violet-300 underline-offset-2 hover:underline">
                      {stripQuizMarkdown(s.title)} ({new URL(s.url).hostname})
                    </a>
                  ) : (
                    <span className="text-neutral-400">{stripQuizMarkdown(s.title)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
