import { Fragment } from 'react';
import type { ReactNode } from 'react';
import MasonryGrid from '../UI/MasonryGrid';
import {
  TodayCard,
  UpcomingTasksCard,
  AtRiskTasksCard,
  DeadlineOverlapCard,
  AreaBreakdownCard,
  StudyActivityCard,
  StudyCapacityCard,
  CourseForecastCard,
  GradeProjectionCard,
  FocusEffectCard,
  ExamCountdownCard,
  TestGapsCard,
  StaleTasksCard,
  TimeByAreaCard,
  EstimationAccuracyCard,
  DeadlineComplianceCard,
  WeekdayLoadCard,
  ProcrastinationWeekdayCard,
  TargetVsRealCard,
  ProductivityByTypeCard,
  DifficultyVsGradeCard,
  WeightVsGradeCard,
  FailingRiskCard,
  PlanScenarioCard,
  RatingsSummaryCard,
  PackUpdatesCard,
  MoneySnapshotCard,
  WeeklyChallengeCard,
  StatusSummaryCard,
  AreaConsistencyCard,
  XpLevelCard,
  TypeBalanceCard,
  EctsWorkloadCard,
} from './lazyCards';
import type { DashboardWidgetKey } from '../../hooks/useDashboardWidgetPrefs';
import { useDashboardCardData } from '../../context/useDashboardCardData';

interface DashboardCardGridProps {
  visibility: Record<DashboardWidgetKey, boolean>;
  // Ordem dos cartoes (ids do grid, sem repetidos).
  order: readonly DashboardWidgetKey[];
}

// Os cartoes de analise do Dashboard. Cada um decide sozinho (via
// visibility + dados) se aparece; o MasonryGrid trata de nao deixar buracos.
// Os dados vem do DashboardDataContext, lido aqui para as condicoes e em cada
// cartao para o conteudo.
export default function DashboardCardGrid({ visibility, order }: DashboardCardGridProps) {
  const { academicTasks, allTasks, academicAreas, gradeScale } = useDashboardCardData();
  const hasScale = gradeScale !== '';

  // Cada cartao com a sua condicao de render (inalterada); a ordem so decide
  // a posicao. Falso/null nao ocupa lugar no MasonryGrid.
  const cards: Partial<Record<DashboardWidgetKey, ReactNode>> = {
    today: visibility.today && <TodayCard />,
    packUpdates: visibility.packUpdates && <PackUpdatesCard />,
    weeklyChallenge: visibility.weeklyChallenge && academicTasks.length > 0 && <WeeklyChallengeCard />,
    statusSummary: visibility.statusSummary && academicTasks.length > 0 && <StatusSummaryCard />,
    moneySnapshot: visibility.moneySnapshot && <MoneySnapshotCard />,
    studyCapacity: visibility.studyCapacity && <StudyCapacityCard />,
    upcoming: academicTasks.length > 0 && visibility.upcoming && <UpcomingTasksCard />,
    failingRisk: visibility.failingRisk && <FailingRiskCard />,
    ratingsSummary: visibility.ratingsSummary && <RatingsSummaryCard />,
    atRisk: academicTasks.length > 0 && visibility.atRisk && <AtRiskTasksCard />,
    deadlineOverlap: academicTasks.length > 0 && visibility.deadlineOverlap && <DeadlineOverlapCard />,
    areaBreakdown: academicAreas.length > 0 && hasScale && visibility.areaBreakdown && <AreaBreakdownCard />,
    studyActivity: academicAreas.length > 0 && hasScale && visibility.studyActivity && <StudyActivityCard />,
    examCountdown: visibility.examCountdown && academicTasks.length > 0 && <ExamCountdownCard />,
    testGaps: visibility.testGaps && academicTasks.length > 0 && <TestGapsCard />,
    staleTasks: visibility.staleTasks && academicTasks.length > 0 && <StaleTasksCard />,
    timeByArea: visibility.timeByArea && <TimeByAreaCard />,
    courseForecast: visibility.courseForecast && <CourseForecastCard />,
    gradeProjection: visibility.gradeProjection && <GradeProjectionCard />,
    planScenario: visibility.planScenario && <PlanScenarioCard />,
    focusEffect: visibility.focusEffect && <FocusEffectCard />,
    estimationAccuracy: visibility.estimationAccuracy && <EstimationAccuracyCard />,
    deadlineCompliance: visibility.deadlineCompliance && academicTasks.length > 0 && <DeadlineComplianceCard />,
    weekdayLoad: visibility.weekdayLoad && academicTasks.length > 0 && <WeekdayLoadCard />,
    procrastinationWeekday: visibility.procrastinationWeekday && academicTasks.length > 0 && <ProcrastinationWeekdayCard />,
    targetVsReal: visibility.targetVsReal && academicTasks.length > 0 && hasScale && <TargetVsRealCard />,
    productivityByType: visibility.productivityByType && academicTasks.length > 0 && <ProductivityByTypeCard />,
    difficultyVsGrade: visibility.difficultyVsGrade && academicTasks.length > 0 && hasScale && <DifficultyVsGradeCard />,
    weightVsGrade: visibility.weightVsGrade && academicTasks.length > 0 && hasScale && <WeightVsGradeCard />,
    areaConsistency: visibility.areaConsistency && academicTasks.length > 0 && hasScale && <AreaConsistencyCard />,
    xpLevel: visibility.xpLevel && academicTasks.length > 0 && <XpLevelCard />,
    typeBalance: visibility.typeBalance && allTasks.length > 0 && <TypeBalanceCard />,
    ectsWorkload: visibility.ectsWorkload && <EctsWorkloadCard />,
  };

  return (
    <MasonryGrid className="mb-6">
      {order.map((key) => (
        <Fragment key={key}>{cards[key] || null}</Fragment>
      ))}
    </MasonryGrid>
  );
}
