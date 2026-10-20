// Logica PURA do itinerario de um dia (sem Prisma, sem rede): dado o que a
// pessoa tem marcado (aulas, turnos, eventos), decide as viagens. Entre duas
// coisas seguidas so volta a casa se houver tempo para la chegar, ficar pelo
// menos HOME_MARGIN_MINUTES e voltar a tempo; senao vai direto de um sitio
// para o outro. Usado pelo sync com o Google Calendar, pelo feed .ics e pelo
// plano de estudo (ItineraryService).

// Tempo minimo em casa que justifica a ida (abaixo disto fica-se por la).
export const HOME_MARGIN_MINUTES = 30;

export interface ItineraryStop {
  // Identidade estavel (ex: "class:<id>", "shift:<id>"): entra na chave das
  // viagens, para o sync reconhecer o mesmo evento de um dia para o outro.
  key: string;
  start: number; // minutos desde a meia-noite
  end: number;
  // Sitio onde a coisa acontece. Iguais = mesmo sitio (ficar entre as duas).
  // null = sitio desconhecido (nunca e "o mesmo" que outro).
  placeKey: string | null;
  // Nome curto do sitio, para os titulos das viagens ("Travel to <label>").
  label: string;
  // Minutos de viagem casa-sitio (um sentido). 0 = nao ha viagem a contar.
  fromHome: number;
}

export type ItineraryLegKind = 'from_home' | 'to_home' | 'between';

export interface ItineraryLeg {
  key: string;
  kind: ItineraryLegKind;
  start: number;
  end: number;
  toLabel: string;
  // Viagem direta que nao cabe no intervalo: chega-se atrasado.
  late: boolean;
}

// Minutos de viagem direta entre dois sitios (null = desconhecido).
export type BetweenResolver = (
  fromPlace: string,
  toPlace: string,
) => number | null;

function legFromHome(stop: ItineraryStop): ItineraryLeg {
  return {
    key: `home>${stop.key}`,
    kind: 'from_home',
    start: stop.start - stop.fromHome,
    end: stop.start,
    toLabel: stop.label,
    late: false,
  };
}

function legToHome(stop: ItineraryStop): ItineraryLeg {
  return {
    key: `${stop.key}>home`,
    kind: 'to_home',
    start: stop.end,
    end: stop.end + stop.fromHome,
    toLabel: 'home',
    late: false,
  };
}

// Sem estimativa direta: usa a viagem casa-destino (o que a app ja fazia
// antes), ou a de volta a casa se o destino nao tiver viagem.
function directMinutes(
  prev: ItineraryStop,
  next: ItineraryStop,
  between: BetweenResolver,
): number {
  if (prev.placeKey !== null && next.placeKey !== null) {
    const known = between(prev.placeKey, next.placeKey);
    if (known !== null) return known;
  }
  return next.fromHome > 0 ? next.fromHome : prev.fromHome;
}

export function buildDayItinerary(
  stops: ItineraryStop[],
  between: BetweenResolver,
  homeMarginMinutes = HOME_MARGIN_MINUTES,
): ItineraryLeg[] {
  // Coisas sem sitio nem viagem (ex: evento online) nao mexem com o trajeto.
  const routed = stops
    .filter((s) => s.placeKey !== null || s.fromHome > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (routed.length === 0) return [];

  const legs: ItineraryLeg[] = [];
  const first = routed[0];
  if (first.fromHome > 0) legs.push(legFromHome(first));

  for (let i = 1; i < routed.length; i++) {
    const prev = routed[i - 1];
    const next = routed[i];
    const gap = next.start - prev.end;
    // Sobrepostos: nao ha viagem a meio.
    if (gap < 0) continue;

    const homeRoundTrip = prev.fromHome + homeMarginMinutes + next.fromHome;
    if (homeRoundTrip <= gap) {
      if (prev.fromHome > 0) legs.push(legToHome(prev));
      if (next.fromHome > 0) legs.push(legFromHome(next));
      continue;
    }

    const samePlace = prev.placeKey !== null && prev.placeKey === next.placeKey;
    if (samePlace) continue;

    const minutes = directMinutes(prev, next, between);
    if (minutes <= 0) continue;
    legs.push({
      key: `${prev.key}>${next.key}`,
      kind: 'between',
      start: prev.end,
      end: prev.end + minutes,
      toLabel: next.label,
      late: minutes > gap,
    });
  }

  const last = routed[routed.length - 1];
  if (last.fromHome > 0) legs.push(legToHome(last));
  return legs;
}

// Mapa dia -> viagens numa lista plana (formato do sync/feed).
export function flattenItinerary(
  byDate: Map<string, ItineraryLeg[]>,
): { date: string; leg: ItineraryLeg }[] {
  return [...byDate].flatMap(([date, legs]) =>
    legs.map((leg) => ({ date, leg })),
  );
}
