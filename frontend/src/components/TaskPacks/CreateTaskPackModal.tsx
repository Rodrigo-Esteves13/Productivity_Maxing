import { useMemo, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import { useI18n } from '../../i18n/useI18n';
import type { Area, Task } from '../../types/models';

const MAX_PACK_ITEMS = 50;
const MAX_NAME_LENGTH = 80;

interface Props {
  isOpen: boolean;
  tasks: Task[];
  areas: Area[];
  isSaving: boolean;
  onClose: () => void;
  onCreate: (name: string, taskIds: string[]) => Promise<boolean>;
}

export default function CreateTaskPackModal({ isOpen, tasks, areas, isSaving, onClose, onCreate }: Props) {
  const { t, lang } = useI18n();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const areaName = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [tasks],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PACK_ITEMS) next.add(id);
      return next;
    });

  const reset = () => {
    setName('');
    setSelected(new Set());
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t('packs.create.needName'));
    if (selected.size === 0) return setError(t('packs.create.needTasks'));
    setError('');
    const ok = await onCreate(name.trim(), [...selected]);
    if (ok) {
      reset();
      onClose();
    } else {
      setError(t('packs.create.error'));
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
          {sorted.length === 0 ? (
            <p className="text-sm text-neutral-500">{t('packs.create.noTasks')}</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-800 p-2">
              {sorted.map((task) => (
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
                        {areaName.get(task.areaId) ?? '-'} · {new Date(task.date).toLocaleDateString(lang)}
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
