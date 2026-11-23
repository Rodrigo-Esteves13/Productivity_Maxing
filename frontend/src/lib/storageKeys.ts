// Chaves do localStorage num so sitio (F-52): evita colisoes e deixa ver o
// que a app guarda no browser. Acrescentar aqui ao tocar num hook novo.
export const STORAGE_KEYS = {
  examMode: 'pm-exam-mode',
  singleTaskMode: 'pm-single-task-mode',
  showArchivedTasks: 'pm-show-archived-tasks',
  gradeTargets: 'pm-grade-targets',
} as const;
