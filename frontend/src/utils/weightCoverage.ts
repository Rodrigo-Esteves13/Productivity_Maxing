import type { Task } from '../types/models';

export interface WeightCoverage {
  // Sum of weightPercentage across every task in scope. Only meaningful
  // when every task in scope has an explicit weightPercentage - mixing
  // that with the "no weight set -> counts as 1" fallback used elsewhere
  // (grade-average.util.ts on the backend, GradeNeededCalculator here)
  // would turn this into a meaningless mixed unit, so this stays 0
  // whenever any task in scope has weightPercentage === null.
  totalWeight: number;
  // True when every task in scope has weightPercentage set - the
  // precondition for totalWeight to actually mean "percent of the
  // course's final grade" rather than an arbitrary count.
  allWeighted: boolean;
}

// A course's graded components (tests, assignments, ...) are expected to
// add up to 100% of its final grade. In practice tasks get added over the
// semester as they're announced, so at any given point the weights on
// file may add up to less than 100% - e.g. a final exam not yet turned
// into a task. This tells the caller how much of the course is actually
// accounted for right now, so that gap can be surfaced instead of
// silently treated as "the whole course" by an average normalized only
// over what's present.
export function computeWeightCoverage(tasks: Task[]): WeightCoverage {
  const allWeighted = tasks.length > 0 && tasks.every((t) => t.weightPercentage !== null);
  const totalWeight = allWeighted
    ? tasks.reduce((sum, t) => sum + (t.weightPercentage ?? 0), 0)
    : 0;
  return { totalWeight, allWeighted };
}
