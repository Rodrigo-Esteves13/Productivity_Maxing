import { memo, type ComponentType, type SVGProps } from 'react';
import { MonitorIcon, SmartphoneIcon, TabletIcon } from '../UI/Icons';
import { parseUserAgent, type DeviceKind } from '../../lib/userAgent';
import { displayMaskedIp } from '../../lib/maskedIp';
import { useI18n } from '../../i18n/useI18n';
import type { DeviceSession } from '../../types/models';

const KIND_ICON: Record<DeviceKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  desktop: MonitorIcon,
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
};

interface DeviceSessionRowProps {
  session: DeviceSession;
  isRevoking: boolean;
  onRevoke: (session: DeviceSession) => void;
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

// Uma sessao: aparelho (icone + browser/sistema), IP mascarado, ultima
// atividade e o botao de terminar. A sessao deste browser tem o selo
// "This device" e nao tem botao (para sair daqui ha o logout normal).
function DeviceSessionRow({ session, isRevoking, onRevoke }: DeviceSessionRowProps) {
  const { t, lang } = useI18n();
  const parsed = parseUserAgent(session.userAgent);
  const Icon = KIND_ICON[parsed.kind];
  const browser = parsed.browser ?? t('devices.unknownBrowser');
  const os = parsed.os ?? t('devices.unknownSystem');

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
            <span className="truncate">{t('devices.browserOnSystem', { browser, os })}</span>
            {session.current && (
              <span className="rounded-full border border-violet-800/60 bg-violet-950/50 px-2 py-0.5 text-xs font-medium text-violet-300">
                {t('devices.thisDevice')}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {t('devices.lastActive', { when: formatDateTime(session.lastSeenAt, lang) })}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {session.ipMasked
              ? t('devices.ipMasked', { ip: displayMaskedIp(session.ipMasked) })
              : t('devices.ipUnknown')}
            {' · '}
            {t('devices.signedIn', { when: formatDateTime(session.createdAt, lang) })}
          </p>
        </div>
      </div>
      {!session.current && (
        <button
          type="button"
          onClick={() => onRevoke(session)}
          disabled={isRevoking}
          className="press self-start rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-red-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 sm:self-center"
        >
          {isRevoking ? t('devices.signingOut') : t('devices.signOut')}
        </button>
      )}
    </li>
  );
}

export default memo(DeviceSessionRow);
