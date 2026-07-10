import ColorDot from '../UI/ColorDot';
import ActiveBadge from './ActiveBadge';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import type { AdminTaskType } from '../../types/models';

interface TaskTypesTableProps {
  taskTypes: AdminTaskType[];
  onEdit: (taskType: AdminTaskType) => void;
  onToggleActive: (taskType: AdminTaskType) => void;
}

export default function TaskTypesTable({ taskTypes, onEdit, onToggleActive }: TaskTypesTableProps) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Subcategories</th>
              <th className="px-4 py-3 font-medium text-center">Order</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {taskTypes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No task types yet.
                </td>
              </tr>
            ) : (
              taskTypes.map((t) => (
                <tr key={t.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ColorDot color={t.colorHex ?? '#808080'} />
                      <span className="font-medium text-neutral-200">{t.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {t.academicTaskTypes.length === 0
                      ? '-'
                      : `${t.academicTaskTypes.filter((a) => a.isActive).length} active`}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-500">{t.order}</td>
                  <td className="px-4 py-3 text-center">
                    <ActiveBadge isActive={t.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(t)}
                        title="Edit task type"
                        className="text-neutral-400 hover:text-white transition-colors p-1.5"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => onToggleActive(t)}
                        title={t.isActive ? 'Deactivate' : 'Reactivate'}
                        className={`transition-colors p-1.5 ${
                          t.isActive
                            ? 'text-neutral-400 hover:text-red-500'
                            : 'text-emerald-500 hover:text-emerald-400'
                        }`}
                      >
                        {t.isActive ? <TrashIcon /> : <span className="text-xs font-semibold px-1">Reactivate</span>}
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
