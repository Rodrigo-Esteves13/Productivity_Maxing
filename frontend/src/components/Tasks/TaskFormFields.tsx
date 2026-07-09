import type { TaskTypeOption, AcademicTaskTypeOption } from '../../types/models';
import { useTaskTypeLogic } from '../../hooks/useTaskTypeLogic';
import TitleDateAreaFields from './fields/TitleDateAreaFields';
import DifficultyTypeFields from './fields/DifficultyTypeFields';
import AcademicFields from './fields/AcademicFields';
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
}

interface TaskFormFieldsProps {
  idPrefix: string;
  values: TaskFormFieldValues;
  onChange: (field: keyof TaskFormFieldValues, value: string) => void;
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
      />

      {isAcademic && (
        <AcademicFields
          idPrefix={idPrefix}
          academicType={values.academicType}
          targetGrade={values.targetGrade}
          weightPercentage={values.weightPercentage}
          availableAcademicTypes={availableAcademicTypes}
          onAcademicTypeChange={(v) => onChange('academicType', v)}
          onTargetGradeChange={(v) => onChange('targetGrade', v)}
          onWeightPercentageChange={(v) => onChange('weightPercentage', v)}
        />
      )}

      <OptionalInfoFields
        topics={values.topics}
        referenceLink={values.referenceLink}
        onTopicsChange={(v) => onChange('topics', v)}
        onReferenceLinkChange={(v) => onChange('referenceLink', v)}
      />

      {(showProgressStatus || (showRealGrade && isAcademic)) && (
        <ProgressAndGradeFields
          idPrefix={idPrefix}
          progressStatus={values.progressStatus ?? ''}
          realGrade={values.realGrade ?? ''}
          progressStatuses={progressStatuses}
          showProgressStatus={showProgressStatus}
          showRealGrade={showRealGrade && isAcademic}
          onProgressStatusChange={(v) => onChange('progressStatus', v)}
          onRealGradeChange={(v) => onChange('realGrade', v)}
        />
      )}
    </>
  );
}
