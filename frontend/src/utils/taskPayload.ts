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
  // syncToCalendar e calendarTime são campos só de UI - o backend
  // (whitelist: true, forbidNonWhitelisted: true) rejeitaria o pedido se
  // fossem enviados como estão. calendarTime já foi absorvido no `date`
  // combinado abaixo; syncToCalendar é extraído à parte em
  // useTasksPage.ts (decide se se chama o endpoint de sync a seguir).
  // calendarDurationMinutes, ao contrário, o backend conhece mesmo (é
  // persistido na Task), por isso fica em `rest` e segue no payload.
  const { syncToCalendar, calendarTime, ...rest } = formData;

  return {
    ...rest,
    syncToCalendar,
    date: buildTaskDate(formData.date, calendarTime),
    // Só faz sentido gravar duração quando há mesmo uma hora definida -
    // um evento dia inteiro não tem "fim" configurável, e mandar um
    // número aqui sem hora só poluiria a BD sem propósito nenhum.
    calendarDurationMinutes: calendarTime
      ? parseInt(formData.calendarDurationMinutes, 10)
      : undefined,
    targetGrade: formData.targetGrade ? parseFloat(formData.targetGrade) : undefined,
    weightPercentage: formData.weightPercentage
      ? parseFloat(formData.weightPercentage)
      : undefined,
    ...(includeRealGrade
      ? { realGrade: formData.realGrade ? parseFloat(formData.realGrade) : undefined }
      : {}),
    topics: formData.topics || undefined,
    referenceLink: formData.referenceLink || undefined,
    notes: formData.notes || undefined,
    academicType: formData.academicType || undefined,
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
