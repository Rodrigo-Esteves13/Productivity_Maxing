import { lazy } from 'react';

// Cartões do Dashboard carregados a pedido (React.lazy): cada um vira o seu
// próprio chunk, por isso o primeiro render da página já não descarrega o
// código de 15 cartões + o modal de import (que arrasta a biblioteca de
// folhas de cálculo) antes de mostrar o GPA e a tabela de tasks.
export const UpcomingTasksCard = lazy(() => import('./UpcomingTasksCard'));
export const AtRiskTasksCard = lazy(() => import('./AtRiskTasksCard'));
export const DeadlineOverlapCard = lazy(() => import('./DeadlineOverlapCard'));
export const AreaBreakdownCard = lazy(() => import('./AreaBreakdownCard'));
export const StudyActivityCard = lazy(() => import('./StudyActivityCard'));
export const StudyCapacityCard = lazy(() => import('./StudyCapacityCard'));
export const CourseForecastCard = lazy(() => import('./CourseForecastCard'));
export const ExamCountdownCard = lazy(() => import('./ExamCountdownCard'));
export const StaleTasksCard = lazy(() => import('./StaleTasksCard'));
export const TimeByAreaCard = lazy(() => import('./TimeByAreaCard'));
export const EstimationAccuracyCard = lazy(() => import('./EstimationAccuracyCard'));
export const DeadlineComplianceCard = lazy(() => import('./DeadlineComplianceCard'));
export const WeekdayLoadCard = lazy(() => import('./WeekdayLoadCard'));
export const TargetVsRealCard = lazy(() => import('./TargetVsRealCard'));
export const ProductivityByTypeCard = lazy(() => import('./ProductivityByTypeCard'));
export const GradeNeededCalculator = lazy(() => import('./GradeNeededCalculator'));
export const TaskImportModal = lazy(() => import('./TaskImportModal'));
