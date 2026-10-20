import {
  buildDayItinerary,
  type BetweenResolver,
  type ItineraryStop,
} from './itinerary.builder';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

const campus = (key: string, start: number, end: number): ItineraryStop => ({
  key,
  start,
  end,
  placeKey: 'campus',
  label: 'campus',
  fromHome: 30,
});

const work = (key: string, start: number, end: number): ItineraryStop => ({
  key,
  start,
  end,
  placeKey: 'work',
  label: 'McDonalds',
  fromHome: 25,
});

const noDirect: BetweenResolver = () => null;
const campusToWork15: BetweenResolver = (a, b) =>
  (a === 'campus' && b === 'work') || (a === 'work' && b === 'campus')
    ? 15
    : null;

describe('buildDayItinerary', () => {
  it('returns no travel for an empty day', () => {
    expect(buildDayItinerary([], noDirect)).toEqual([]);
  });

  it('goes from home before the first thing and back after the last', () => {
    const legs = buildDayItinerary([campus('c1', h(9), h(11))], noDirect);
    expect(legs.map((l) => [l.kind, l.start, l.end])).toEqual([
      ['from_home', h(8, 30), h(9)],
      ['to_home', h(11), h(11, 30)],
    ]);
  });

  it('stays on campus between classes when going home is not worth it', () => {
    // gap 60 < 30 + 30 + 30
    const legs = buildDayItinerary(
      [campus('c1', h(9), h(10)), campus('c2', h(11), h(12))],
      noDirect,
    );
    expect(legs.map((l) => l.kind)).toEqual(['from_home', 'to_home']);
  });

  it('goes home in a long gap when there is time to get back', () => {
    // gap 4h >= 30 + 30 + 30
    const legs = buildDayItinerary(
      [campus('c1', h(9), h(10)), campus('c2', h(14), h(15))],
      noDirect,
    );
    expect(legs.map((l) => [l.kind, l.start, l.end])).toEqual([
      ['from_home', h(8, 30), h(9)],
      ['to_home', h(10), h(10, 30)],
      ['from_home', h(13, 30), h(14)],
      ['to_home', h(15), h(15, 30)],
    ]);
  });

  it('goes straight from class to work when home does not fit, using the direct time', () => {
    // gap 60 < 30 + 30 + 25: direct campus -> work (15 min)
    const legs = buildDayItinerary(
      [campus('c1', h(9), h(12)), work('w1', h(13), h(17))],
      campusToWork15,
    );
    const between = legs.find((l) => l.kind === 'between');
    expect(between).toEqual({
      key: 'c1>w1',
      kind: 'between',
      start: h(12),
      end: h(12, 15),
      toLabel: 'McDonalds',
      late: false,
    });
    expect(legs.map((l) => l.kind)).toEqual([
      'from_home',
      'between',
      'to_home',
    ]);
  });

  it('falls back to the home trip time when the direct time is unknown', () => {
    const legs = buildDayItinerary(
      [campus('c1', h(9), h(12)), work('w1', h(13), h(17))],
      noDirect,
    );
    const between = legs.find((l) => l.kind === 'between');
    expect(between?.end).toBe(h(12, 25));
  });

  it('flags a direct trip that does not fit in the gap', () => {
    const legs = buildDayItinerary(
      [campus('c1', h(9), h(12, 50)), work('w1', h(13), h(17))],
      campusToWork15,
    );
    expect(legs.find((l) => l.kind === 'between')?.late).toBe(true);
  });

  it('ignores stops with no place and no travel (online events)', () => {
    const online: ItineraryStop = {
      key: 'e1',
      start: h(10),
      end: h(11),
      placeKey: null,
      label: 'Call',
      fromHome: 0,
    };
    const legs = buildDayItinerary([online], noDirect);
    expect(legs).toEqual([]);
  });

  it('never treats two unknown places as the same place', () => {
    const a: ItineraryStop = {
      key: 'e1',
      start: h(9),
      end: h(10),
      placeKey: null,
      label: 'A',
      fromHome: 20,
    };
    const b: ItineraryStop = {
      key: 'e2',
      start: h(10, 30),
      end: h(11),
      placeKey: null,
      label: 'B',
      fromHome: 20,
    };
    const legs = buildDayItinerary([a, b], noDirect);
    expect(legs.map((l) => l.kind)).toEqual([
      'from_home',
      'between',
      'to_home',
    ]);
  });
});
