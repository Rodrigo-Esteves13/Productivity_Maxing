import type { SecurityLog } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface SecurityLogRowProps {
  log: SecurityLog;
  onBanIp: (ip: string) => void;
  isBanned: boolean;
}

// Linhas que não são bloqueios de rate limit (moderação de pads pelo
// admin, E-08): mostradas com um rótulo em vez de parecerem um ataque.
const TYPE_LABEL_KEYS: Partial<Record<SecurityLog['type'], string>> = {
  ADMIN_PAD_DELETED: 'ui.securityTypeAdminPadDeleted',
  ADMIN_PAD_SOURCE_BLOCKED: 'ui.securityTypeAdminPadSourceBlocked',
};

const METHOD_STYLES: Record<string, string> = {
  GET: 'text-sky-400',
  POST: 'text-violet-400',
  PATCH: 'text-amber-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
};

export default function SecurityLogRow({ log, onBanIp, isBanned }: SecurityLogRowProps) {
  const { t } = useI18n();
  const typeLabelKey = TYPE_LABEL_KEYS[log.type];
  return (
    <tr className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3 text-neutral-400">
        {new Date(log.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3 font-mono text-neutral-200">
        <div className="flex items-center gap-2">
          <span>{log.ip}</span>
          {isBanned ? (
            <span className="text-xs text-neutral-600">{t('ui.bannedLower')}</span>
          ) : (
            <button
              type="button"
              onClick={() => onBanIp(log.ip)}
              className="text-xs text-amber-500 hover:text-amber-400 hover:underline"
            >
              {t('ui.ban')}
            </button>
          )}
        </div>
      </td>
      <td className={`px-4 py-3 font-semibold ${METHOD_STYLES[log.method] ?? 'text-neutral-300'}`}>
        {log.method}
      </td>
      <td className="px-4 py-3 font-mono text-neutral-300 max-w-xs truncate" title={log.path}>
        {typeLabelKey && (
          <span className="mr-2 rounded bg-neutral-800 px-1.5 py-0.5 font-sans text-xs text-neutral-400">
            {t(typeLabelKey)}
          </span>
        )}
        {log.path}
        {log.count > 1 && (
          <span
            className="ml-2 font-sans text-xs text-amber-400"
            title={t('ui.securityBlockedCount', { count: log.count })}
          >
            x{log.count}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-neutral-300">
        {log.user ? (log.user.name || log.user.email) : <span className="text-neutral-600">{t('ui.anonymousLower')}</span>}
      </td>
      <td className="px-4 py-3 text-neutral-500 max-w-xs truncate" title={log.userAgent ?? undefined}>
        {log.userAgent ?? '-'}
      </td>
    </tr>
  );
}
