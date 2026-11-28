import { useEffect, useState, type SyntheticEvent } from 'react';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import ErrorState from '../UI/ErrorState';
import ActionButton from '../UI/ActionButton';
import Button from '../UI/Button';
import SearchField from '../UI/SearchField';
import LinesSkeleton from '../UI/LinesSkeleton';
import type { BannedIpsState } from '../../hooks/useBannedIps';
import { useListSearch } from '../../hooks/useListSearch';
import { useI18n } from '../../i18n/useI18n';
import { useFeedback } from '../../context/useFeedback';
import Card from '../UI/Card';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import ConfirmActionDialog from '../Turma/ConfirmActionDialog';
import type { BannedIp } from '../../types/models';

interface BannedIpsCardProps {
  // Estado partilhado com a tabela de logs (uma so instancia, em Security.tsx).
  banned: BannedIpsState;
  // Preenchido pelo botao "Ban" numa linha da tabela de logs. Cada clique e um
  // objeto novo: o efeito corre outra vez mesmo com o mesmo IP, sem remontar o
  // cartao (remontar apagava o motivo que o admin ja tinha escrito).
  prefill: { ip: string };
}

export default function BannedIpsCard({ banned, prefill }: BannedIpsCardProps) {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  const { bannedIps, isLoading, error, isSubmitting, ban, unban, refetch } = banned;
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const confirmAction = useConfirmAction(t('confirmGuard.error'));
  const search = useListSearch(bannedIps, (b: BannedIp) => [
    b.ip,
    b.reason,
    b.bannedBy?.name,
    b.bannedBy?.email,
  ]);

  useEffect(() => {
    if (prefill.ip) setIp(prefill.ip);
  }, [prefill]);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = ip.trim();
    if (!target) return;
    confirmAction.request({
      title: t('confirmGuard.banIp.title'),
      message: t('confirmGuard.banIp.message', { ip: target }),
      confirmLabel: t('confirmGuard.banIp.confirm'),
      tone: 'danger',
      run: async () => {
        const success = await ban(target, reason.trim() || undefined);
        if (success) {
          setIp('');
          setReason('');
          notify(t('ux4admin.banned.banned', { ip: target }), 'success');
        }
      },
    });
  };

  const handleUnban = (entry: BannedIp) => {
    confirmAction.request({
      title: t('ux4admin.banned.unbanTitle'),
      message: t('ux4admin.banned.unbanMessage', { ip: entry.ip }),
      confirmLabel: t('ui.unban'),
      tone: 'danger',
      run: async () => {
        if (await unban(entry.id)) notify(t('ux4admin.banned.unbanned', { ip: entry.ip }), 'success');
      },
    });
  };

  const describeEntry = (entry: BannedIp): string => {
    const date = new Date(entry.createdAt).toLocaleDateString(lang, { dateStyle: 'medium' });
    const by = entry.bannedBy ? entry.bannedBy.name || entry.bannedBy.email : '';
    return by ? t('ux4admin.banned.onBy', { date, by }) : t('ux4admin.banned.on', { date });
  };

  const hasQuery = search.isFiltering;

  return (
    <Card className="mb-6">
      <h2 className="text-lg font-semibold text-white mb-1">{t('ui.bannedIps')}</h2>
      <p className="text-sm text-neutral-400 mb-4">
        {t('ui.aBannedIpGetsA')}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
        <FormField label={t('ui.ipAddress')} htmlFor="ban-ip" className="flex-1">
          <Input
            id="ban-ip"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="203.0.113.42"
            required
          />
        </FormField>
        <FormField label={t('ui.reasonOptional')} htmlFor="ban-reason" className="flex-1">
          <Input
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('ui.whyIsThisIpBeing')}
            maxLength={500}
          />
        </FormField>
        <div className="flex items-end">
          <ActionButton type="submit" color="amber" disabled={isSubmitting || !ip.trim()}>
            {isSubmitting ? t('ui.banning') : t('ui.banIp')}
          </ActionButton>
        </div>
      </form>

      {error && <div className="mb-4"><ErrorState message={error} onRetry={() => void refetch()} /></div>}

      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : bannedIps.length === 0 ? (
        !error && <p className="text-sm text-neutral-500">{t('ui.noIpsBannedRightNow')}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <SearchField
              value={search.query}
              onChange={search.setQuery}
              label={t('ux4admin.banned.search')}
            />
            {hasQuery && (
              <span className="text-xs text-neutral-500" aria-live="polite">
                {t('search.count', { shown: search.filtered.length, total: bannedIps.length })}
              </span>
            )}
          </div>
          {search.filtered.length === 0 ? (
            <p className="text-sm text-neutral-500">{t('search.noResultsFor', { query: search.query.trim() })}</p>
          ) : (
            <div className="space-y-2">
              {search.filtered.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 bg-neutral-800/60 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-neutral-200">{b.ip}</p>
                    <p className="text-xs text-neutral-500">{describeEntry(b)}</p>
                    {b.reason && (
                      <p className="text-xs text-neutral-500 truncate" title={b.reason}>
                        {b.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleUnban(b)}
                    className="w-auto px-3 py-1.5 text-xs shrink-0"
                  >
                    {t('ui.unban')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ConfirmActionDialog state={confirmAction} />
    </Card>
  );
}
