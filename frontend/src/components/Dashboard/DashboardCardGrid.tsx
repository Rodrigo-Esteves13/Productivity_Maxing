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
} from './lazyCards';
import type { DashboardWidgetKey } from '../../hooks/useDashboardWidgetPrefs';
import type { AcademicProgram, AcademicTaskTypeOption, Area, Task } from '../../types/models';

interface DashboardCardGridProps {
  academicTasks: Task[];
  academicAreas: Area[];
  academicTaskTypes: AcademicTaskTypeOption[];
  activeProgram: AcademicProgram | null;
  visibility: Record<DashboardWidgetKey, boolean>;
  // Ordem dos cartoes (ids do grid, sem repetidos).
  order: readonly DashboardWidgetKey[];
}

// Os cartoes de analise do Dashboard. Cada um decide sozinho (via
// visibility + dados) se aparece; o MasonryGrid trata de nao deixar buracos.
export default function DashboardCardGrid({
  academicTasks,
  academicAreas,
  academicTaskTypes,
  activeProgram,
  visibility,
  order,
}: DashboardCardGridProps) {
  // Cada cartao com a sua condicao de render (inalterada); a ordem so decide
  // a posicao. Falso/null nao ocupa lugar no MasonryGrid.
  const cards: Partial<Record<DashboardWidgetKey, ReactNode>> = {
    today: visibility.today && <TodayCard />,
    packUpdates: visibility.packUpdates && <PackUpdatesCard />,
    weeklyChallenge: visibility.weeklyChallenge && academicTasks.length > 0 && (
      <WeeklyChallengeCard tasks={academicTasks} />
    ),
    statusSummary: visibility.statusSummary && academicTasks.length > 0 && (
      <StatusSummaryCard tasks={academicTasks} areas={academicAreas} />
    ),
    moneySnapshot: visibility.moneySnapshot && <MoneySnapshotCard />,
    studyCapacity: visibility.studyCapacity && <StudyCapacityCard />,
    upcoming: academicTasks.length > 0 && visibility.upcoming && (
      <UpcomingTasksCard tasks={academicTasks} areas={academicAreas} />
    ),
    failingRisk: visibility.failingRisk && <FailingRiskCard />,
    ratingsSummary: visibility.ratingsSummary && <RatingsSummaryCard />,
    atRisk: academicTasks.length > 0 && visibility.atRisk && (
      <AtRiskTasksCard tasks={academicTasks} areas={academicAreas} />
    ),
    deadlineOverlap: academicTasks.length > 0 && visibility.deadlineOverlap && (
      <DeadlineOverlapCard tasks={academicTasks} areas={academicAreas} />
    ),
    areaBreakdown: academicAreas.length > 0 && activeProgram && visibility.areaBreakdown && (
      <AreaBreakdownCard
        tasks={academicTasks}
        areas={academicAreas}
        scale={activeProgram.gradeScale}
      />
    ),
    studyActivity: academicAreas.length > 0 && activeProgram && visibility.studyActivity && (
      <StudyActivityCard />
    ),
    examCountdown: visibility.examCountdown && academicTasks.length > 0 && (
      <ExamCountdownCard tasks={academicTasks} areas={academicAreas} />
    ),
    testGaps: visibility.testGaps && academicTasks.length > 0 && (
      <TestGapsCard tasks={academicTasks} areas={academicAreas} />
    ),
    staleTasks: visibility.staleTasks && academicTasks.length > 0 && (
      <StaleTasksCard tasks={academicTasks} areas={academicAreas} />
    ),
    timeByArea: visibility.timeByArea && <TimeByAreaCard />,
    courseForecast: visibility.courseForecast && <CourseForecastCard />,
    gradeProjection: visibility.gradeProjection && <GradeProjectionCard />,
    planScenario: visibility.planScenario && <PlanScenarioCard />,
    focusEffect: visibility.focusEffect && <FocusEffectCard />,
    estimationAccuracy: visibility.estimationAccuracy && <EstimationAccuracyCard />,
    deadlineCompliance: visibility.deadlineCompliance && academicTasks.length > 0 && (
      <DeadlineComplianceCard tasks={academicTasks} />
    ),
    weekdayLoad: visibility.weekdayLoad && academicTasks.length > 0 && (
      <WeekdayLoadCard tasks={academicTasks} />
    ),
    procrastinationWeekday: visibility.procrastinationWeekday && academicTasks.length > 0 && (
      <ProcrastinationWeekdayCard tasks={academicTasks} />
    ),
    targetVsReal: visibility.targetVsReal && academicTasks.length > 0 && activeProgram && (
      <TargetVsRealCard
        tasks={academicTasks}
        areas={academicAreas}
        scale={activeProgram.gradeScale}
      />
    ),
    productivityByType: visibility.productivityByType && academicTasks.length > 0 && (
      <ProductivityByTypeCard tasks={academicTasks} academicTaskTypes={academicTaskTypes} />
    ),
    difficultyVsGrade: visibility.difficultyVsGrade && academicTasks.length > 0 && activeProgram && (
      <DifficultyVsGradeCard tasks={academicTasks} scale={activeProgram.gradeScale} />
    ),
    weightVsGrade: visibility.weightVsGrade && academicTasks.length > 0 && activeProgram && (
      <WeightVsGradeCard tasks={academicTasks} scale={activeProgram.gradeScale} />
    ),
    areaConsistency: visibility.areaConsistency && academicTasks.length > 0 && activeProgram && (
      <AreaConsistencyCard
        tasks={academicTasks}
        areas={academicAreas}
        scale={activeProgram.gradeScale}
      />
    ),
    xpLevel: visibility.xpLevel && academicTasks.length > 0 && <XpLevelCard tasks={academicTasks} />,
  };

  return (
    <MasonryGrid className="mb-6">
      {order.map((key) => (
        <Fragment key={key}>{cards[key] || null}</Fragment>
      ))}
    </MasonryGrid>
  );
}
