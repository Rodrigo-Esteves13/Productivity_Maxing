import { useCallback } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useDeviceSessions } from '../hooks/useDeviceSessions';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import DeviceSessionRow from '../components/Devices/DeviceSessionRow';
import { useFeedback } from '../context/useFeedback';
import { useI18n } from '../i18n/useI18n';
import { parseUserAgent } from '../lib/userAgent';
import type { DeviceSession } from '../types/models';

// Dispositivos com sessao iniciada nesta conta: ver onde, terminar a sessao
// de um aparelho (perdido, partilhado) ou de todos menos este.
export default function Devices() {
  const { t } = useI18n();
  const { confirm, notify } = useFeedback();
  useDocumentTitle(t('devices.title'));
  const { sessions, isLoading, loadError, revokingId, isRevokingOthers, reload, revoke, revokeOthers } =
    useDeviceSessions();
  const hasOthers = sessions.some((session) => !session.current);

  const handleRevoke = useCallback(
    async (session: DeviceSession) => {
      const parsed = parseUserAgent(session.userAgent);
      const confirmed = await confirm({
        title: t('devices.revokeTitle'),
        message: t('devices.revokeMessage', {
          device: t('devices.browserOnSystem', {
            browser: parsed.browser ?? t('devices.unknownBrowser'),
            os: parsed.os ?? t('devices.unknownSystem'),
          }),
        }),
        confirmLabel: t('devices.signOut'),
        tone: 'danger',
      });
      if (!confirmed) return;
      const ok = await revoke(session.id);
      notify(t(ok ? 'devices.revoked' : 'devices.revokeFailed'), ok ? 'success' : 'error');
    },
    [confirm, notify, revoke, t],
  );

  const handleRevokeOthers = useCallback(async () => {
    const confirmed = await confirm({
      title: t('devices.revokeOthersTitle'),
      message: t('devices.revokeOthersMessage'),
      confirmLabel: t('devices.revokeOthers'),
      tone: 'danger',
    });
    if (!confirmed) return;
    const ok = await revokeOthers();
    notify(t(ok ? 'devices.revokedOthers' : 'devices.revokeFailed'), ok ? 'success' : 'error');
  }, [confirm, notify, revokeOthers, t]);

  return (
    <PageLayout>
      <PageHeader
        title={t('devices.title')}
        description={t('devices.description')}
        action={
          hasOthers ? (
            <ActionButton onClick={handleRevokeOthers} disabled={isRevokingOthers}>
              {isRevokingOthers ? t('devices.signingOut') : t('devices.revokeOthers')}
            </ActionButton>
          ) : undefined
        }
      />

      {isLoading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : loadError ? (
        <div className="space-y-3">
          <ErrorState message={t('devices.loadFailed')} />
          <button type="button" onClick={reload} className="text-sm text-violet-400 hover:text-violet-300 hover:underline">
            {t('common.tryAgain')}
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState message={t('devices.empty')} />
      ) : (
        <ul className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50">
          {sessions.map((session) => (
            <DeviceSessionRow
              key={session.id}
              session={session}
              isRevoking={revokingId === session.id}
              onRevoke={handleRevoke}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-neutral-500">{t('devices.help')}</p>
      <p className="mt-2 text-xs text-neutral-500">{t('devices.newDeviceNote')}</p>
    </PageLayout>
  );
}
