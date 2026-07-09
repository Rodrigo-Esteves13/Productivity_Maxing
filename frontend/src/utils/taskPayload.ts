import type { TaskFormFieldValues } from '../components/Tasks/TaskFormFields';

// TaskForm (criação) e TaskEditForm (edição) tinham a mesma conversão de
// formData -> payload da API copiada nos dois sítios (parse de números,
// campos vazios -> undefined para o backend não os gravar como string
// vazia, date -> ISO). Centralizado aqui para os dois deixarem de poder
// divergir sem querer - ex: se um dia se mudar como um número vazio é
// tratado, só há um sítio para corrigir.
//
// `includeRealGrade` existe porque só o TaskEditForm tem esse campo (uma
// task só ganha nota real depois de já existir); o TaskForm de criação
// nunca o envia.
export function buildTaskPayload(
  formData: TaskFormFieldValues,
  { includeRealGrade = false }: { includeRealGrade?: boolean } = {},
) {
  return {
    ...formData,
    date: new Date(formData.date).toISOString(),
    targetGrade: formData.targetGrade ? parseFloat(formData.targetGrade) : undefined,
    weightPercentage: formData.weightPercentage
      ? parseFloat(formData.weightPercentage)
      : undefined,
    ...(includeRealGrade
      ? { realGrade: formData.realGrade ? parseFloat(formData.realGrade) : undefined }
      : {}),
    topics: formData.topics || undefined,
    referenceLink: formData.referenceLink || undefined,
    academicType: formData.academicType || undefined,
  };
}
