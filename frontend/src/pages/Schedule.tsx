import { useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import WeekGrid from '../components/Schedule/WeekGrid';
import ImportScheduleModal from '../components/Schedule/ImportScheduleModal';
import StudyPlanCard from '../components/Study/StudyPlanCard';
import { UploadIcon } from '../components/UI/Icons';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Schedule() {
  useDocumentTitle('Schedule');
  const [isImportOpen, setIsImportOpen] = useState(false);
  // Incrementado a cada import bem-sucedido - passado ao WeekGrid como
  // sinal para refazer o fetch da semana atual (ver comentário em
  // WeekGrid.tsx). O StudyPlanCard também depende de dados que podem ter
  // mudado (aulas novas), mas tem o seu próprio hook - mais simples
  // remontá-lo com uma key do que ligar outro canal de refresh.
  const [scheduleVersion, setScheduleVersion] = useState(0);

  return (
    <PageLayout>
      <PageHeader
        title="Schedule"
        description="Your class timetable, imported from the UMaia student portal, and a study plan built around it."
        action={
          <ActionButton
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2"
          >
            <UploadIcon />
            Import .ics
          </ActionButton>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeekGrid refreshKey={scheduleVersion} />
        </div>
        <div key={scheduleVersion}>
          <StudyPlanCard />
        </div>
      </div>

      <ImportScheduleModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={() => setScheduleVersion((v) => v + 1)}
      />
    </PageLayout>
  );
}
