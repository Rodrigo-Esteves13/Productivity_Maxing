import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addUtcDays,
  diffUtcDays,
  getLisbonNow,
  lisbonDayBounds,
  parseDateKey,
  toDateKey,
  toLisbonDateKey,
} from '../common/date-key.util';
import { MS_PER_MINUTE } from '../common/time.constants';
import { pearson, type CorrelationResult } from './correlation.util';
import { detectBurnout, type BurnoutResult } from './burnout.util';
import {
  BURNOUT_BASELINE_DAYS,
  BURNOUT_RECENT_DAYS,
  INSIGHTS_WINDOW_DAYS,
} from './wellbeing.constants';

interface DayStudy {
  minutes: number;
  focusSum: number;
  focusCount: number;
}

export interface WellbeingInsights {
  windowDays: number;
  loggedDays: number;
  averageMood: number | null;
  // Humor do dia vs foco medio das sessoes desse dia.
  moodVsFocus: CorrelationResult;
  // Humor do dia vs minutos estudados nesse dia.
  moodVsStudyMinutes: CorrelationResult;
  // Energia do dia vs foco medio (so dias com energia registada).
  energyVsFocus: CorrelationResult;
  // Stress do dia vs foco medio (so dias com stress registado).
  stressVsFocus: CorrelationResult;
  // Humor/energia a cair com a carga mantida ou o stress a subir.
  burnout: BurnoutResult;
}

// Cruza o registo diario do humor com as sessoes de estudo dos ultimos
// INSIGHTS_WINDOW_DAYS dias. Foco vs notas ja existe (FocusEffectService).
@Injectable()
export class WellbeingInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<WellbeingInsights> {
    const { today } = getLisbonNow();
    const fromDate = addUtcDays(today, -(INSIGHTS_WINDOW_DAYS - 1));
    const { start } = lisbonDayBounds(toDateKey(fromDate));
    const { end } = lisbonDayBounds(toDateKey(today));

    const [logs, sessions] = await Promise.all([
      this.prisma.moodLog.findMany({
        where: { userId, date: { gte: fromDate, lte: today } },
        select: { date: true, mood: true, energy: true, stress: true },
      }),
      this.prisma.studySession.findMany({
        where: {
          userId,
          startedAt: { gte: start, lt: end },
          endedAt: { not: null },
        },
        select: { startedAt: true, endedAt: true, focusRating: true },
      }),
    ]);

    const studyByDay = new Map<string, DayStudy>();
    for (const s of sessions) {
      if (!s.endedAt) continue;
      const key = toLisbonDateKey(s.startedAt);
      const day = studyByDay.get(key) ?? {
        minutes: 0,
        focusSum: 0,
        focusCount: 0,
      };
      day.minutes += Math.max(
        0,
        (s.endedAt.getTime() - s.startedAt.getTime()) / MS_PER_MINUTE,
      );
      if (s.focusRating !== null) {
        day.focusSum += s.focusRating;
        day.focusCount += 1;
      }
      studyByDay.set(key, day);
    }

    const avgFocus = (key: string): number | null => {
      const day = studyByDay.get(key);
      return day && day.focusCount > 0 ? day.focusSum / day.focusCount : null;
    };
    const focusPairs = (pick: (log: (typeof logs)[number]) => number | null) =>
      logs.flatMap((log): [number, number][] => {
        const x = pick(log);
        const y = avgFocus(toDateKey(log.date));
        return x !== null && y !== null ? [[x, y]] : [];
      });

    // Minutos de estudo da ultima semana e das 3 antes (por dia de Lisboa).
    let studyRecent = 0;
    let studyBaseline = 0;
    for (const [key, day] of studyByDay) {
      const daysAgo = diffUtcDays(parseDateKey(key), today);
      if (daysAgo < BURNOUT_RECENT_DAYS) studyRecent += day.minutes;
      else if (daysAgo < BURNOUT_RECENT_DAYS + BURNOUT_BASELINE_DAYS)
        studyBaseline += day.minutes;
    }
    const burnout = detectBurnout(
      logs.map((l) => ({
        daysAgo: diffUtcDays(l.date, today),
        mood: l.mood,
        energy: l.energy,
        stress: l.stress,
      })),
      studyRecent,
      studyBaseline,
    );

    const averageMood =
      logs.length > 0
        ? Math.round(
            (logs.reduce((sum, l) => sum + l.mood, 0) / logs.length) * 10,
          ) / 10
        : null;

    return {
      windowDays: INSIGHTS_WINDOW_DAYS,
      loggedDays: logs.length,
      averageMood,
      moodVsFocus: pearson(focusPairs((l) => l.mood)),
      // Dia sem sessoes = 0 minutos: tambem conta (humor baixo, nao estudou).
      moodVsStudyMinutes: pearson(
        logs.map((l): [number, number] => [
          l.mood,
          studyByDay.get(toDateKey(l.date))?.minutes ?? 0,
        ]),
      ),
      energyVsFocus: pearson(focusPairs((l) => l.energy)),
      stressVsFocus: pearson(focusPairs((l) => l.stress)),
      burnout,
    };
  }
}
