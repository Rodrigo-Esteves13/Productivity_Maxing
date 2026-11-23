import type { SecurityLog } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { SECURITY_LOG_METHOD_STYLES, SECURITY_LOG_TYPE_LABEL_KEYS } from './securityLogDisplay';

interface SecurityLogCardProps {
  log: SecurityLog;
  onBanIp: (ip: string) => void;
  isBanned: boolean;
}

// Versao em cartao de SecurityLogRow para ecras estreitos (sem scroll lateral).
export default function SecurityLogCard({ log, onBanIp, isBanned }: SecurityLogCardProps) {
  const { t, lang } = useI18n();
  const typeLabelKey = SECURITY_LOG_TYPE_LABEL_KEYS[log.type];
  return (
    <li className="space-y-1.5 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-neutral-200">{log.ip}</span>
        {isBanned ? (
          <span className="text-xs text-neutral-500">{t('ui.bannedLower')}</span>
        ) : (
          <button
            type="button"
            onClick={() => onBanIp(log.ip)}
            className="rounded px-2 py-1 text-xs text-amber-500 hover:text-amber-400 hover:underline pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            {t('ui.ban')}
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-400">{new Date(log.createdAt).toLocaleString(lang)}</p>
      <p className="flex min-w-0 items-baseline gap-2 font-mono text-neutral-300">
        <span className={`font-semibold ${SECURITY_LOG_METHOD_STYLES[log.method] ?? 'text-neutral-300'}`}>
          {log.method}
        </span>
        <span className="min-w-0 break-all">{log.path}</span>
        {log.count > 1 && (
          <span
            className="shrink-0 font-sans text-xs text-amber-400"
            title={t('ui.securityBlockedCount', { count: log.count })}
          >
            x{log.count}
          </span>
        )}
      </p>
      {typeLabelKey && (
        <span className="inline-block rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400">
          {t(typeLabelKey)}
        </span>
      )}
      <p className="text-xs text-neutral-300">
        {log.user ? (
          log.user.name || log.user.email
        ) : (
          <span className="text-neutral-500">{t('ui.anonymousLower')}</span>
        )}
      </p>
      {log.userAgent && (
        <p className="truncate text-xs text-neutral-500" title={log.userAgent}>
          {log.userAgent}
        </p>
      )}
    </li>
  );
}
