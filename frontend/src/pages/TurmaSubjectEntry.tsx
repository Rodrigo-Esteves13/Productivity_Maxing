import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import DocumentSkeleton from '../components/UI/DocumentSkeleton';
import ErrorState from '../components/UI/ErrorState';
import { SharedNotebookEntryView } from './SharedNotebookEntry';
import { getLinkedEntry } from '../api/turmasService';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useLoadOnce } from '../hooks/useLoadOnce';
import { useTurmaDetail } from '../hooks/useTurmas';
import { useI18n } from '../i18n/useI18n';
import { TURMAS_PATH, turmaPath } from '../lib/appLinks';

// Entrada do caderno de um colega, de uma cadeira publicada na turma. So
// leitura, com a mesma vista das notas partilhadas por amigos.
export default function TurmaSubjectEntry() {
  const { t } = useI18n();
  const { turmaId = '', linkId = '', entryId = '' } = useParams<{ turmaId: string; linkId: string; entryId: string }>();
  const { data: turma } = useTurmaDetail(turmaId);
  const fetcher = useCallback(() => getLinkedEntry(turmaId, linkId, entryId), [turmaId, linkId, entryId]);
  const { data, isLoading, error } = useLoadOnce(fetcher);
  useDocumentTitle(data?.entry.title ?? t('turma.tab.subjects'));

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs
          items={[
            { label: t('nav.turmas'), to: TURMAS_PATH },
            { label: turma?.name ?? '', to: turmaPath(turmaId) },
            { label: t('turma.tab.subjects'), to: `${turmaPath(turmaId)}?tab=subjects` },
            { label: data?.entry.title ?? '' },
          ]}
        />
        {data?.ownerName && <p className="mb-2 text-xs text-neutral-500">{t('turma.subjects.by', { name: data.ownerName })}</p>}
      </div>
      {isLoading ? (
        <DocumentSkeleton />
      ) : error || !data ? (
        <ErrorState message={t('turma.subjects.entryNotFound')} />
      ) : (
        <SharedNotebookEntryView entry={data.entry} token="" role="VIEWER" hasPendingProposal={false} onChanged={() => undefined} />
      )}
    </PageLayout>
  );
}
