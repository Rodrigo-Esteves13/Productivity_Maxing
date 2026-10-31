// Contrato partilhado de N48 (avaliacao pessoal de docente e cadeira e
// estatistica). Formas fixas: backend e frontend dependem delas.
//
// Rotas (JWT, tudo filtrado por userId):
//   GET    /area-ratings                 -> AreaRating[]
//   GET    /area-ratings/stats?periodId= -> RatingStats  (literal, antes de :areaId)
//   PUT    /area-ratings/:areaId         body { teacherRating?, courseLiking? } (1-5 ou null)
//   DELETE /area-ratings/:areaId         -> 204

export interface AreaRating {
  areaId: string;
  /** 1-5, null = sem avaliacao. */
  teacherRating: number | null;
  courseLiking: number | null;
}

export interface RatingCourseRow {
  areaId: string;
  areaName: string;
  colorHex: string;
  teacherName: string | null;
  teacherRating: number | null;
  courseLiking: number | null;
  /** Media do focoRating (1-5) das sessoes da cadeira, null sem sessoes avaliadas. */
  avgFocus: number | null;
  studiedMinutes: number;
  /** Nota final media da cadeira normalizada 0-1, null sem notas. */
  gradeFraction: number | null;
}

/** Gostar = avaliacao >= 4, nao gostar = <= 2 (3 e neutro e fica de fora). */
export interface RatingQuadrants {
  likedGradeHigh: number;
  likedGradeLow: number;
  notLikedGradeHigh: number;
  notLikedGradeLow: number;
}

export interface RatingCorrelation {
  /** Coeficiente de Spearman em [-1, 1], null se nao houver dados. */
  r: number | null;
  n: number;
  /** n >= minSample. Se false a UI diz "dados insuficientes". */
  enough: boolean;
  /**
   * Porque nao ha coeficiente utilizavel. 'insufficient' = enough false;
   * 'no_variation' = enough true mas um dos lados tem todos os valores
   * iguais (r null); null = r utilizavel.
   */
  reason?: CorrelationReason | null;
}

export type CorrelationReason = 'insufficient' | 'no_variation';

export interface TeacherRatingSummary {
  teacherName: string;
  courses: number;
  avgRating: number | null;
  avgGradeFraction: number | null;
}

export interface RatingStats {
  /** Amostra minima para mostrar correlacoes (constante no backend). */
  minSample: number;
  courses: RatingCourseRow[];
  /** "Nota alta" = acima da media das cadeiras do proprio user. */
  quadrants: { teacher: RatingQuadrants; course: RatingQuadrants };
  correlations: {
    teacherVsGrade: RatingCorrelation;
    courseVsGrade: RatingCorrelation;
    focusVsGrade: RatingCorrelation;
    courseVsFocus: RatingCorrelation;
  };
  byTeacher: TeacherRatingSummary[];
}
