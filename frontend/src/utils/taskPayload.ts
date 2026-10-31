import type { TaskFormFieldValues } from '../components/Tasks/TaskFormFields';
import type { TaskFormSubmission } from '../types/models';
import { DEFAULT_DATE_CERTAINTY, hasFirmDate } from '../lib/taskReadiness';
import type { DateCertainty } from '../types/models';

// TaskForm (criação) e TaskEditForm (edição) tinham a mesma conversão de
// formData -> payload da API copiada nos dois sítios (parse de números,
// campos vazios -> null, date -> ISO).
//
// Campos opcionais vazios vão como `null`, nunca `undefined`: o JSON.stringify
// deita fora o undefined e o PATCH do TaskEditForm tratava um campo esvaziado
// como "não mexer" (a nota real/peso antigos ficavam gravados). O backend
// trata null como "limpar" e, na criação, como "sem valor". Centralizado aqui para os dois deixarem de poder
// divergir sem querer - ex: se um dia se mudar como um número vazio é
// tratado, só há um sítio para corrigir.
//
// `includeRealGrade` existe porque só o TaskEditForm tem esse campo (uma
// task só ganha nota real depois de já existir); o TaskForm de criação
// nunca o envia.
export function buildTaskPayload(
  formData: TaskFormFieldValues,
  { includeRealGrade = false }: { includeRealGrade?: boolean } = {},
): TaskFormSubmission {
  // syncToCalendar e calendarTime são campos só de UI - o backend
  // (whitelist: true, forbidNonWhitelisted: true) rejeitaria o pedido se
  // fossem enviados como estão. calendarTime já foi absorvido no `date`
  // combinado abaixo; syncToCalendar é extraído à parte em
  // useTasksPage.ts (decide se se chama o endpoint de sync a seguir).
  // realGrade, progressStatus e os campos numéricos saem de `rest` porque
  // chegam como string e são convertidos abaixo.
  const {
    syncToCalendar,
    calendarTime,
    calendarDurationMinutes,
    realGrade,
    progressStatus,
    targetGrade,
    weightPercentage,
    estimatedMinutes,
    recalledStudyMinutes,
    topics,
    referenceLink,
    notes,
    academicType,
    effort,
    dateCertainty,
    availableFrom,
    submissionDate,
    ...rest
  } = formData;

  return {
    ...rest,
    syncToCalendar,
    date: buildTaskDate(formData.date, calendarTime),
    // Só faz sentido gravar duração quando há mesmo uma hora definida -
    // um evento dia inteiro não tem "fim" configurável, e mandar um
    // número aqui sem hora só poluiria a BD sem propósito nenhum.
    calendarDurationMinutes: calendarTime ? parseInt(calendarDurationMinutes, 10) : null,
    targetGrade: targetGrade ? parseFloat(targetGrade) : null,
    weightPercentage: weightPercentage ? parseFloat(weightPercentage) : null,
    estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
    recalledStudyMinutes: recalledStudyMinutes ? parseInt(recalledStudyMinutes, 10) : null,
    progressStatus: progressStatus || undefined,
    ...(includeRealGrade ? { realGrade: realGrade ? parseFloat(realGrade) : null } : {}),
    topics: topics || null,
    referenceLink: referenceLink || null,
    notes: notes || null,
    academicType: academicType || null,
    effort: (effort || null) as TaskFormSubmission['effort'],
    dateCertainty: (dateCertainty || DEFAULT_DATE_CERTAINTY) as TaskFormSubmission['dateCertainty'],
    // "YYYY-MM-DD" isolado = meia-noite UTC desse dia (mesma regra do `date`
    // sem hora, ver buildTaskDate). Vazio = ja disponivel.
    availableFrom: availableFrom ? new Date(availableFrom).toISOString() : null,
    // Uma data so tem sentido com prazo marcado; num palpite volta a uma fase.
    submissionDate:
      submissionDate && hasFirmDate({ dateCertainty: (dateCertainty || DEFAULT_DATE_CERTAINTY) as DateCertainty })
        ? new Date(submissionDate).toISOString()
        : null,
  };
}

// Sem hora (calendarTime vazio): mantém o comportamento antigo - parse do
// "YYYY-MM-DD" isolado, que o JS interpreta sempre como meia-noite UTC,
// independentemente do timezone do browser. É esse UTC-meia-noite exato
// que o CalendarService (backend) usa como sinal de "sem hora -> evento
// dia inteiro".
//
// Com hora (calendarTime "HH:MM"): construído a partir dos componentes
// locais (ano/mês/dia/hora/minuto), para o navegador aplicar o timezone
// real do utilizador (Europe/Lisbon, com DST correto) em vez de forçar
// UTC - assim a hora que a pessoa escreve é a hora que aparece no Google
// Calendar.
function buildTaskDate(dateStr: string, calendarTime: string): string {
  if (!calendarTime) {
    return new Date(dateStr).toISOString();
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = calendarTime.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}
