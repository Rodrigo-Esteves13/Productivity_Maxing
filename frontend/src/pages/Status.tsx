import PageLayout from '../components/Layout/PageLayout';
import StatusDot from '../components/UI/StatusDot';
import { RefreshIcon } from '../components/UI/Icons';
import useSeo from '../hooks/useSeo';
import useStatusPage from '../hooks/useStatusPage';
import { useI18n } from '../i18n/useI18n';
import { formatUptime, type OverallStatus, type CheckState } from '../lib/statusDerive';

const OVERALL_STYLE: Record<OverallStatus, { color: 'cyan' | 'amber' | 'red'; text: string }> = {
  ok: { color: 'cyan', text: 'text-cyan-300' },
  degraded: { color: 'amber', text: 'text-amber-300' },
  down: { color: 'red', text: 'text-red-300' },
};

const CHECK_COLOR: Record<CheckState, 'cyan' | 'red'> = { ok: 'cyan', fail: 'red' };

const CARD = 'rounded-xl border border-neutral-800 bg-neutral-900';

export default function Status() {
  const { t } = useI18n();
  const { snapshot, responseMs, lastChecked, isChecking, refresh } = useStatusPage();

  useSeo({
    title: t('status.title'),
    description: t('status.seoDescription'),
    path: '/status',
  });

  const uptime = snapshot?.uptimeSeconds != null ? formatUptime(snapshot.uptimeSeconds) : null;

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-semibold text-neutral-100">{t('status.title')}</h1>
          <button
            type="button"
            onClick={refresh}
            disabled={isChecking}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-violet-500 disabled:opacity-50"
          >
            <RefreshIcon size={14} className={isChecking ? 'animate-spin' : ''} />
            {t('status.refresh')}
          </button>
        </div>

        {!snapshot ? (
          <p className="text-neutral-400" role="status">{t('status.loading')}</p>
        ) : (
          <div className="space-y-4" aria-live="polite">
            <div className={`${CARD} p-5`}>
              <div className="flex items-center gap-3">
                <StatusDot color={OVERALL_STYLE[snapshot.overall].color} pulse={snapshot.overall === 'ok'} />
                <span className={`text-lg font-medium ${OVERALL_STYLE[snapshot.overall].text}`}>
                  {t(`status.overall.${snapshot.overall}`)}
                </span>
              </div>
              <p className="mt-2 text-sm text-neutral-400">{t(`status.overall.${snapshot.overall}.hint`)}</p>
            </div>

            {snapshot.checks.length === 0 ? (
              <p className="text-sm text-neutral-500">{t('status.noChecks')}</p>
            ) : (
              <ul className={`${CARD} divide-y divide-neutral-800`}>
                {snapshot.checks.map((check) => (
                  <li key={check.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-neutral-200">{t(`status.check.${check.id}`)}</span>
                    <span className="flex items-center gap-2 text-neutral-400">
                      <StatusDot color={CHECK_COLOR[check.state]} pulse={false} />
                      {t(`status.checkState.${check.state}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className={`${CARD} p-4`}>
                <dt className="text-neutral-500">{t('status.responseTime')}</dt>
                <dd className="mt-1 text-neutral-100">{responseMs != null ? t('status.ms', { ms: responseMs }) : '-'}</dd>
              </div>
              <div className={`${CARD} p-4`}>
                <dt className="text-neutral-500">{t('status.uptime')}</dt>
                <dd className="mt-1 text-neutral-100">
                  {uptime ? t('status.uptimeValue', { d: uptime.days, h: uptime.hours, m: uptime.minutes }) : '-'}
                </dd>
              </div>
              <div className={`${CARD} p-4`}>
                <dt className="text-neutral-500">{t('status.lastChecked')}</dt>
                <dd className="mt-1 text-neutral-100">{lastChecked ? lastChecked.toLocaleTimeString() : '-'}</dd>
              </div>
            </dl>
            <p className="text-xs text-neutral-500">{t('status.autoRefresh')}</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
