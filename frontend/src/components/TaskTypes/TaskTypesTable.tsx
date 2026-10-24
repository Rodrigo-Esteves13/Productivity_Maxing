import ColorDot from '../UI/ColorDot';
import ActiveBadge from './ActiveBadge';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import type { AdminTaskType } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

interface TaskTypesTableProps {
  taskTypes: AdminTaskType[];
  onEdit: (taskType: AdminTaskType) => void;
  onToggleActive: (taskType: AdminTaskType) => void;
}

export default function TaskTypesTable({ taskTypes, onEdit, onToggleActive }: TaskTypesTableProps) {
  const { t } = useI18n();
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
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
            {taskTypes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  {t('ui.noTaskTypesYet2')}
                </td>
              </tr>
            ) : (
              taskTypes.map((type) => (
                <tr key={type.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ColorDot color={type.colorHex ?? '#808080'} />
                      <span className="font-medium text-neutral-200">{type.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {type.academicTaskTypes.length === 0
                      ? '-'
                      : t('ui.nActive', { count: type.academicTaskTypes.filter((a) => a.isActive).length })}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-500">{type.order}</td>
                  <td className="px-4 py-3 text-center">
                    <ActiveBadge isActive={type.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label={t('ui.editTaskType')}
                        onClick={() => onEdit(type)}
                        className="text-neutral-400 hover:text-white"
                      >
                        <PencilIcon />
                      </IconButton>
                      <button
                        onClick={() => onToggleActive(type)}
                        title={type.isActive ? t('ui.deactivate') : t('ui.reactivate')}
                        className={`transition-colors p-1.5 ${
                          type.isActive
                            ? 'text-neutral-400 hover:text-red-500'
                            : 'text-violet-500 hover:text-violet-400'
                        }`}
                      >
                        {type.isActive ? <TrashIcon /> : <span className="text-xs font-semibold px-1">{t('ui.reactivate')}</span>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
