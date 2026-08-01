import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  getPrograms,
  getProgramPeriods,
  activatePeriod,
  createProgram as createProgramRequest,
  createPeriod as createPeriodRequest,
  deleteProgram as deleteProgramRequest,
  restorePeriod as restorePeriodRequest,
} from '../api/academicService';
import type { AcademicProgram, AcademicPeriod } from '../types/models';
import { useAuth } from './useAuth';
import { AcademicContext } from './academic-context';

export function AcademicProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [activeProgram, setActiveProgram] = useState<AcademicProgram | null>(null);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<AcademicPeriod | null>(null);
  const [isViewingAllPeriods, setIsViewingAllPeriods] = useState(false);
  // Separate axis from isViewingAllPeriods (that one aggregates periods
  // WITHIN the active program; this one steps outside any single program
  // entirely - see viewAllPrograms()). activeProgram/activePeriod keep
  // tracking the real underlying program/period the whole time (so
  // switching back to a concrete program restores exactly where the user
  // left off) - only what's EXPOSED to consumers below is nulled out
  // while this is true, so every program-scoped widget that already
  // guards on `!activeProgram` (GpaSummary, CreditsAccumulatedCard, the
  // Archive/RestorePeriod buttons, ...) hides itself automatically with
  // no changes needed on their end.
  const [isViewingAllPrograms, setIsViewingAllPrograms] = useState(false);
  const [showArchivedPeriods, setShowArchivedPeriods] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks the program/period the user is CURRENTLY on during this
  // session, independent of `user.activeProgramId/activePeriodId` (which
  // only reflect whatever was active the moment AuthContext's `user` was
  // last fetched - typically at login). Without this, calling refresh()
  // after any unrelated action (e.g. renaming a period of the program
  // you're already on) would re-derive the active program/period from
  // that stale snapshot and silently snap you back to whatever was
  // active at login, instead of staying where you actually are.
  const activeProgramIdRef = useRef<string | null>(null);
  const activePeriodIdRef = useRef<string | null>(null);

  // Loads the periods for a program and picks which one ends up active -
  // reused in the initial load(), in switchProgram(), and right after
  // creating a new program.
  const loadPeriodsFor = useCallback(
    async (program: AcademicProgram, preferredPeriodId?: string | null, syncIfChanged = false) => {
      const periodsData = await getProgramPeriods(program.id);
      setPeriods(periodsData);
      const sorted = [...periodsData].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );
      const period =
        sorted.find((p) => p.id === preferredPeriodId) ??
        sorted.find((p) => p.isPinned && !p.isArchived) ??
        sorted.find((p) => !p.isArchived) ??
        sorted[0] ??
        null;
      setActivePeriod(period);
      activePeriodIdRef.current = period?.id ?? null;

      // The pin (or the archived/deleted-period fallback) can pick a
      // DIFFERENT period than the one the backend has recorded as active
      // (User.activeProgramId/activePeriodId) - pinning itself never
      // called activatePeriod, it only affects this client-side pick.
      // Without persisting it back here, that pick only ever existed in
      // memory: a real browser refresh re-fetches the user profile from
      // the backend, which still points at the old one, and you land
      // back on it every time. Only done for the full load() path below,
      // not for explicit switchProgram/switchPeriod (those already
      // persist their own choice right after calling this).
      if (syncIfChanged && period && period.id !== preferredPeriodId) {
        activatePeriod(period.id).catch((err) => {
          console.error('Failed to sync resolved active period:', err);
        });
      }

      return period;
    },
    [],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const programsData = await getPrograms();
      setPrograms(programsData);

      // Prefer whatever this session already had active (activeProgramIdRef);
      // only fall back to the user profile's snapshot on the very first
      // load, when the ref hasn't been set yet. If neither points to a
      // program that still exists, fall back to the first active one.
      const preferredProgramId = activeProgramIdRef.current ?? user?.activeProgramId;
      const program =
        programsData.find((p) => p.id === preferredProgramId) ??
        programsData.find((p) => p.isActive) ??
        programsData[0] ??
        null;
      setActiveProgram(program);
      activeProgramIdRef.current = program?.id ?? null;

      if (program) {
        const preferredPeriodId = activePeriodIdRef.current ?? user?.activePeriodId;
        // Temporary diagnostic - remove once the "reverts to General on
        // refresh" report is confirmed fixed. Prints exactly what the
        // backend profile said vs what actually got picked.
        console.log('[AcademicContext] load()', {
          userActiveProgramId: user?.activeProgramId,
          userActivePeriodId: user?.activePeriodId,
          resolvedProgram: program.name,
          preferredPeriodId,
        });
        await loadPeriodsFor(program, preferredPeriodId, true);
      } else {
        setPeriods([]);
        setActivePeriod(null);
        activePeriodIdRef.current = null;
      }
    } catch (err) {
      console.error('Failed to load academic programs/periods:', err);
    } finally {
      setIsLoading(false);
    }
    // Only loadPeriodsFor is a real dependency for the CALLBACK ITSELF -
    // but user.activeProgramId/activePeriodId must be included too, or
    // this closure freezes on whatever `user` was at the time load() was
    // first created (see the race condition explained on the effect
    // below) and never picks up the real value once the profile actually
    // finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPeriodsFor, user?.activeProgramId, user?.activePeriodId]);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Guard on `user` (not just `isAuthenticated`) on purpose:
      // AuthContext sets isAuthenticated=true and only THEN awaits
      // fetching the user profile - so isAuthenticated can already be
      // true for a render or two before `user.activeProgramId` actually
      // exists. Firing load() at that exact moment silently discarded
      // the real active program/period and fell back to "whichever
      // program comes first", which in practice was always the oldest
      // one ("General") - not because switching didn't persist, but
      // because load() never actually saw what WAS persisted.
      load();
    } else if (!isAuthenticated) {
      // Clear everything on logout, so the next account signing in on this
      // browser doesn't visually inherit the previous one's dashboard for
      // a split second.
      setPrograms([]);
      setActiveProgram(null);
      setPeriods([]);
      setActivePeriod(null);
      setIsViewingAllPeriods(false);
      setShowArchivedPeriods(false);
      setIsLoading(false);
      activeProgramIdRef.current = null;
      activePeriodIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, load]);

  const switchPeriod = async (periodId: string | 'all') => {
    setIsViewingAllPrograms(false);
    if (periodId === 'all') {
      // "View all periods" is just a local view mode - it doesn't make
      // sense to persist it on the backend as the "active period" (that
      // concept always points to one real, concrete period).
      setIsViewingAllPeriods(true);
      return;
    }
    const period = periods.find((p) => p.id === periodId);
    if (!period) return;

    // Optimistic: the UI updates right away, the backend request runs in
    // parallel - switching periods should feel instant.
    setActivePeriod(period);
    activePeriodIdRef.current = period.id;
    setIsViewingAllPeriods(false);
    try {
      await activatePeriod(periodId);
    } catch (err) {
      console.error('Failed to persist active period:', err);
    }
  };

  const switchProgram = async (programId: string) => {
    const program = programs.find((p) => p.id === programId);
    if (!program) return;

    setIsViewingAllPrograms(false);
    // Optimistic, same as switchPeriod.
    setActiveProgram(program);
    activeProgramIdRef.current = program.id;
    setIsViewingAllPeriods(false);
    const period = await loadPeriodsFor(program);
    if (period) {
      try {
        await activatePeriod(period.id);
      } catch (err) {
        console.error('Failed to persist active program/period:', err);
      }
    }
    // A program with no periods yet (shouldn't happen via createProgram,
    // which always creates a first one - only reachable for a program
    // created some other way, e.g. a direct API call). It stays with no
    // active period until one is created; PeriodSelector simply shows
    // nothing.
  };

  const createProgram = async (name: string, roundFinalGrade?: boolean) => {
    setIsViewingAllPrograms(false);
    const program = await createProgramRequest({ name, roundFinalGrade });
    const period = await createPeriodRequest({
      programId: program.id,
      name: 'Period 1',
      startDate: new Date().toISOString(),
    });
    setPrograms((prev) => [...prev, program]);
    setActiveProgram(program);
    activeProgramIdRef.current = program.id;
    setPeriods([period]);
    setActivePeriod(period);
    activePeriodIdRef.current = period.id;
    setIsViewingAllPeriods(false);
    try {
      await activatePeriod(period.id);
    } catch (err) {
      console.error('Failed to persist active program/period:', err);
    }
  };

  const removeProgram = async (programId: string) => {
    await deleteProgramRequest(programId);

    const remaining = programs.filter((p) => p.id !== programId);
    setPrograms(remaining);

    if (activeProgram?.id !== programId) return;

    // The deleted program was the active one - fall back to another
    // remaining program automatically, same idea as switchProgram.
    const nextProgram =
      remaining.find((p) => p.isActive) ?? remaining[0] ?? null;
    setActiveProgram(nextProgram);
    activeProgramIdRef.current = nextProgram?.id ?? null;
    setIsViewingAllPeriods(false);
    if (nextProgram) {
      const period = await loadPeriodsFor(nextProgram);
      if (period) {
        try {
          await activatePeriod(period.id);
        } catch (err) {
          console.error('Failed to persist active program/period:', err);
        }
      }
    } else {
      setPeriods([]);
      setActivePeriod(null);
      activePeriodIdRef.current = null;
    }
  };

  const restorePeriod = async (periodId: string) => {
    const restored = await restorePeriodRequest(periodId);
    setPeriods((prev) => prev.map((p) => (p.id === periodId ? restored : p)));
    if (activePeriod?.id === periodId) {
      setActivePeriod(restored);
    }
  };

  const toggleShowArchivedPeriods = () => {
    setShowArchivedPeriods((prev) => !prev);
  };

  // Steps outside any single program - "No program (all tasks)" in
  // ProgramSelector. Doesn't touch the underlying activeProgram/
  // activePeriod state at all, only the derived values exposed below, so
  // switching back to a real program (switchProgram/switchPeriod, both of
  // which clear this) picks up exactly where the user left off.
  const viewAllPrograms = () => {
    setIsViewingAllPrograms(true);
  };

  return (
    <AcademicContext.Provider
      value={{
        programs,
        activeProgram: isViewingAllPrograms ? null : activeProgram,
        periods,
        activePeriod: isViewingAllPrograms ? null : activePeriod,
        isViewingAllPeriods,
        isViewingAllPrograms,
        viewAllPrograms,
        showArchivedPeriods,
        toggleShowArchivedPeriods,
        isLoading,
        switchPeriod,
        restorePeriod,
        switchProgram,
        createProgram,
        removeProgram,
        refresh: load,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
}
