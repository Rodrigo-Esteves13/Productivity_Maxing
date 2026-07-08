import type { Task } from '../types/models';

// "Project" não é uma Area, é um TaskType como outro qualquer (ex: "PROJETO"),
// configurável pelo admin em /admin/task-types. Como a key exata é dinâmica,
// identificamos aqui por key/label que contenha "proj". Se o teu TaskType de
// projeto tiver uma key diferente (ex: "TRABALHO_FINAL"), troca este regex.
export const PROJECT_TYPE_PATTERN = /proj/i;

// Chave de dia em fuso horário LOCAL (não UTC). "toISOString()" converte
// para UTC antes de cortar a data, o que dá o dia errado sempre que a hora
// local estiver perto da meia-noite e o fuso não for UTC+0 (ex: 00:30 em
// Lisboa/Porto no horário de verão vira "ontem" em UTC). Isto causava
// streaks a partir ou a quebrar sozinhas perto da meia-noite.
export function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ProfileStats {
  completed: number;
  active: number;
  projects: number;
  streak: number;
}

export function computeProfileStats(tasks: Task[], projectTypeKeys: Set<string>): ProfileStats {
  const completedTasks = tasks.filter((t) => t.progressStatus === 'COMPLETED');
  const completed = completedTasks.length;
  const active = tasks.length - completed;
  const projects = tasks.filter((t) => projectTypeKeys.has(t.type)).length;

  // Agora o backend guarda "completedAt" (o momento real em que a task
  // passou a COMPLETED), por isso o streak deixa de depender da "date"
  // (que é só o prazo/alvo). Tasks antigas, concluídas antes desta
  // funcionalidade existir, não têm "completedAt", para essas continuamos
  // a usar a "date" como fallback, para não fazer a streak desaparecer.
  const doneDayKeys = new Set(
    completedTasks.map((t) => toLocalDayKey(new Date(t.completedAt ?? t.date)))
  );
  let streak = 0;
  const cursor = new Date();
  const todayKey = toLocalDayKey(cursor);

  // Se ainda não completaste nada hoje, isso não deve "zerar" a streak,
  // um streak normal só quebra quando um dia inteiro passa sem atividade.
  // Por isso só começamos a contar a partir de hoje se hoje já tiver algo;
  // caso contrário começamos em ontem, e o streak de dias anteriores
  // mantém-se visível até à meia-noite.
  if (!doneDayKeys.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = toLocalDayKey(cursor);
    if (doneDayKeys.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return { completed, active, projects, streak };
}

export function extractProjectTypeKeys(taskTypes: { key: string; label: string }[]): Set<string> {
  return new Set(
    taskTypes
      .filter((t) => PROJECT_TYPE_PATTERN.test(t.key) || PROJECT_TYPE_PATTERN.test(t.label))
      .map((t) => t.key)
  );
}
