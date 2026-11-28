import { useMemo, useState } from 'react';
import type { Area, Task } from '../../types/models';
import { ALL_AREAS, filterPackTasks } from '../../lib/packTaskFilter';
import { formatTaskDue } from '../../lib/taskReadiness';
import { useI18n } from '../../i18n/useI18n';
import SearchField from '../UI/SearchField';
import EmptyState from '../UI/EmptyState';
import Button from '../UI/Button';
import FormError from '../UI/FormError';

interface Props {
  // So tasks que ainda nao estao no pacote.
  tasks: Task[];
  areas: Area[];
  // Quantas ainda cabem no pacote.
  room: number;
  isBusy: boolean;
  onAdd: (taskIds: string[]) => Promise<string | null>;
}

export default function PackAddTasks({ tasks, areas, room, isBusy, onAdd }: Props) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const areaName = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const visible = useMemo(
    () =>
      filterPackTasks(
        [...tasks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        query,
        ALL_AREAS,
        (task) => areaName.get(task.areaId),
      ),
    [tasks, query, areaName],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < room) next.add(id);
      return next;
    });

  const submit = async () => {
    setError('');
    const failure = await onAdd([...selected]);
    if (failure === null) setSelected(new Set());
    else setError(failure);
  };

  if (room <= 0) return <p className="text-sm text-neutral-500">{t('f7Study.packs.full')}</p>;
  if (tasks.length === 0) return <p className="text-sm text-neutral-500">{t('f7Study.packs.noMoreTasks')}</p>;

  return (
    <div className="space-y-2">
      <SearchField value={query} onChange={setQuery} label={t('ux4packs.create.search')} />
      {visible.length === 0 ? (
        <EmptyState variant="inline" message={t('search.noResults')} />
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-neutral-800 p-2">
          {visible.map((task) => (
            <li key={task.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-800/60">
                <input
                  type="checkbox"
                  className="mt-1 accent-violet-500"
                  checked={selected.has(task.id)}
                  onChange={() => toggle(task.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-neutral-100" title={task.title}>
                    {task.title}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {areaName.get(task.areaId) ?? '-'} · {formatTaskDue(task, lang)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <FormError message={error} />}
      <div className="flex justify-end">
        <Button type="button" disabled={isBusy || selected.size === 0} onClick={() => void submit()}>
          {t('f7Study.packs.addSelected', { count: selected.size })}
        </Button>
      </div>
    </div>
  );
}
