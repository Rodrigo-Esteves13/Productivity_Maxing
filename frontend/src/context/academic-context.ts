import { createContext } from 'react';
import type { AcademicProgram, AcademicPeriod } from '../types/models';

export interface AcademicContextType {
  programs: AcademicProgram[];
  // Active program (multi-program dashboards).
  activeProgram: AcademicProgram | null;
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod | null;
  // 'all' = aggregated view ("View all periods"), no single period
  // selected - see PeriodSelector.
  isViewingAllPeriods: boolean;
  // Steps outside any single program entirely ("No program (all tasks)"
  // in ProgramSelector) - independent of isViewingAllPeriods, which stays
  // scoped to periods within one program. While true, activeProgram and
  // activePeriod above are both null (the real selection is preserved
  // internally and restored by switchProgram/switchPeriod).
  isViewingAllPrograms: boolean;
  viewAllPrograms: () => void;
  // Archived periods are hidden from the selector by default - this
  // toggles showing them (still read-only-ish there, but reachable and
  // restorable, instead of just gone).
  showArchivedPeriods: boolean;
  toggleShowArchivedPeriods: () => void;
  isLoading: boolean;
  switchPeriod: (periodId: string | 'all') => Promise<void>;
  // Undoes archiving a period. No restrictions - always allowed.
  restorePeriod: (periodId: string) => Promise<void>;
  // Switches dashboard: changes the active program and automatically
  // selects that program's most recent period (or none, if it doesn't
  // have any period yet).
  switchProgram: (programId: string) => Promise<void>;
  // Creates a new program (dashboard) and already attaches a first period
  // to it, activating everything right after - this is what "+ Create new
  // program" in the selector calls.
  createProgram: (name: string, roundFinalGrade?: boolean) => Promise<void>;
  // Permanently deletes a program (only allowed if it has no tasks left in
  // it - the backend enforces this and returns a 409 otherwise). If the
  // deleted program was the active one, falls back to another remaining
  // program automatically, same idea as switchProgram.
  removeProgram: (programId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const AcademicContext = createContext<AcademicContextType | undefined>(undefined);
