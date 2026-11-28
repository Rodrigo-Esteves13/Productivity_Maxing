import ActiveBadge from './ActiveBadge';
import { EyeIcon, EyeOffIcon, PencilIcon } from '../UI/Icons';
import type { AdminAcademicTaskType } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';
import EmptyState from '../UI/EmptyState';

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

  const actions = (item: AdminAcademicTaskType) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton
        label={t('ui.editSubcategory')}
        onClick={() => onEdit(item)}
        className="text-neutral-400 hover:text-white"
      >
        <PencilIcon />
      </IconButton>
      <IconButton
        label={item.isActive ? t('ui.deactivate') : t('ui.reactivate')}
        onClick={() => onToggleActive(item)}
        className={item.isActive ? 'text-neutral-400 hover:text-red-400' : 'text-violet-400 hover:text-violet-300'}
      >
        {item.isActive ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </IconButton>
    </div>
  );

  const name = (item: AdminAcademicTaskType) => (
    <>
      {item.label}
      {item.isEvent && <span className="ml-2 text-[10px] uppercase text-violet-400">{t('ui.event')}</span>}
    </>
  );

  const parent = (item: AdminAcademicTaskType) =>
    item.taskType?.label ?? <span className="text-neutral-500 italic">{t('ui.deletedLower')}</span>;

  if (academicTaskTypes.length === 0) {
    return <EmptyState message={t('ui.noSubcategoriesYet')} />;
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      {/* Mobile: um cartao por subcategoria, com as mesmas acoes da tabela */}
      <ul className="divide-y divide-neutral-800 md:hidden">
        {academicTaskTypes.map((a) => (
          <li key={a.id} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium text-neutral-200" title={a.label}>
                {name(a)}
              </span>
              <ActiveBadge isActive={a.isActive} />
            </div>
            <p className="text-xs text-neutral-500">
              {t('ui.parentTaskType')}: {parent(a)} · {t('ui.order')}: {a.order}
              {a.taskCount !== undefined && ` · ${t('f7admin.types.tasks')}: ${a.taskCount}`}
            </p>
            {actions(a)}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">{t('ui.name')}</th>
              <th className="px-4 py-3 font-medium">{t('ui.parentTaskType')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('f7admin.types.tasks')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.order')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.status')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('ui.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {academicTaskTypes.map((a) => (
              <tr key={a.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-neutral-200">{name(a)}</td>
                <td className="px-4 py-3 text-neutral-400">{parent(a)}</td>
                <td className="px-4 py-3 text-center tabular-nums text-neutral-500">{a.taskCount ?? '-'}</td>
                <td className="px-4 py-3 text-center text-neutral-500">{a.order}</td>
                <td className="px-4 py-3 text-center">
                  <ActiveBadge isActive={a.isActive} />
                </td>
                <td className="px-4 py-3">{actions(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
