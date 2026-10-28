import { useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import TabBar from '../components/UI/TabBar';
import ErrorState from '../components/UI/ErrorState';
import PageHeaderSkeleton from '../components/UI/PageHeaderSkeleton';
import TurmaRoleBadge from '../components/Turma/TurmaRoleBadge';
import TurmaAnnouncementsTab from '../components/Turma/TurmaAnnouncementsTab';
import TurmaNotesTab from '../components/Turma/TurmaNotesTab';
import TurmaFilesTab from '../components/Turma/TurmaFilesTab';
import TurmaSubjectsTab from '../components/Turma/TurmaSubjectsTab';
import TurmaMembersTab from '../components/Turma/TurmaMembersTab';
import TurmaPacksTab from '../components/Turma/TurmaPacksTab';
import TurmaScheduleTab from '../components/Turma/TurmaScheduleTab';
import TurmaProgramsTab from '../components/Turma/TurmaProgramsTab';
import { TURMA_TABS, TURMA_TAB_LABEL_KEY, isTurmaTab, type TurmaTab } from '../components/Turma/turmaConfig';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTurmaDetail } from '../hooks/useTurmas';
import { useI18n } from '../i18n/useI18n';
import { TURMAS_PATH } from '../lib/appLinks';

const TAB_PARAM = 'tab';
const DEFAULT_TAB: TurmaTab = 'announcements';

// Uma turma: avisos, notas, ficheiros, cadeiras partilhadas e membros.
// O separador vive no URL (?tab=) para os links e o botao Voltar.
export default function TurmaPage() {
  const { t } = useI18n();
  const { turmaId = '' } = useParams<{ turmaId: string }>();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get(TAB_PARAM);
  const tab: TurmaTab = isTurmaTab(tabParam) ? tabParam : DEFAULT_TAB;
  const { data: turma, isLoading, error, reload } = useTurmaDetail(turmaId);
  useDocumentTitle(turma?.name ?? t('nav.turmas'));

  const setTab = (next: TurmaTab) => setParams({ [TAB_PARAM]: next }, { replace: true });

  return (
    <PageLayout>
      <Breadcrumbs items={[{ label: t('nav.turmas'), to: TURMAS_PATH }, { label: turma?.name ?? '' }]} />
      {isLoading ? (
        <PageHeaderSkeleton />
      ) : error || !turma ? (
        <ErrorState message={t('turma.notFound')} />
      ) : (
        <>
          <PageHeader
            title={turma.name}
            description={turma.description ?? undefined}
            action={<TurmaRoleBadge role={turma.myRole} />}
          />
          <TabBar
            items={TURMA_TABS.map((value) => ({ value, label: t(TURMA_TAB_LABEL_KEY[value]) }))}
            value={tab}
            onChange={setTab}
            label={t('turma.tabsLabel')}
            className="mb-4"
          />
          {tab === 'announcements' && <TurmaAnnouncementsTab turmaId={turma.id} isDelegado={turma.myRole === 'DELEGADO'} />}
          {tab === 'programs' && <TurmaProgramsTab turmaId={turma.id} isDelegado={turma.myRole === 'DELEGADO'} />}
          {tab === 'schedule' && <TurmaScheduleTab turmaId={turma.id} />}
          {tab === 'packs' && <TurmaPacksTab turmaId={turma.id} isDelegado={turma.myRole === 'DELEGADO'} />}
          {tab === 'notes' && <TurmaNotesTab turmaId={turma.id} canEdit={turma.canEditNotes} />}
          {tab === 'files' && <TurmaFilesTab turmaId={turma.id} isDelegado={turma.myRole === 'DELEGADO'} />}
          {tab === 'subjects' && <TurmaSubjectsTab turmaId={turma.id} isDelegado={turma.myRole === 'DELEGADO'} />}
          {tab === 'members' && <TurmaMembersTab key={turma.name} turma={turma} onChanged={reload} />}
        </>
      )}
    </PageLayout>
  );
}
