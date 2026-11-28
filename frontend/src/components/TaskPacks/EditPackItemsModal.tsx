import type { TaskPackItemEdit, TaskPackSummary } from '../../api/taskPackService';
import type { Area, Task } from '../../types/models';
import { useTaskPackItems } from '../../hooks/useTaskPackItems';
import { useI18n } from '../../i18n/useI18n';
import Modal from '../UI/Modal';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import SectionLabel from '../UI/SectionLabel';
import PackItemRow from './PackItemRow';
import PackAddTasks from './PackAddTasks';

// Igual ao limite do backend (MAX_PACK_ITEMS).
const MAX_PACK_ITEMS = 50;

interface Props {
  pack: TaskPackSummary;
  tasks: Task[];
  areas: Area[];
  onClose: () => void;
  onItemCount: (id: string, count: number) => void;
  // Editar um item muda a task de origem: a lista de tasks tem de ser relida.
  onTasksChanged: () => Promise<void>;
}

export default function EditPackItemsModal({ pack, tasks, areas, onClose, onItemCount, onTasksChanged }: Props) {
  const { t } = useI18n();
  const { items, hasError, isBusy, add, remove, update } = useTaskPackItems(pack.id, onItemCount);
  const inPack = new Set(items?.map((i) => i.sourceTaskId));

  const updateItem = async (itemId: string, edit: TaskPackItemEdit) => {
    const failure = await update(itemId, edit);
    if (failure === null) void onTasksChanged();
    return failure;
  };

  return (
    <Modal isOpen onClose={onClose} title={t('f7Study.packs.modalTitle', { name: pack.name })}>
      {hasError ? (
        <ErrorState message={t('f7Study.packs.loadError')} />
      ) : !items ? (
        <LinesSkeleton />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">{t('f7Study.packs.intro')}</p>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <PackItemRow
                key={item.id}
                item={item}
                canRemove={items.length > 1}
                isBusy={isBusy}
                onUpdate={updateItem}
                onRemove={remove}
              />
            ))}
          </ul>
          <section>
            <SectionLabel className="mb-2 block">{t('f7Study.packs.addTitle')}</SectionLabel>
            <PackAddTasks
              tasks={tasks.filter((task) => !inPack.has(task.id))}
              areas={areas}
              room={MAX_PACK_ITEMS - items.length}
              isBusy={isBusy}
              onAdd={add}
            />
          </section>
        </div>
      )}
    </Modal>
  );
}
