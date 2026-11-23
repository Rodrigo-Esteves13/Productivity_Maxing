import ColorDot from '../UI/ColorDot';
import ActiveBadge from './ActiveBadge';
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, PencilIcon } from '../UI/Icons';
import type { AdminTaskType } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';
import EmptyState from '../UI/EmptyState';
import type { MoveDirection } from '../../lib/taskTypeOrder';

interface TaskTypesTableProps {
  taskTypes: AdminTaskType[];
  // Pesquisa ativa: com filtro a ordem nao se muda (as posicoes enganam).
  isFiltering?: boolean;
  noResultsMessage?: string;
  canMove: (id: string, direction: MoveDirection) => boolean;
  onMove: (taskType: AdminTaskType, direction: MoveDirection) => void;
  onEdit: (taskType: AdminTaskType) => void;
  onToggleActive: (taskType: AdminTaskType) => void;
}

function TypeDot({ color }: { color: string | null | undefined }) {
  // Sem cor guardada: bolinha neutra por token (nao ha hex de interface).
  return color ? (
    <ColorDot color={color} />
  ) : (
    <span aria-hidden="true" className="inline-block h-4 w-4 flex-shrink-0 rounded-full bg-neutral-500" />
  );
}

export default function TaskTypesTable({
  taskTypes,
  isFiltering = false,
  noResultsMessage,
  canMove,
  onMove,
  onEdit,
  onToggleActive,
}: TaskTypesTableProps) {
  const { t } = useI18n();

  const actions = (type: AdminTaskType) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton
        label={t('ux4packs.types.moveUp', { name: type.label })}
        disabled={isFiltering || !canMove(type.id, 'up')}
        onClick={() => onMove(type, 'up')}
        className="text-neutral-400 hover:text-white"
      >
        <ArrowUpIcon className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={t('ux4packs.types.moveDown', { name: type.label })}
        disabled={isFiltering || !canMove(type.id, 'down')}
        onClick={() => onMove(type, 'down')}
        className="text-neutral-400 hover:text-white"
      >
        <ArrowDownIcon className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={t('ui.editTaskType')}
        onClick={() => onEdit(type)}
        className="text-neutral-400 hover:text-white"
      >
        <PencilIcon />
      </IconButton>
      <IconButton
        label={type.isActive ? t('ui.deactivate') : t('ui.reactivate')}
        onClick={() => onToggleActive(type)}
        className={type.isActive ? 'text-neutral-400 hover:text-red-400' : 'text-violet-400 hover:text-violet-300'}
      >
        {type.isActive ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </IconButton>
    </div>
  );

  const subcategories = (type: AdminTaskType) =>
    type.academicTaskTypes.length === 0
      ? '-'
      : t('ui.nActive', { count: type.academicTaskTypes.filter((a) => a.isActive).length });

  if (taskTypes.length === 0) {
    return <EmptyState message={noResultsMessage ?? t('ui.noTaskTypesYet2')} />;
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      {/* Mobile: um cartao por tipo, com as mesmas acoes da tabela */}
      <ul className="divide-y divide-neutral-800 md:hidden">
        {taskTypes.map((type) => (
          <li key={type.id} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <TypeDot color={type.colorHex} />
                <span className="truncate font-medium text-neutral-200" title={type.label}>
                  {type.label}
                </span>
              </div>
              <ActiveBadge isActive={type.isActive} />
            </div>
            <p className="text-xs text-neutral-500">
              {t('ui.subcategories')}: {subcategories(type)} · {t('ui.order')}: {type.order}
            </p>
            {actions(type)}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">{t('ui.name')}</th>
              <th className="px-4 py-3 font-medium">{t('ui.subcategories')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.order')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.status')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('ui.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {taskTypes.map((type) => (
              <tr key={type.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TypeDot color={type.colorHex} />
                    <span className="font-medium text-neutral-200">{type.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-500">{subcategories(type)}</td>
                <td className="px-4 py-3 text-center text-neutral-500">{type.order}</td>
                <td className="px-4 py-3 text-center">
                  <ActiveBadge isActive={type.isActive} />
                </td>
                <td className="px-4 py-3">{actions(type)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
