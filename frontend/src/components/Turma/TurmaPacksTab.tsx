import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import Select from '../UI/Select';
import FormError from '../UI/FormError';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { XIcon } from '../UI/Icons';
import ConfirmActionDialog from './ConfirmActionDialog';
import { shareTurmaPack, unshareTurmaPack } from '../../api/turmasService';
import { listTaskPacks } from '../../api/taskPackService';
import { useTurmaAction, useTurmaPacks } from '../../hooks/useTurmas';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import type { TurmaPack } from '../../types/models';

interface TurmaPacksTabProps {
  turmaId: string;
  isDelegado: boolean;
}

// Pacotes de tasks da turma: quem tem um pacote partilha-o aqui e os outros
// importam pelo fluxo normal (/packs/:code), com escolha de cadeira e o modo
// substituir. As atualizacoes do dono chegam como em qualquer pacote.
export default function TurmaPacksTab({ turmaId, isDelegado }: TurmaPacksTabProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, isLoading, error, reload } = useTurmaPacks(turmaId);
  const confirm = useConfirmAction(t('turma.actionError'));

  const requestUnshare = (pack: TurmaPack) =>
    confirm.request({
      title: t('turma.packs.unshare'),
      message: t('turma.packs.unshareConfirm', { name: pack.name }),
      confirmLabel: t('turma.packs.unshare'),
      tone: 'danger',
      run: async () => {
        await unshareTurmaPack(turmaId, pack.id);
        reload();
      },
    });

  return (
    <div className="space-y-4">
      <SharePackForm turmaId={turmaId} sharedPackIds={new Set((data ?? []).map((p) => p.packId))} onShared={reload} />
      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t('turma.packs.none')} />
      ) : (
        <ul className="space-y-2">
          {data.map((pack) => (
            <li
              key={pack.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{pack.name}</p>
                <p className="text-xs text-neutral-500">
                  {pack.ownerName ?? t('social.anonymous')} · {t('turma.packs.itemCount', { count: pack.itemCount })}
                </p>
              </div>
              <Link
                to={`/packs/${encodeURIComponent(pack.code)}`}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {t('turma.packs.open')}
              </Link>
              {(isDelegado || pack.sharedById === user?.id) && (
                <IconButton label={t('turma.packs.unshare')} tone="danger" onClick={() => requestUnshare(pack)}>
                  <XIcon className="h-4 w-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}

interface SharePackFormProps {
  turmaId: string;
  sharedPackIds: Set<string>;
  onShared: () => void;
}

// So os pacotes que o proprio criou (o backend tambem so aceita esses).
function SharePackForm({ turmaId, sharedPackIds, onShared }: SharePackFormProps) {
  const { t } = useI18n();
  const { data: myPacks } = useLoadOnce(listTaskPacks);
  const [packId, setPackId] = useState('');
  const share = useTurmaAction(shareTurmaPack, t('turma.actionError'));
  const available = (myPacks ?? []).filter((p) => !sharedPackIds.has(p.id));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((await share.execute(turmaId, packId)) === null) return;
    setPackId('');
    onShared();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
      {myPacks && myPacks.length === 0 ? (
        <p className="text-sm text-neutral-400">
          {t('turma.packs.noOwnPacks')}{' '}
          <Link to="/task-packs" className="text-violet-300 underline-offset-2 hover:underline">
            {t('turma.packs.createOne')}
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Select label={t('turma.packs.shareLabel')} value={packId} onChange={(e) => setPackId(e.target.value)}>
              <option value="">{t('turma.packs.pick')}</option>
              {available.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={!packId || share.isBusy}>
            {t('turma.subjects.share')}
          </Button>
        </div>
      )}
      <p className="text-xs text-neutral-500">{t('turma.packs.hint')}</p>
      {share.error && <FormError message={share.error} />}
    </form>
  );
}
