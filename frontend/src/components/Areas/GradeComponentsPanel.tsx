import { useState } from 'react';
import type { Area, GradeComponent } from '../../types/models';
import { useAcademic } from '../../context/useAcademic';
import { useGradeComponents } from '../../hooks/useGradeComponents';
import { useWeightBudget } from '../../hooks/useWeightBudget';
import { roundTo } from '../../utils/roundTo';
import { useI18n } from '../../i18n/useI18n';
import { getApiMessage } from '../../lib/httpError';
import { ChartPieIcon, PlusIcon } from '../UI/Icons';
import Button from '../UI/Button';
import ConfirmDialog from '../UI/ConfirmDialog';
import LinesSkeleton from '../UI/LinesSkeleton';
import GradeComponentCard from './GradeComponentCard';
import GradeComponentForm from './GradeComponentForm';

interface GradeComponentsPanelProps {
  area: Area;
}

// Notas que nao sao tasks (seminarios semanais, participacao...). Vive na
// cadeira, nao nas Tasks nem no Dashboard: so conta para as medias.
export default function GradeComponentsPanel({ area }: GradeComponentsPanelProps) {
  const { t } = useI18n();
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  const periodId = isViewingAllPeriods || isViewingAllPrograms ? null : (activePeriod?.id ?? null);
  const { components, isLoading, error, create, update, remove, addEntry, editEntry, removeEntry } =
    useGradeComponents(area.id, periodId);

  const [isAdding, setIsAdding] = useState(false);
  const [toDelete, setToDelete] = useState<GradeComponent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const totalWeight = components.reduce((sum, c) => sum + c.weightPercentage, 0);
  // Refaz o pedido quando os componentes mudam (peso novo, apagado...).
  const budget = useWeightBudget(area.id, periodId, undefined, totalWeight);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await remove(toDelete.id);
      setToDelete(null);
    } catch (err) {
      setDeleteError(getApiMessage(err, t('grades.error.generic')));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="mt-6 space-y-3 border-t border-neutral-800 pt-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-200">
          <ChartPieIcon className="h-4 w-4 text-violet-400" />
          {t('grades.title')}
        </h3>
        {periodId && !isAdding && (
          <Button
            type="button"
            variant="secondary"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
            onClick={() => setIsAdding(true)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t('grades.add')}
          </Button>
        )}
      </div>

      <p className="text-xs text-neutral-500">{t('grades.hint')}</p>

      {!periodId ? (
        <p className="text-sm text-neutral-500">{t('grades.needPeriod')}</p>
      ) : isLoading ? (
        <LinesSkeleton lines={3} />
      ) : (
        <>
          {error && (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          )}

          {isAdding && (
            <GradeComponentForm
              onSubmit={async (input) => {
                await create(input);
                setIsAdding(false);
              }}
              onCancel={() => setIsAdding(false)}
            />
          )}

          {components.length === 0 && !isAdding ? (
            <p className="rounded-lg border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-500">
              {t('grades.empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {components.map((component) => (
                <GradeComponentCard
                  key={component.id}
                  component={component}
                  onUpdate={(changes) => update(component.id, changes)}
                  onRequestDelete={() => setToDelete(component)}
                  onAddEntry={(input) => addEntry(component.id, input)}
                  onEditEntry={(entryId, grade) => editEntry(component.id, entryId, { grade })}
                  onRemoveEntry={(entryId) => removeEntry(component.id, entryId)}
                />
              ))}
            </ul>
          )}

          {components.length > 0 && (
            <p className="text-xs text-neutral-500">{t('grades.weightTotal', { weight: totalWeight })}</p>
          )}

          {budget && (
            <p className={`text-xs ${budget.remaining > 0 ? 'text-amber-400' : 'text-neutral-500'}`}>
              {budget.remaining > 0
                ? t('grades.budgetMissing', { assigned: roundTo(budget.used), missing: roundTo(budget.remaining) })
                : t('grades.budgetFull')}
            </p>
          )}
        </>
      )}

      {toDelete && (
        <ConfirmDialog
          title={t('grades.deleteTitle', { name: toDelete.name })}
          message={t('grades.deleteMessage', { count: toDelete.entries.length })}
          confirmLabel={t('grades.delete')}
          cancelLabel={t('grades.cancel')}
          tone="danger"
          isBusy={isDeleting}
          error={deleteError || null}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setToDelete(null);
            setDeleteError('');
          }}
        />
      )}
    </section>
  );
}
