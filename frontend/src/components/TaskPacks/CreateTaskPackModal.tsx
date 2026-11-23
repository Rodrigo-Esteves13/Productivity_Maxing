import { useMemo, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import { useI18n } from '../../i18n/useI18n';
import type { Area, Task } from '../../types/models';
import SelectionToolbar from '../UI/SelectionToolbar';
import { formatTaskDue } from '../../lib/taskReadiness';
import SearchField from '../UI/SearchField';
import Select from '../UI/Select';
import EmptyState from '../UI/EmptyState';
import { ALL_AREAS, filterPackTasks } from '../../lib/packTaskFilter';

const MAX_PACK_ITEMS = 50;
const MAX_NAME_LENGTH = 80;

interface Props {
  isOpen: boolean;
  tasks: Task[];
  areas: Area[];
  isSaving: boolean;
  onClose: () => void;
  // null = criado; texto = erro a mostrar.
  onCreate: (name: string, taskIds: string[]) => Promise<string | null>;
}

export default function CreateTaskPackModal({ isOpen, tasks, areas, isSaving, onClose, onCreate }: Props) {
  const { t, lang } = useI18n();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState(ALL_AREAS);

  const areaName = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [tasks],
  );

  // A lista mostrada respeita pesquisa e Area; a selecao continua a ser por id.
  const visible = useMemo(
    () => filterPackTasks(sorted, query, areaFilter, (task) => areaName.get(task.areaId)),
    [sorted, query, areaFilter, areaName],
  );
  const areaOptions = useMemo(() => {
    const used = new Set(tasks.map((task) => task.areaId));
    return areas.filter((a) => used.has(a.id));
  }, [areas, tasks]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PACK_ITEMS) next.add(id);
      return next;
    });

  // "Todas" respeita o limite do pacote: as primeiras por data.
  const selectAll = () => setSelected(new Set(visible.slice(0, MAX_PACK_ITEMS).map((task) => task.id)));
  const selectNone = () => setSelected(new Set());

  const reset = () => {
    setName('');
    setSelected(new Set());
    setError('');
    setQuery('');
    setAreaFilter(ALL_AREAS);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t('packs.create.needName'));
    if (selected.size === 0) return setError(t('packs.create.needTasks'));
    setError('');
    const failure = await onCreate(name.trim(), [...selected]);
    if (failure === null) {
      reset();
      onClose();
    } else {
      setError(failure);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title={t('packs.create.title')}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <p className="text-sm text-neutral-400">{t('packs.create.intro')}</p>
        <Input
          label={t('packs.create.name')}
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder={t('packs.create.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-300">
            {t('packs.create.pick', { count: selected.size, max: MAX_PACK_ITEMS })}
          </legend>
          {sorted.length > 0 && (
            <SelectionToolbar
              className="mb-2"
              selectedCount={selected.size}
              selectableCount={Math.min(visible.length, MAX_PACK_ITEMS)}
              onSelectAll={selectAll}
              onSelectNone={selectNone}
            />
          )}
          {sorted.length > 0 && (
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchField value={query} onChange={setQuery} label={t('ux4packs.create.search')} />
              <Select
                aria-label={t('ux4packs.create.areaFilter')}
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="sm:max-w-xs"
              >
                <option value={ALL_AREAS}>{t('ux4packs.create.allAreas')}</option>
                {areaOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {sorted.length === 0 ? (
            <p className="text-sm text-neutral-500">{t('packs.create.noTasks')}</p>
          ) : visible.length === 0 ? (
            <EmptyState variant="inline" message={t('search.noResults')} />
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-800 p-2">
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
                      <span className="block truncate text-neutral-100">{task.title}</span>
                      <span className="block text-xs text-neutral-500">
                        {areaName.get(task.areaId) ?? '-'} · {formatTaskDue(task, lang)}
                        {task.weightPercentage != null && ` · ${task.weightPercentage}%`}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <p className="text-xs text-neutral-500">{t('packs.create.privacy')}</p>
        {error && <FormError message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose(); }}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t('common.creating') : t('packs.create.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
