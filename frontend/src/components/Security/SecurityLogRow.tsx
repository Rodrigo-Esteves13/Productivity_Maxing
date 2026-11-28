import type { SecurityLog } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { SECURITY_LOG_METHOD_STYLES, SECURITY_LOG_TYPE_LABEL_KEYS } from './securityLogDisplay';

interface SecurityLogRowProps {
  log: SecurityLog;
  onBanIp: (ip: string) => void;
  isBanned: boolean;
}

export default function SecurityLogRow({ log, onBanIp, isBanned }: SecurityLogRowProps) {
  const { t, lang } = useI18n();
  const typeLabelKey = SECURITY_LOG_TYPE_LABEL_KEYS[log.type];
  return (
    <tr className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3 text-neutral-400">
        {new Date(log.createdAt).toLocaleString(lang)}
      </td>
      <td className="px-4 py-3 font-mono text-neutral-200">
        <div className="flex items-center gap-2">
          <span>{log.ip}</span>
          {isBanned ? (
            <span className="text-xs text-neutral-500">{t('ui.bannedLower')}</span>
          ) : (
            <button
              type="button"
              onClick={() => onBanIp(log.ip)}
              className="text-xs text-amber-500 hover:text-amber-400 hover:underline pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              {t('ui.ban')}
            </button>
          )}
        </div>
      </td>
      <td className={`px-4 py-3 font-semibold ${SECURITY_LOG_METHOD_STYLES[log.method] ?? 'text-neutral-300'}`}>
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
        {log.user ? (log.user.name || log.user.email) : <span className="text-neutral-500">{t('ui.anonymousLower')}</span>}
      </td>
      <td className="px-4 py-3 text-neutral-500 max-w-xs truncate" title={log.userAgent ?? undefined}>
        {log.userAgent ?? '-'}
      </td>
    </tr>
  );
}
