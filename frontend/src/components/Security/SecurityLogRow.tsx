import type { SecurityLog } from '../../types/models';

interface SecurityLogRowProps {
  log: SecurityLog;
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'text-sky-400',
  POST: 'text-emerald-400',
  PATCH: 'text-amber-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
};

export default function SecurityLogRow({ log }: SecurityLogRowProps) {
  return (
    <tr className="border-b border-neutral-800 last:border-0 hover:bg-neutral-900/40">
      <td className="px-4 py-3 text-neutral-400">
        {new Date(log.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3 font-mono text-neutral-200">{log.ip}</td>
      <td className={`px-4 py-3 font-semibold ${METHOD_STYLES[log.method] ?? 'text-neutral-300'}`}>
        {log.method}
      </td>
      <td className="px-4 py-3 font-mono text-neutral-300 max-w-xs truncate" title={log.path}>
        {log.path}
      </td>
      <td className="px-4 py-3 text-neutral-300">
        {log.user ? (log.user.name || log.user.email) : <span className="text-neutral-600">anonymous</span>}
      </td>
      <td className="px-4 py-3 text-neutral-500 max-w-xs truncate" title={log.userAgent ?? undefined}>
        {log.userAgent ?? '-'}
      </td>
    </tr>
  );
}
