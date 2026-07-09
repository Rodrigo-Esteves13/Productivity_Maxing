import type { TaskTypeOption, AcademicTaskTypeOption } from '../types/models';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

interface UseTaskTypeLogicOptions {
  type: string;
  areaId: string;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
}

export interface UseTaskTypeLogicResult {
  isAcademic: boolean;
  availableAcademicTypes: AcademicTaskTypeOption[];
  selectedArea: AreaOption | undefined;
  isTypeLockedByArea: boolean;
  filteredAreas: AreaOption[];
}

/**
 * Deriva o estado de type/area do TaskForm:
 * - O tipo "académico" é identificado pela key estável, não pela label
 *   (a label pode ser editada pelo admin, a key não).
 * - Se a Area escolhida tiver um Type associado (ex: "CDR" -> Académico),
 *   o Type deixa de ser uma escolha manual, fica preenchido e trancado.
 *   Areas sem Type associado (ex: um hobby) continuam a pedir o Type à mão.
 * - filteredAreas: quando já há um Type escolhido, a lista de Areas
 *   mostrada só inclui Areas associadas a esse Type, mais as Areas sem
 *   Type fixo (hobbies), para não aparecerem Areas académicas quando o
 *   Type escolhido é, por exemplo, "Evento".
 */
export function useTaskTypeLogic({
  type,
  areaId,
  areas,
  taskTypes,
  academicTaskTypes,
}: UseTaskTypeLogicOptions): UseTaskTypeLogicResult {
  const selectedTaskType = taskTypes.find((t) => t.key === type);
  const isAcademic = selectedTaskType?.key === 'ACADEMICO';
  const availableAcademicTypes = academicTaskTypes.filter((a) => a.taskTypeKey === type);

  const selectedArea = areas.find((a) => a.id === areaId);
  const isTypeLockedByArea = Boolean(selectedArea?.defaultTaskType);

  const filteredAreas = type
    ? areas.filter((a) => !a.defaultTaskType || a.defaultTaskType === type)
    : areas;

  return { isAcademic, availableAcademicTypes, selectedArea, isTypeLockedByArea, filteredAreas };
}
