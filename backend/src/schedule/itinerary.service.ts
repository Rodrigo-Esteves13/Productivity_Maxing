import { Injectable } from '@nestjs/common';
import type { CommuteMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TravelTimesService,
  normalizeAddress,
  travelPairKey,
  type TravelPair,
} from '../maps/travel-times.service';
import type { WorkShiftOccurrence } from '../work-shifts/work-shifts.service';
import {
  buildDayItinerary,
  type ItineraryLeg,
  type ItineraryStop,
} from './itinerary.builder';

// Nome usado nas viagens para as aulas ("Travel to campus").
const CAMPUS_LABEL = 'campus';
// placeKey das aulas quando nao ha morada do campus: todas as aulas sao no
// mesmo sitio, mesmo sem a morada exata.
const CAMPUS_PLACE_WITHOUT_ADDRESS = 'place:campus';
const DEFAULT_SHIFT_LABEL = 'work';
const DEFAULT_EVENT_LABEL = 'event';

export interface ItineraryClassInput {
  id: string;
  date: string; // YYYY-MM-DD
  startMinutes: number;
  endMinutes: number;
}

interface RoutedStop {
  stop: ItineraryStop;
  // Morada normalizada (so quando se conhece) e meio para la chegar.
  address: string | null;
  mode: CommuteMode;
}

/**
 * Viagens de cada dia a partir das aulas, turnos e eventos: carrega moradas e
 * tempos de deslocacao, pede os tempos entre sitios (com cache) e aplica a
 * regra do itinerario (itinerary.builder.ts). Devolve as viagens por dia.
 */
@Injectable()
export class ItineraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly travelTimes: TravelTimesService,
  ) {}

  async buildRange(
    userId: string,
    classes: ItineraryClassInput[],
    shifts: WorkShiftOccurrence[],
    options: { allowLookups?: boolean } = {},
  ): Promise<Map<string, ItineraryLeg[]>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { campusAddress: true, commuteMinutes: true, commuteMode: true },
    });
    const campusAddress = user.campusAddress?.trim()
      ? normalizeAddress(user.campusAddress)
      : null;

    const byDate = new Map<string, RoutedStop[]>();
    const add = (date: string, routed: RoutedStop) => {
      const list = byDate.get(date) ?? [];
      list.push(routed);
      byDate.set(date, list);
    };

    for (const c of classes) {
      add(c.date, {
        stop: {
          key: `class:${c.id}`,
          start: c.startMinutes,
          end: c.endMinutes,
          placeKey: campusAddress ?? CAMPUS_PLACE_WITHOUT_ADDRESS,
          label: CAMPUS_LABEL,
          fromHome: user.commuteMinutes ?? 0,
        },
        address: campusAddress,
        mode: user.commuteMode,
      });
    }

    for (const s of shifts) {
      const address = s.address?.trim() ? normalizeAddress(s.address) : null;
      const isEvent = s.commitmentId === null && !s.isRecurring;
      add(s.date, {
        stop: {
          key: `shift:${s.shiftId}`,
          start: s.startMinutes,
          end: s.endMinutes,
          // Sem morada, os turnos do mesmo local continuam a ser "o mesmo
          // sitio"; um evento sem morada nunca e igual a outro.
          placeKey:
            address ?? (s.commitmentId ? `commitment:${s.commitmentId}` : null),
          label:
            s.label ?? (isEvent ? DEFAULT_EVENT_LABEL : DEFAULT_SHIFT_LABEL),
          fromHome: s.bufferMinutes,
        },
        address,
        mode: s.commuteMode ?? user.commuteMode,
      });
    }

    // Pares de moradas seguidas no mesmo dia: os unicos tempos diretos
    // que o itinerario pode precisar.
    const pairs: TravelPair[] = [];
    for (const list of byDate.values()) {
      list.sort((a, b) => a.stop.start - b.stop.start);
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const next = list[i];
        if (prev.address && next.address && prev.address !== next.address) {
          pairs.push({
            origin: prev.address,
            destination: next.address,
            mode: next.mode,
          });
        }
      }
    }
    const minutesByPair = await this.travelTimes.resolve(
      userId,
      pairs,
      options,
    );

    const result = new Map<string, ItineraryLeg[]>();
    for (const [date, list] of byDate) {
      const modeByPlace = new Map(
        list
          .filter((r) => r.stop.placeKey !== null)
          .map((r) => [r.stop.placeKey as string, r.mode]),
      );
      const legs = buildDayItinerary(
        list.map((r) => r.stop),
        (from, to) => {
          const mode = modeByPlace.get(to) ?? user.commuteMode;
          return (
            minutesByPair.get(
              travelPairKey({ origin: from, destination: to, mode }),
            ) ?? null
          );
        },
      );
      if (legs.length > 0) result.set(date, legs);
    }
    return result;
  }
}
