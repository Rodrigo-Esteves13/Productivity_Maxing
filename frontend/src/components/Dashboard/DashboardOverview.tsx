import { Suspense } from 'react';
import GpaSummary from './GpaSummary';
import PeriodProgressBar from './PeriodProgressBar';
import OverloadAlertCard from './OverloadAlertCard';
import MissingGradeCard from './MissingGradeCard';
import OnboardingChecklist from './OnboardingChecklist';
import DashboardCardGrid from './DashboardCardGrid';
import ProgramsOverviewCard from './ProgramsOverviewCard';
import CreditsAccumulatedCard from './CreditsAccumulatedCard';
import PlanModeBanner from './PlanModeBanner';
import ExamModePanel from './ExamModePanel';
import { GradeNeededCalculator } from './lazyCards';
import InstallAppCard from '../../pwa/InstallAppCard';
import { DashboardDataContext } from '../../context/dashboard-data-context';
import type { DashboardPageState } from '../../hooks/useDashboardPage';

// Tudo o que fica por cima da tabela: avisos, resumo e cartoes de analise.
export default function DashboardOverview({ page }: { page: DashboardPageState }) {
  const {
    tasks, academicTasks, academicAreas, cardVisibility, activeProgram, activePeriod,
    isViewingAllPeriods, isExamMode, isPlanMode, isStale,
  } = page;
  const isReady = !page.isLoading && !page.error;

  return (
    <>
      <InstallAppCard />

      {isPlanMode && <PlanModeBanner onTurnOff={() => page.setIsPlanMode(false)} />}

      {isExamMode && isReady && (
        <ExamModePanel tasks={academicTasks} areas={academicAreas} onTurnOff={() => page.setIsExamMode(false)} />
      )}

      {!isExamMode && <GpaSummary showCreditSimulator={page.widgets.visibility.creditSimulator} />}

      {cardVisibility.creditsAccumulated && <CreditsAccumulatedCard />}

      {cardVisibility.programsOverview && <ProgramsOverviewCard />}

      {/* isStale: o periodo ja e o novo mas as tasks ainda nao. */}
      {cardVisibility.periodProgress && isReady && !isStale && !isViewingAllPeriods && activePeriod && (
        <PeriodProgressBar period={activePeriod} tasks={academicTasks} />
      )}

      {!isExamMode && isReady && <OnboardingChecklist taskCount={tasks.length} />}

      {cardVisibility.missingGrade && isReady && academicAreas.length > 0 && (
        <MissingGradeCard areas={academicAreas} />
      )}

      {cardVisibility.overloadAlert && isReady && academicTasks.length > 0 && (
        <OverloadAlertCard tasks={page.cardTasks} areas={academicAreas} />
      )}

      {/*
        Masonry em JS (MasonryGrid): cada cartão vai para a coluna mais
        curta e o último de cada coluna estica até ao fundo, por isso as
        duas colunas acabam sempre à mesma altura, tenha o Dashboard 3 ou
        14 cartões visíveis. Um cartão sem dados (renderiza null) não
        ocupa lugar. Com CSS multi-column isto não era possível: não há
        forma de esticar o último item de cada coluna.
      */}
      {isReady && (
        <DashboardDataContext.Provider value={page.cardData}>
          <DashboardCardGrid visibility={cardVisibility} order={page.widgetOrder.order} />
        </DashboardDataContext.Provider>
      )}

      {cardVisibility.gradeCalculator && isReady && academicAreas.length > 0 && activeProgram && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <GradeNeededCalculator
              tasks={academicTasks}
              areas={academicAreas}
              scale={activeProgram.gradeScale}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
