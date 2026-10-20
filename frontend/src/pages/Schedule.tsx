import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import SegmentedControl, { type SegmentedOption } from '../components/UI/SegmentedControl';
import WeekGrid from '../components/Schedule/WeekGrid';
import AttendanceCard from '../components/Schedule/AttendanceCard';
import MonthGrid from '../components/Schedule/MonthGrid';
import ImportScheduleModal from '../components/Schedule/ImportScheduleModal';
import StudyPlanCard from '../components/Study/StudyPlanCard';
import CommitmentsCard from '../components/Schedule/CommitmentsCard';
import ScheduleSyncCard from '../components/Schedule/ScheduleSyncCard';
import CalendarFeedCard from '../components/Schedule/CalendarFeedCard';
import { UploadIcon } from '../components/UI/Icons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { SCHEDULE_VIEWS, isScheduleView, useScheduleView, type ScheduleView } from '../hooks/useScheduleView';
import { todayUtcAnchored } from '../lib/weekDates';
import { requestCalendarSyncReview } from '../lib/calendarSyncEvents';
import { useI18n } from '../i18n/useI18n';

// ?view=month (ou week) vem da paleta Ctrl+K.
const VIEW_PARAM = 'view';
const VIEW_LABEL_KEY: Record<ScheduleView, string> = {
  week: 'schedule.view.week',
  month: 'schedule.view.month',
};

export default function Schedule() {
  const { t } = useI18n();
  useDocumentTitle('Schedule');
  const [isImportOpen, setIsImportOpen] = useState(false);
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

  const openWeek = useCallback(
    (date: Date) => {
      setAnchorDate(date);
      setView('week');
    },
    [setView],
  );

  const viewOptions: SegmentedOption<ScheduleView>[] = SCHEDULE_VIEWS.map((value) => ({
    value,
    label: t(VIEW_LABEL_KEY[value]),
  }));
  const viewToggle = <SegmentedControl size="sm" options={viewOptions} value={view} onChange={setView} />;
  // Incrementado a cada import bem-sucedido - passado ao WeekGrid como
  // sinal para refazer o fetch da semana atual (ver comentário em
  // WeekGrid.tsx). O StudyPlanCard também depende de dados que podem ter
  // mudado (aulas novas), mas tem o seu próprio hook - mais simples
  // remontá-lo com uma key do que ligar outro canal de refresh.
  const [scheduleVersion, setScheduleVersion] = useState(0);
  // Sobe a cada presenca marcada na grelha (o resumo refaz o fetch).
  const [attendanceVersion, setAttendanceVersion] = useState(0);
  const handleAttendanceChanged = useCallback(() => setAttendanceVersion((v) => v + 1), []);

  // Qualquer mudança (turno, local, import): refaz a grelha e o plano E
  // pergunta se o Google Calendar deve ser atualizado (o modal só abre se
  // estiver ligado e houver diferenças).
  const handleScheduleChanged = useCallback(() => {
    setScheduleVersion((v) => v + 1);
    requestCalendarSyncReview();
  }, []);

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.schedule')}
        description={t('ui.yourClassTimetableImportedFrom')}
        action={
          <ActionButton
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2"
          >
            <UploadIcon />
            {t('ui.importIcs')}
          </ActionButton>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {view === 'week' ? (
            <WeekGrid
              refreshKey={scheduleVersion}
              initialDate={anchorDate}
              viewToggle={viewToggle}
              onAttendanceChanged={handleAttendanceChanged}
            />
          ) : (
            <MonthGrid
              refreshKey={scheduleVersion}
              initialDate={anchorDate}
              viewToggle={viewToggle}
              onOpenWeek={openWeek}
            />
          )}
          <CommitmentsCard onChanged={handleScheduleChanged} />
          {/* Ligacoes ao calendario lado a lado: sao configuracao (mexe-se
              uma vez) e empilhadas ocupavam mais que a propria semana. */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ScheduleSyncCard />
            <CalendarFeedCard />
          </div>
        </div>
        <div>
          <div key={scheduleVersion}>
            <StudyPlanCard />
          </div>
          <AttendanceCard refreshKey={scheduleVersion + attendanceVersion} />
        </div>
      </div>

      <ImportScheduleModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={handleScheduleChanged}
      />
    </PageLayout>
  );
}
