import { useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { useI18n } from '../../i18n/useI18n';
import { planReplan } from '../../lib/replanOverdue';
import type { Task } from '../../types/models';

interface ReplanOverdueModalProps {
  tasks: Task[];
  // Recebe (id, dia "YYYY-MM-DD") por task; devolve true se gravou.
  onApply: (moves: { id: string; date: string }[]) => Promise<boolean>;
  onClose: () => void;
}

// Mostra para que dia cada atrasada vai e so mexe depois de confirmar.
export default function ReplanOverdueModal({ tasks, onApply, onClose }: ReplanOverdueModalProps) {
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const plan = useMemo(() => planReplan(tasks), [tasks]);

  const confirm = async () => {
    setIsSaving(true);
    const ok = await onApply(plan.map((move) => ({ id: move.task.id, date: move.date })));
    setIsSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={t('replan.title')}>
      <div className="space-y-3">
        <p className="text-sm text-neutral-400">{t('replan.help')}</p>
        {plan.length === 0 ? (
          <p className="text-sm text-neutral-300">{t('replan.none')}</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {plan.map((move) => (
              <li key={move.task.id} className="flex items-center justify-between gap-3 border-b border-neutral-800 py-1.5">
                <span className="min-w-0 truncate text-neutral-200">{move.task.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                  {new Date(`${move.date}T00:00:00`).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('ui.cancel')}
          </Button>
          <Button type="button" size="sm" disabled={plan.length === 0 || isSaving} onClick={() => void confirm()}>
            {t('replan.confirm', { count: plan.length })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
