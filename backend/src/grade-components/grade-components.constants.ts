export const GRADE_AGGREGATIONS = [
  'AVERAGE',
  'BEST_OF',
  'DROP_LOWEST',
] as const;
export type GradeAggregationKind = (typeof GRADE_AGGREGATIONS)[number];

export const MAX_COMPONENT_NAME_LENGTH = 80;
export const MAX_ENTRY_LABEL_LENGTH = 80;
export const MAX_COMPONENTS_PER_AREA = 12;
export const MAX_ENTRIES_PER_COMPONENT = 200;
// Mesmo teto que qualquer escala de notas do programa (0-20, 0-100, GPA...).
export const MAX_GRADE_VALUE = 100;
