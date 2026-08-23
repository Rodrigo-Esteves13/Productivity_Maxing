import ColorDot from '../UI/ColorDot';
import ActiveBadge from '../TaskTypes/ActiveBadge';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import type { AdminPriority } from '../../types/models';

interface PrioritiesTableProps {
  priorities: AdminPriority[];
  onEdit: (priority: AdminPriority) => void;
  onToggleActive: (priority: AdminPriority) => void;
}

export default function PrioritiesTable({ priorities, onEdit, onToggleActive }: PrioritiesTableProps) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium text-center">Order</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {priorities.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  No priorities yet.
                </td>
              </tr>
            ) : (
              priorities.map((p) => (
                <tr key={p.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ColorDot color={p.colorHex ?? '#808080'} />
                      <span className="font-medium text-neutral-200">{p.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-500">{p.order}</td>
                  <td className="px-4 py-3 text-center">
                    <ActiveBadge isActive={p.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(p)}
                        title="Edit priority"
                        className="text-neutral-400 hover:text-white transition-colors p-1.5"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => onToggleActive(p)}
                        title={p.isActive ? 'Deactivate' : 'Reactivate'}
                        className={`transition-colors p-1.5 ${
                          p.isActive
                            ? 'text-neutral-400 hover:text-red-500'
                            : 'text-emerald-500 hover:text-emerald-400'
                        }`}
                      >
                        {p.isActive ? <TrashIcon /> : <span className="text-xs font-semibold px-1">Reactivate</span>}
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
