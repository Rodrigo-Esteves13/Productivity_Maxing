import ActiveBadge from './ActiveBadge';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import type { AdminAcademicTaskType } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

interface AcademicTaskTypesTableProps {
  academicTaskTypes: AdminAcademicTaskType[];
  onEdit: (item: AdminAcademicTaskType) => void;
  onToggleActive: (item: AdminAcademicTaskType) => void;
}

export default function AcademicTaskTypesTable({
  academicTaskTypes,
  onEdit,
  onToggleActive,
}: AcademicTaskTypesTableProps) {
  const { t } = useI18n();
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">{t('ui.name')}</th>
              <th className="px-4 py-3 font-medium">{t('ui.parentTaskType')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.order')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.status')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('ui.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {academicTaskTypes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  {t('ui.noSubcategoriesYet')}
                </td>
              </tr>
            ) : (
              academicTaskTypes.map((a) => (
                <tr key={a.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-neutral-200">
                    {a.label}
                    {a.isEvent && <span className="ml-2 text-[10px] uppercase text-violet-400">{t('ui.event')}</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {a.taskType?.label ?? <span className="text-neutral-500 italic">{t('ui.deletedLower')}</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-500">{a.order}</td>
                  <td className="px-4 py-3 text-center">
                    <ActiveBadge isActive={a.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label={t('ui.editSubcategory')}
                        onClick={() => onEdit(a)}
                        className="text-neutral-400 hover:text-white"
                      >
                        <PencilIcon />
                      </IconButton>
                      <button
                        onClick={() => onToggleActive(a)}
                        title={a.isActive ? t('ui.deactivate') : t('ui.reactivate')}
                        className={`transition-colors p-1.5 ${
                          a.isActive
                            ? 'text-neutral-400 hover:text-red-500'
                            : 'text-violet-500 hover:text-violet-400'
                        }`}
                      >
                        {a.isActive ? <TrashIcon /> : <span className="text-xs font-semibold px-1">{t('ui.reactivate')}</span>}
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
