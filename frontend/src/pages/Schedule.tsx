import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import SegmentedControl, { type SegmentedOption } from '../components/UI/SegmentedControl';
import WeekGrid from '../components/Schedule/WeekGrid';
import AttendanceCard from '../components/Schedule/AttendanceCard';
import StudyVsClassCard from '../components/Schedule/StudyVsClassCard';
import MonthGrid from '../components/Schedule/MonthGrid';
import ImportScheduleModal from '../components/Schedule/ImportScheduleModal';
import StudyPlanCard from '../components/Study/StudyPlanCard';
import CommitmentsCard from '../components/Schedule/CommitmentsCard';
import ScheduleChangesCard from '../components/Schedule/ScheduleChangesCard';
import ScheduleSyncCard from '../components/Schedule/ScheduleSyncCard';
import CalendarFeedCard from '../components/Schedule/CalendarFeedCard';
import ClassFormModal from '../components/Schedule/ClassFormModal';
import type { ClassOccurrence } from '../types/models';
import { PlusIcon, UploadIcon } from '../components/UI/Icons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { SCHEDULE_VIEWS, isScheduleView, useScheduleView, type ScheduleView } from '../hooks/useScheduleView';
import { useScheduleTasks } from '../hooks/useScheduleTasks';
import { todayUtcAnchored } from '../lib/weekDates';
import * as bus from '../lib/bus';
import { useI18n } from '../i18n/useI18n';

// ?view=month (ou week) vem da paleta Ctrl+K.
const VIEW_PARAM = 'view';
// ?add=class (paleta Ctrl+K) abre o formulario de aula nova.
const ADD_PARAM = 'add';
const ADD_CLASS_VALUE = 'class';
const VIEW_LABEL_KEY: Record<ScheduleView, string> = {
  week: 'schedule.view.week',
  month: 'schedule.view.month',
};

export default function Schedule() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.schedule'));
  const [isImportOpen, setIsImportOpen] = useState(false);
  // undefined = fechado, null = aula nova, objeto = editar essa aula.
  const [classForm, setClassForm] = useState<ClassOccurrence | null | undefined>(undefined);
  const { view, setView } = useScheduleView();
  // Dia que a vista que abrir a seguir deve mostrar: hoje, ou o dia
  // clicado na vista mensal (abre essa semana).
  const [anchorDate, setAnchorDate] = useState(todayUtcAnchored);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get(VIEW_PARAM);

  useEffect(() => {
    if (!isScheduleView(viewParam)) return;
    setView(viewParam);
    // Tira o parametro para nao lutar com o botao Semana/Mes depois.
    setSearchParams(
      (params) => {
        params.delete(VIEW_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [viewParam, setView, setSearchParams]);

  const addClassRequested = searchParams.get(ADD_PARAM) === ADD_CLASS_VALUE;
  useEffect(() => {
    if (!addClassRequested) return;
    setClassForm(null);
    setSearchParams(
      (params) => {
        params.delete(ADD_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [addClassRequested, setSearchParams]);

  const openWeek = useCallback(
    (date: Date) => {
      setAnchorDate(date);
      setView('week');
    },
    [setView],
  );

  // Prazos das tasks para as duas vistas: alternar Semana/Mes nao repete o
  // pedido. So volta a tentar na troca de vista se tinha falhado.
  const scheduleTasks = useScheduleTasks();
  const changeView = (next: ScheduleView) => {
    if (scheduleTasks.error) scheduleTasks.reload();
    setView(next);
  };

  const viewOptions: SegmentedOption<ScheduleView>[] = SCHEDULE_VIEWS.map((value) => ({
    value,
    label: t(VIEW_LABEL_KEY[value]),
  }));
  const viewToggle = <SegmentedControl size="sm" options={viewOptions} value={view} onChange={changeView} />;
  // Incrementado a cada import ou mudanca de horario: a grelha e os cartoes
  // que dependem dele refazem o fetch (ver comentario em WeekGrid.tsx).
  const [scheduleVersion, setScheduleVersion] = useState(0);
  // Sobe a cada aula desmarcada (ou desfeita): a grelha ja mostra o
  // resultado, so os cartoes que contam horas de aulas refazem o fetch.
  const [cancellationVersion, setCancellationVersion] = useState(0);
  const classHoursVersion = scheduleVersion + cancellationVersion;
  // Sobe a cada presenca marcada na grelha (o resumo refaz o fetch).
  const [attendanceVersion, setAttendanceVersion] = useState(0);
  const handleAttendanceChanged = useCallback(() => setAttendanceVersion((v) => v + 1), []);

  // Qualquer mudança (turno, local, import): refaz a grelha e o plano E
  // pergunta se o Google Calendar deve ser atualizado (o modal só abre se
  // estiver ligado e houver diferenças).
  const handleScheduleChanged = useCallback(() => {
    setScheduleVersion((v) => v + 1);
    bus.emit('calendar:syncReview', { force: false });
  }, []);

  const handleCancellationChanged = useCallback(() => {
    setCancellationVersion((v) => v + 1);
    bus.emit('calendar:syncReview', { force: false });
  }, []);

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.schedule')}
        description={t('ui.yourClassTimetableImportedFrom')}
        action={
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setClassForm(null)} className="flex items-center gap-2">
              <PlusIcon aria-hidden="true" />
              {t('ux4sched.class.add')}
            </ActionButton>
            <ActionButton onClick={() => setIsImportOpen(true)} className="flex items-center gap-2">
              <UploadIcon />
              {t('ui.importIcs')}
            </ActionButton>
          </div>
        }
      />

      {/* A semana ocupa a largura toda: dentro de 2/3 da pagina cada dia
          ficava com ~100px e os nomes das cadeiras partiam letra a letra. */}
      <div className="space-y-6">
        {view === 'week' ? (
          <WeekGrid
            refreshKey={scheduleVersion}
            initialDate={anchorDate}
            viewToggle={viewToggle}
            onAttendanceChanged={handleAttendanceChanged}
            onScheduleChanged={handleScheduleChanged}
            onCancellationChanged={handleCancellationChanged}
            tasks={scheduleTasks.tasks}
            onEditClass={setClassForm}
          />
        ) : (
          <MonthGrid
            refreshKey={scheduleVersion}
            initialDate={anchorDate}
            viewToggle={viewToggle}
            onOpenWeek={openWeek}
            scheduleTasks={scheduleTasks}
          />
        )}
        {/* Duas colunas com pesos parecidos, para nenhuma acabar muito antes
            da outra: a esquerda (larga) tem o que se edita - plano de estudo
            e compromissos; a direita tem o que se consulta de relance -
            presencas, estudo vs aulas - e as ligacoes ao calendario, que sao
            configuracao (mexe-se uma vez). */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <StudyPlanCard refreshKey={classHoursVersion} />
            <CommitmentsCard onChanged={handleScheduleChanged} />
            <ScheduleChangesCard refreshKey={scheduleVersion} onChanged={handleScheduleChanged} />
          </div>
          <div className="space-y-6">
            <AttendanceCard refreshKey={scheduleVersion + attendanceVersion} />
            <StudyVsClassCard refreshKey={classHoursVersion} />
            <ScheduleSyncCard />
            <CalendarFeedCard />
          </div>
        </div>
      </div>

      {classForm !== undefined && (
        <ClassFormModal
          key={classForm?.id ?? 'new'}
          occurrence={classForm}
          onClose={() => setClassForm(undefined)}
          onChanged={handleScheduleChanged}
        />
      )}

      <ImportScheduleModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={handleScheduleChanged}
      />
    </PageLayout>
  );
}
