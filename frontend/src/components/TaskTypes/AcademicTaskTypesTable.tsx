import ActiveBadge from './ActiveBadge';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import type { AdminAcademicTaskType } from '../../types/models';

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
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Parent Task Type</th>
              <th className="px-4 py-3 font-medium text-center">Order</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {academicTaskTypes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No subcategories yet.
                </td>
              </tr>
            ) : (
              academicTaskTypes.map((a) => (
                <tr key={a.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30">
                  <td className="px-4 py-3 font-medium text-neutral-200">{a.label}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {a.taskType?.label ?? <span className="text-neutral-600 italic">deleted</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-500">{a.order}</td>
                  <td className="px-4 py-3 text-center">
                    <ActiveBadge isActive={a.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(a)}
                        title="Edit subcategory"
                        className="text-neutral-400 hover:text-white transition-colors p-1.5"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => onToggleActive(a)}
                        title={a.isActive ? 'Deactivate' : 'Reactivate'}
                        className={`transition-colors p-1.5 ${
                          a.isActive
                            ? 'text-neutral-400 hover:text-red-500'
                            : 'text-emerald-500 hover:text-emerald-400'
                        }`}
                      >
                        {a.isActive ? <TrashIcon /> : <span className="text-xs font-semibold px-1">Reactivate</span>}
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
