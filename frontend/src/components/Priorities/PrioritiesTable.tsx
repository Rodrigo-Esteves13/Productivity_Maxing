import ColorDot from '../UI/ColorDot';
import ActiveBadge from '../TaskTypes/ActiveBadge';
import { EyeIcon, EyeOffIcon, PencilIcon } from '../UI/Icons';
import type { AdminPriority } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';
import EmptyState from '../UI/EmptyState';
import { DEFAULT_PRIORITY_COLOR } from '../../lib/taskTypeColors';

interface PrioritiesTableProps {
  priorities: AdminPriority[];
  onEdit: (priority: AdminPriority) => void;
  onToggleActive: (priority: AdminPriority) => void;
}

export default function PrioritiesTable({ priorities, onEdit, onToggleActive }: PrioritiesTableProps) {
  const { t } = useI18n();

  const name = (p: AdminPriority) => (
    <div className="flex min-w-0 items-center gap-2">
      <ColorDot color={p.colorHex ?? DEFAULT_PRIORITY_COLOR} />
      <span className="truncate font-medium text-neutral-200" title={p.label}>
        {p.label}
      </span>
    </div>
  );

  const actions = (p: AdminPriority) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton label={t('ui.editPriority')} onClick={() => onEdit(p)} className="text-neutral-400 hover:text-white">
        <PencilIcon />
      </IconButton>
      <IconButton
        label={p.isActive ? t('ui.deactivate') : t('ui.reactivate')}
        onClick={() => onToggleActive(p)}
        className={p.isActive ? 'text-neutral-400 hover:text-red-400' : 'text-violet-400 hover:text-violet-300'}
      >
        {p.isActive ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </IconButton>
    </div>
  );

  if (priorities.length === 0) {
    return <EmptyState message={t('ui.noPrioritiesYet')} />;
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      {/* Mobile: um cartao por prioridade, com as mesmas acoes da tabela */}
      <ul className="divide-y divide-neutral-800 md:hidden">
        {priorities.map((p) => (
          <li key={p.id} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              {name(p)}
              <ActiveBadge isActive={p.isActive} />
            </div>
            <p className="text-xs text-neutral-500">
              {t('ui.order')}: {p.order}
            </p>
            {actions(p)}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">{t('ui.name')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.order')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('ui.status')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('ui.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {priorities.map((p) => (
              <tr key={p.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30 transition-colors">
                <td className="px-4 py-3">{name(p)}</td>
                <td className="px-4 py-3 text-center text-neutral-500">{p.order}</td>
                <td className="px-4 py-3 text-center">
                  <ActiveBadge isActive={p.isActive} />
                </td>
                <td className="px-4 py-3">{actions(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
