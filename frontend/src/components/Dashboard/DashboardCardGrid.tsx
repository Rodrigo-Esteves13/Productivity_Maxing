import MasonryGrid from '../UI/MasonryGrid';
import {
  UpcomingTasksCard,
  AtRiskTasksCard,
  DeadlineOverlapCard,
  AreaBreakdownCard,
  StudyActivityCard,
  StudyCapacityCard,
  CourseForecastCard,
  ExamCountdownCard,
  StaleTasksCard,
  TimeByAreaCard,
  EstimationAccuracyCard,
  DeadlineComplianceCard,
  WeekdayLoadCard,
  TargetVsRealCard,
  ProductivityByTypeCard,
} from './lazyCards';
import type { DashboardWidgetKey } from '../../hooks/useDashboardWidgetPrefs';
import type { AcademicProgram, AcademicTaskTypeOption, Area, Task } from '../../types/models';

interface DashboardCardGridProps {
  academicTasks: Task[];
  academicAreas: Area[];
  academicTaskTypes: AcademicTaskTypeOption[];
  activeProgram: AcademicProgram | null;
  visibility: Record<DashboardWidgetKey, boolean>;
}

// Os cartoes de analise do Dashboard. Cada um decide sozinho (via
// visibility + dados) se aparece; o MasonryGrid trata de nao deixar buracos.
export default function DashboardCardGrid({
  academicTasks,
  academicAreas,
  academicTaskTypes,
  activeProgram,
  visibility,
}: DashboardCardGridProps) {
  return (
    <MasonryGrid className="mb-6">
      {visibility.studyCapacity && <StudyCapacityCard />}
      {academicTasks.length > 0 && visibility.upcoming && (
        <UpcomingTasksCard tasks={academicTasks} areas={academicAreas} />
      )}
      {academicTasks.length > 0 && visibility.atRisk && (
        <AtRiskTasksCard tasks={academicTasks} areas={academicAreas} />
      )}
      {academicTasks.length > 0 && visibility.deadlineOverlap && (
        <DeadlineOverlapCard tasks={academicTasks} areas={academicAreas} />
      )}
      {academicAreas.length > 0 && activeProgram && visibility.areaBreakdown && (
        <AreaBreakdownCard
          tasks={academicTasks}
          areas={academicAreas}
          scale={activeProgram.gradeScale}
        />
      )}
      {academicAreas.length > 0 && activeProgram && visibility.studyActivity && (
        <StudyActivityCard />
      )}
      {visibility.examCountdown && academicTasks.length > 0 && (
        <ExamCountdownCard tasks={academicTasks} areas={academicAreas} />
      )}
      {visibility.staleTasks && academicTasks.length > 0 && (
        <StaleTasksCard tasks={academicTasks} areas={academicAreas} />
      )}
      {visibility.timeByArea && <TimeByAreaCard />}
    {visibility.courseForecast && <CourseForecastCard />}
      {visibility.estimationAccuracy && <EstimationAccuracyCard />}
      {visibility.deadlineCompliance && academicTasks.length > 0 && (
        <DeadlineComplianceCard tasks={academicTasks} />
      )}
      {visibility.weekdayLoad && academicTasks.length > 0 && (
        <WeekdayLoadCard tasks={academicTasks} />
      )}
      {visibility.targetVsReal && academicTasks.length > 0 && activeProgram && (
        <TargetVsRealCard
          tasks={academicTasks}
          areas={academicAreas}
          scale={activeProgram.gradeScale}
        />
      )}
      {visibility.productivityByType && academicTasks.length > 0 && (
        <ProductivityByTypeCard tasks={academicTasks} academicTaskTypes={academicTaskTypes} />
      )}
    </MasonryGrid>
  );
}
