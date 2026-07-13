import type { TaskTypeOption, AcademicTaskTypeOption } from '../../types/models';
import { useTaskTypeLogic } from '../../hooks/useTaskTypeLogic';
import { useCalendarStatus } from '../../hooks/useCalendarStatus';
import TitleDateAreaFields from './fields/TitleDateAreaFields';
import DifficultyTypeFields from './fields/DifficultyTypeFields';
import AcademicFields from './fields/AcademicFields';
import GradingFields from './fields/GradingFields';
import OptionalInfoFields from './fields/OptionalInfoFields';
import ProgressAndGradeFields from './fields/ProgressAndGradeFields';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

export interface TaskFormFieldValues {
  title: string;
  date: string;
  type: string;
  academicType: string;
  difficulty: string;
  areaId: string;
  topics: string;
  referenceLink: string;
  targetGrade: string;
  weightPercentage: string;
  realGrade?: string;
  progressStatus?: string;
  // Flags só de UI - nunca são enviadas como estão para os endpoints de
  // Task (o backend não as conhece; forbidNonWhitelisted rejeitaria). São
  // extraídas/absorvidas em buildTaskPayload/useTasksPage.ts antes de
  // chamar createTask/updateTask.
  syncToCalendar: boolean;
  // "HH:MM" ou "" (sem hora -> evento dia inteiro). Só tem efeito quando
  // syncToCalendar está marcado.
  calendarTime: string;
  // Minutos, como string (para caber num <select>). Só tem efeito quando
  // calendarTime está preenchido - eventos dia inteiro não usam isto.
  calendarDurationMinutes: string;
}

interface TaskFormFieldsProps {
  idPrefix: string;
  values: TaskFormFieldValues;
  onChange: (field: keyof TaskFormFieldValues, value: string | boolean) => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  progressStatuses?: string[];
  showRealGrade?: boolean;
  showProgressStatus?: boolean;
}

export default function TaskFormFields({
  idPrefix,
  values,
  onChange,
  areas,
  taskTypes,
  academicTaskTypes,
  difficulties,
  progressStatuses = [],
  showRealGrade = false,
  showProgressStatus = false,
}: TaskFormFieldsProps) {
  const { isAcademic, availableAcademicTypes, selectedArea, isTypeLockedByArea, filteredAreas } =
    useTaskTypeLogic({
      type: values.type,
      areaId: values.areaId,
      areas,
      taskTypes,
      academicTaskTypes,
    });

  // null enquanto carrega - tratado como "não conectado" para o checkbox
  // não aparecer disponível antes de sabermos ao certo.
  const calendarConnected = useCalendarStatus() === true;

  return (
    <>
      <TitleDateAreaFields
        idPrefix={idPrefix}
        title={values.title}
        date={values.date}
        areaId={values.areaId}
        areas={filteredAreas}
        onTitleChange={(v) => onChange('title', v)}
        onDateChange={(v) => onChange('date', v)}
        onAreaChange={(areaId, defaultTaskType) => {
          onChange('areaId', areaId);
          if (defaultTaskType) {
            // Area com tipo associado (ex: "CDR" -> Académico): o Type
            // passa a ser automático, não uma escolha manual.
            onChange('type', defaultTaskType);
            onChange('academicType', '');
          }
        }}
      />

      <DifficultyTypeFields
        idPrefix={idPrefix}
        difficulty={values.difficulty}
        type={values.type}
        difficulties={difficulties}
        taskTypes={taskTypes}
        isTypeLockedByArea={isTypeLockedByArea}
        lockedByAreaName={selectedArea?.name}
        onDifficultyChange={(v) => onChange('difficulty', v)}
        onTypeChange={(v) => {
          onChange('type', v);
          // Muda-se o tipo, limpa-se o academicType para não ficar
          // um valor "orfão" que já não pertence ao novo tipo.
          onChange('academicType', '');
        }}
        // Só limpa a Area - nunca o Type. Uma Area com defaultTaskType
        // define esse Type por definição de dados; permitir Type
        // diferente com a mesma Area ainda selecionada seria uma
        // combinação inválida. Sem Area, o Type deixa de estar
        // trancado (useTaskTypeLogic) e fica livre para escolher outra
        // Area compatível, ou nenhuma.
        onClearArea={isTypeLockedByArea ? () => onChange('areaId', '') : undefined}
      />

      {isAcademic && (
        <AcademicFields
          idPrefix={idPrefix}
          academicType={values.academicType}
          availableAcademicTypes={availableAcademicTypes}
          onAcademicTypeChange={(v) => onChange('academicType', v)}
        />
      )}

      <GradingFields
        idPrefix={idPrefix}
        targetGrade={values.targetGrade}
        weightPercentage={values.weightPercentage}
        onTargetGradeChange={(v) => onChange('targetGrade', v)}
        onWeightPercentageChange={(v) => onChange('weightPercentage', v)}
      />

      <OptionalInfoFields
        topics={values.topics}
        referenceLink={values.referenceLink}
        onTopicsChange={(v) => onChange('topics', v)}
        onReferenceLinkChange={(v) => onChange('referenceLink', v)}
        calendarConnected={calendarConnected}
        syncToCalendar={values.syncToCalendar}
        onSyncToCalendarChange={(v) => onChange('syncToCalendar', v)}
        calendarTime={values.calendarTime}
        onCalendarTimeChange={(v) => onChange('calendarTime', v)}
        calendarDurationMinutes={values.calendarDurationMinutes}
        onCalendarDurationMinutesChange={(v) => onChange('calendarDurationMinutes', v)}
      />

      {(showProgressStatus || showRealGrade) && (
        <ProgressAndGradeFields
          idPrefix={idPrefix}
          progressStatus={values.progressStatus ?? ''}
          realGrade={values.realGrade ?? ''}
          progressStatuses={progressStatuses}
          showProgressStatus={showProgressStatus}
          showRealGrade={showRealGrade}
          onProgressStatusChange={(v) => onChange('progressStatus', v)}
          onRealGradeChange={(v) => onChange('realGrade', v)}
        />
      )}
    </>
  );
}
