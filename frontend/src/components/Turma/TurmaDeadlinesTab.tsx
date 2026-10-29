import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Select from '../UI/Select';
import ToggleChip from '../UI/ToggleChip';
import IconButton from '../UI/IconButton';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import ConfirmActionDialog from './ConfirmActionDialog';
import {
  adoptTurmaDeadline,
  createTurmaDeadline,
  getTurmaDeadlines,
  removeTurmaDeadline,
  updateTurmaDeadline,
  type TurmaDeadline,
  type TurmaDeadlineKind,
} from '../../api/turmasService';
import { getUserAreas } from '../../api/userService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useFeedback } from '../../context/useFeedback';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { formatDateTime } from '../../lib/timeFormat';

interface TurmaDeadlinesTabProps {
  turmaId: string;
  isDelegado: boolean;
}

const KINDS: TurmaDeadlineKind[] = ['FREQUENCIA', 'TRABALHO_PRATICO'];
const KIND_LABEL_KEY: Record<TurmaDeadlineKind, string> = {
  FREQUENCIA: 'turma.deadlines.kind.test',
  TRABALHO_PRATICO: 'turma.deadlines.kind.assignment',
};

interface FormState {
  subject: string;
  title: string;
  kind: TurmaDeadlineKind;
  dueAt: string;
  weight: string;
}

const EMPTY_FORM: FormState = { subject: '', title: '', kind: 'FREQUENCIA', dueAt: '', weight: '' };

// <input type="datetime-local"> quer "YYYY-MM-DDTHH:mm" na hora local.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const normalize = (value: string) => value.trim().toLowerCase();

// Prazos da turma: alguem regista a frequencia/trabalho uma vez e cada um
// junta-o as suas tasks com um clique. Se a data mudar aqui, muda nas
// tasks de toda a gente que o juntou (e o lembrete da vespera segue-a).
export default function TurmaDeadlinesTab({ turmaId, isDelegado }: TurmaDeadlinesTabProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { notify } = useFeedback();
  const fetcher = useCallback(() => getTurmaDeadlines(turmaId), [turmaId]);
  const { data, isLoading, error, reload } = useLoadOnce(fetcher);
  const areasFetcher = useCallback(() => getUserAreas(), []);
  const { data: areas } = useLoadOnce(areasFetcher);
  const confirm = useConfirmAction(t('turma.actionError'));

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Cadeira escolhida por prazo para "juntar as minhas tasks".
  const [areaChoice, setAreaChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const areaByName = useMemo(() => new Map((areas ?? []).map((a) => [normalize(a.name), a.id])), [areas]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (deadline: TurmaDeadline) => {
    setEditingId(deadline.id);
    setForm({
      subject: deadline.subject,
      title: deadline.title,
      kind: deadline.kind,
      dueAt: toLocalInput(deadline.dueAt),
      weight: deadline.weightPercentage === null ? '' : String(deadline.weightPercentage),
    });
    setShowForm(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.title.trim() || !form.dueAt) return;
    const input = {
      subject: form.subject.trim(),
      title: form.title.trim(),
      kind: form.kind,
      dueAt: new Date(form.dueAt).toISOString(),
      weightPercentage: form.weight === '' ? null : Number(form.weight),
    };
    setSaving(true);
    try {
      if (editingId) {
        await updateTurmaDeadline(turmaId, editingId, input);
        notify(t('turma.deadlines.updated'), 'success');
      } else {
        await createTurmaDeadline(turmaId, input);
        notify(t('turma.deadlines.created'), 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      reload();
    } catch {
      notify(t('turma.actionError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const adopt = async (deadline: TurmaDeadline, areaId: string) => {
    setBusy(deadline.id);
    try {
      await adoptTurmaDeadline(turmaId, deadline.id, areaId);
      notify(t('turma.deadlines.added'), 'success');
      reload();
    } catch {
      notify(t('turma.actionError'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const requestRemove = (deadline: TurmaDeadline) =>
    confirm.request({
      title: t('turma.deadlines.remove'),
      message: t('turma.deadlines.removeConfirm', { title: deadline.title }),
      confirmLabel: t('turma.deadlines.remove'),
      tone: 'danger',
      run: async () => {
        await removeTurmaDeadline(turmaId, deadline.id);
        reload();
      },
    });

  const subjectOptions = useMemo(() => [...new Set((areas ?? []).map((a) => a.name))], [areas]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-neutral-300">{t('turma.deadlines.hint')}</p>
          {!showForm && (
            <Button type="button" onClick={openNew}>
              {t('turma.deadlines.add')}
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={t('turma.deadlines.subject')}
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                list="turma-deadline-subjects"
                maxLength={120}
                required
              />
              <datalist id="turma-deadline-subjects">
                {subjectOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <Input
                label={t('turma.deadlines.title')}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder={t('turma.deadlines.titlePlaceholder')}
                maxLength={200}
                required
              />
              <Input
                label={t('turma.deadlines.dueAt')}
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => set('dueAt', e.target.value)}
                required
              />
              <Input
                label={t('turma.deadlines.weight')}
                type="number"
                min={0}
                max={100}
                step="any"
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('turma.deadlines.kind')}>
              {KINDS.map((kind) => (
                <ToggleChip key={kind} pressed={form.kind === kind} onClick={() => set('kind', kind)}>
                  {t(KIND_LABEL_KEY[kind])}
                </ToggleChip>
              ))}
            </div>
            {editingId && <p className="text-xs text-neutral-400">{t('turma.deadlines.editHint')}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {editingId ? t('turma.deadlines.save') : t('turma.deadlines.add')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                {t('ui.cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>

      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t('turma.deadlines.none')} />
      ) : (
        <ul className="space-y-3">
          {data.map((deadline) => {
            const canEdit = isDelegado || deadline.createdById === user?.id;
            const isPast = new Date(deadline.dueAt).getTime() < Date.now();
            const chosenArea = areaChoice[deadline.id] ?? areaByName.get(normalize(deadline.subject)) ?? '';
            return (
              <li key={deadline.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">{deadline.subject}</p>
                    <p className="font-medium text-white">
                      {deadline.title}
                      {deadline.weightPercentage !== null && (
                        <span className="ml-2 text-sm font-normal text-neutral-400">{deadline.weightPercentage}%</span>
                      )}
                    </p>
                    <p className={`text-sm ${isPast ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>
                      {t(KIND_LABEL_KEY[deadline.kind])} · {formatDateTime(deadline.dueAt)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {t('turma.deadlines.meta', {
                        name: deadline.createdByName ?? t('social.anonymous'),
                        count: deadline.addedCount,
                      })}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <IconButton label={t('turma.deadlines.edit')} onClick={() => openEdit(deadline)}>
                        <PencilIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton label={t('turma.deadlines.remove')} tone="danger" onClick={() => requestRemove(deadline)}>
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-neutral-800 pt-3">
                  {deadline.myTaskId ? (
                    <p className="text-sm text-neutral-300">
                      {t('turma.deadlines.inYourTasks')}{' '}
                      <Link to="/tasks" className="font-medium text-violet-400 hover:text-violet-300">
                        {t('turma.deadlines.openTasks')}
                      </Link>
                    </p>
                  ) : areas && areas.length === 0 ? (
                    <p className="text-sm text-neutral-400">
                      {t('turma.deadlines.noAreas')}{' '}
                      <Link to="/areas" className="font-medium text-violet-400 hover:text-violet-300">
                        {t('turma.deadlines.openAreas')}
                      </Link>
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[10rem] flex-1">
                        <Select
                          label={t('turma.deadlines.intoSubject')}
                          value={chosenArea}
                          onChange={(e) => setAreaChoice((c) => ({ ...c, [deadline.id]: e.target.value }))}
                        >
                          <option value="">{t('turma.deadlines.pickSubject')}</option>
                          {(areas ?? []).map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        type="button"
                        disabled={!chosenArea || busy !== null}
                        onClick={() => void adopt(deadline, chosenArea)}
                      >
                        {t('turma.deadlines.addToMine')}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}
