import { Suspense, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import StaleRegion from '../components/UI/StaleRegion';
import GreetingBanner from '../components/Dashboard/GreetingBanner';
import DashboardToolbar from '../components/Dashboard/DashboardToolbar';
import DashboardOverview from '../components/Dashboard/DashboardOverview';
import DashboardTasksSection from '../components/Dashboard/DashboardTasksSection';
import SingleTaskView from '../components/Dashboard/SingleTaskView';
import { TaskImportModal } from '../components/Dashboard/lazyCards';
import { PlanModeContext } from '../context/plan-mode-context';
import { useDashboardPage } from '../hooks/useDashboardPage';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';

export default function Dashboard() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.dashboard'));
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const page = useDashboardPage();

  return (
    <PlanModeContext.Provider value={page.planModeValue}>
    <PageLayout>
      {!page.isLoading && !page.error && <GreetingBanner tasks={page.tasks} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={t('ui.analyticsDashboard')}
          description={t('ui.globalViewOfAllYour')}
        />
        <DashboardToolbar page={page} onImport={() => setIsImportModalOpen(true)} />
      </div>

      <StaleRegion isStale={page.isStale}>
        {page.isSingleTaskMode && !page.isLoading && !page.error ? (
          <SingleTaskView
            tasks={page.academicTasks}
            areas={page.academicAreas}
            onComplete={page.completeOne}
            onExit={() => page.setIsSingleTaskMode(false)}
          />
        ) : (
          <>
            <DashboardOverview page={page} />
            <DashboardTasksSection page={page} />
          </>
        )}
      </StaleRegion>

      {isImportModalOpen && (
        <Suspense fallback={null}>
          <TaskImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImported={page.refreshTasks}
          />
        </Suspense>
      )}
    </PageLayout>
    </PlanModeContext.Provider>
  );
}
