import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import Select from '../UI/Select';
import FormError from '../UI/FormError';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import ColorDot from '../UI/ColorDot';
import { ChevronDownIcon, XIcon } from '../UI/Icons';
import ConfirmActionDialog from './ConfirmActionDialog';
import { getLinkedEntries, linkArea, unlinkArea } from '../../api/turmasService';
import { useTurmaAction, useTurmaLinkedAreas } from '../../hooks/useTurmas';
import { useNotebookAreas } from '../../hooks/useNotebookAreas';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { formatTaskDate } from '../../lib/timeFormat';
import { turmaLinkedEntryPath } from '../../lib/appLinks';
import { areaColorOf } from '../SharedWithMe/sharedWithMeLabels';
import type { TurmaLinkedArea } from '../../types/models';

interface TurmaSubjectsTabProps {
  turmaId: string;
  isDelegado: boolean;
}

// Cadeiras do caderno que os membros publicaram na turma (so leitura; as
// entradas privadas nunca aparecem).
export default function TurmaSubjectsTab({ turmaId, isDelegado }: TurmaSubjectsTabProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, isLoading, error, reload } = useTurmaLinkedAreas(turmaId);
  const confirm = useConfirmAction(t('turma.actionError'));

  return (
    <div className="space-y-4">
      <ShareSubjectForm
        turmaId={turmaId}
        sharedAreaIds={(data ?? []).filter((link) => link.userId === user?.id).map((link) => link.areaId)}
        onShared={reload}
      />
      {isLoading ? (
        <LinesSkeleton lines={4} />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t('turma.subjects.none')} />
      ) : (
        <ul className="space-y-2">
          {data.map((link) => (
            <LinkedSubject
              key={link.id}
              turmaId={turmaId}
              link={link}
              canUnlink={isDelegado || link.userId === user?.id}
              onUnlink={() =>
                confirm.request({
                  title: t('turma.subjects.unshare'),
                  message: t('turma.subjects.unshareConfirm', { name: link.areaName }),
                  confirmLabel: t('turma.subjects.unshare'),
                  tone: 'danger',
                  run: async () => {
                    await unlinkArea(turmaId, link.id);
                    reload();
                  },
                })
              }
            />
          ))}
        </ul>
      )}
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}

interface ShareSubjectFormProps {
  turmaId: string;
  /** Cadeiras minhas que ja estao partilhadas nesta turma. */
  sharedAreaIds: string[];
  onShared: () => void;
}

// Partilhar tudo de uma vez e o caminho principal (as entradas privadas
// ficam sempre escondidas); escolher uma a uma fica como alternativa.
function ShareSubjectForm({ turmaId, sharedAreaIds, onShared }: ShareSubjectFormProps) {
  const { t } = useI18n();
  const { areas } = useNotebookAreas();
  const [areaId, setAreaId] = useState('');
  const share = useTurmaAction(linkArea, t('turma.actionError'));
  const [isSharingAll, setIsSharingAll] = useState(false);
  const notShared = areas.filter((area) => !sharedAreaIds.includes(area.id));

  const shareAll = async () => {
    setIsSharingAll(true);
    for (const area of notShared) {
      if ((await share.execute(turmaId, area.id)) === null) break;
    }
    setIsSharingAll(false);
    onShared();
  };

  if (areas.length === 0) {
    return (
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm">
        <p className="text-neutral-200">{t('turma.subjects.noAreas')}</p>
        <Link to="/notebook" className="mt-2 inline-block font-medium text-violet-400 hover:text-violet-300">
          {t('turma.subjects.createArea')}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((await share.execute(turmaId, areaId)) === null) return;
    setAreaId('');
    onShared();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void shareAll()} disabled={notShared.length === 0 || isSharingAll}>
          {notShared.length === 0
            ? t('turma.subjects.allShared')
            : t('turma.subjects.shareAll', { count: notShared.length })}
        </Button>
        <p className="text-xs text-neutral-400">{t('turma.subjects.shareAllHint')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Select label={t('turma.subjects.shareLabel')} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">{t('turma.subjects.pick')}</option>
            {notShared.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary" disabled={!areaId || share.isBusy}>
          {t('turma.subjects.share')}
        </Button>
      </div>
      <p className="text-xs text-neutral-500">{t('turma.subjects.hint')}</p>
      {share.error && <FormError message={share.error} />}
    </form>
  );
}

interface LinkedSubjectProps {
  turmaId: string;
  link: TurmaLinkedArea;
  canUnlink: boolean;
  onUnlink: () => void;
}

function LinkedSubject({ turmaId, link, canUnlink, onUnlink }: LinkedSubjectProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="rounded-lg border border-neutral-800 bg-neutral-900/40">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          <ColorDot color={areaColorOf(link.areaColor)} size="xs" />
          <span className="min-w-0 truncate text-sm font-medium text-white">{link.areaName}</span>
          <span className="shrink-0 text-xs text-neutral-500">
            {link.ownerName ?? t('social.anonymous')} · {t('turma.subjects.entryCount', { count: link.entryCount })}
          </span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-500/40 px-2.5 py-0.5 text-xs font-medium text-violet-300">
            {isOpen ? t('turma.subjects.hideNotes') : t('turma.subjects.viewNotes')}
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {canUnlink && (
          <IconButton label={t('turma.subjects.unshare')} tone="danger" onClick={onUnlink}>
            <XIcon className="h-4 w-4" />
          </IconButton>
        )}
      </div>
      {isOpen && <LinkedEntries turmaId={turmaId} linkId={link.id} />}
    </li>
  );
}

function LinkedEntries({ turmaId, linkId }: { turmaId: string; linkId: string }) {
  const { t } = useI18n();
  const fetcher = useCallback(() => getLinkedEntries(turmaId, linkId), [turmaId, linkId]);
  const { data, isLoading, error } = useLoadOnce(fetcher);

  if (isLoading) return <LinesSkeleton lines={2} className="px-3 pb-3" />;
  if (error) return <p className="px-3 pb-3 text-xs text-red-400">{t('turma.loadError')}</p>;
  if (!data || data.length === 0) return <EmptyState message={t('turma.subjects.noEntries')} variant="inline" />;
  return (
    <ul className="space-y-1 border-t border-neutral-800 p-2">
      {data.map((entry) => (
        <li key={entry.id}>
          <Link
            to={turmaLinkedEntryPath(turmaId, linkId, entry.id)}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-800"
          >
            <span className="min-w-0 truncate text-neutral-200">{entry.title}</span>
            <span className="shrink-0 text-xs text-neutral-500">{formatTaskDate(entry.date)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
