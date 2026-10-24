import { MS_PER_MINUTE } from '../common/time.constants';

export interface ClassSlice {
  subject: string;
  startMinutes: number;
  endMinutes: number;
}

export interface StudySlice {
  areaId: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

export interface AreaLabel {
  id: string;
  name: string;
  colorHex: string;
}

export interface StudyVsClassRow {
  areaId: string;
  areaName: string;
  colorHex: string;
  classMinutes: number;
  studyMinutes: number;
  // Minutos de estudo por cada minuto de aula; null sem aulas dadas.
  ratio: number | null;
}

export interface StudyVsClassResult {
  rows: StudyVsClassRow[];
  // Disciplinas do horario sem cadeira ligada (AreaScheduleLink): as aulas
  // delas nao entram em nenhuma linha, o UI sugere liga-las.
  unlinkedSubjects: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Junta as aulas (via ligacao disciplina -> cadeira) e as sessoes de estudo
// terminadas por cadeira. Cadeiras sem aula nem estudo nao aparecem.
export function buildStudyVsClass(
  classes: ClassSlice[],
  sessions: StudySlice[],
  subjectToArea: Map<string, string>,
  areas: AreaLabel[],
): StudyVsClassResult {
  const classByArea = new Map<string, number>();
  const unlinked = new Set<string>();
  for (const c of classes) {
    const areaId = subjectToArea.get(c.subject);
    if (!areaId) {
      unlinked.add(c.subject);
      continue;
    }
    const minutes = Math.max(0, c.endMinutes - c.startMinutes);
    classByArea.set(areaId, (classByArea.get(areaId) ?? 0) + minutes);
  }

  const studyByArea = new Map<string, number>();
  for (const s of sessions) {
    if (!s.areaId || !s.endedAt) continue;
    const minutes = Math.max(
      0,
      (s.endedAt.getTime() - s.startedAt.getTime()) / MS_PER_MINUTE,
    );
    studyByArea.set(s.areaId, (studyByArea.get(s.areaId) ?? 0) + minutes);
  }

  const rows = areas
    .map((area): StudyVsClassRow => {
      const classMinutes = Math.round(classByArea.get(area.id) ?? 0);
      const studyMinutes = Math.round(studyByArea.get(area.id) ?? 0);
      return {
        areaId: area.id,
        areaName: area.name,
        colorHex: area.colorHex,
        classMinutes,
        studyMinutes,
        ratio: classMinutes > 0 ? round2(studyMinutes / classMinutes) : null,
      };
    })
    .filter((row) => row.classMinutes > 0 || row.studyMinutes > 0)
    .sort((a, b) => b.classMinutes - a.classMinutes);

  return { rows, unlinkedSubjects: [...unlinked].sort() };
}
