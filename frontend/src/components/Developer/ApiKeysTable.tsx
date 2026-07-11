import type { ApiKeySummary } from '../../types/models';
import { TrashIcon } from '../UI/Icons';

interface ApiKeysTableProps {
  keys: ApiKeySummary[];
  onRevoke: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ApiKeysTable({ keys, onRevoke }: ApiKeysTableProps) {
  return (
    <div className="overflow-x-auto border border-neutral-800 rounded-xl">
      <table className="min-w-full divide-y divide-neutral-800">
        <thead className="bg-neutral-900/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Created</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Last used</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {keys.map((key) => (
            <tr key={key.id} className="hover:bg-neutral-900/30 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-white">{key.name}</td>
              <td className="px-4 py-3 text-sm text-neutral-400">{formatDate(key.createdAt)}</td>
              <td className="px-4 py-3 text-sm text-neutral-400">
                {key.lastUsed ? formatDate(key.lastUsed) : 'Never'}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onRevoke(key.id)}
                  className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                  title="Revoke key"
                >
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
