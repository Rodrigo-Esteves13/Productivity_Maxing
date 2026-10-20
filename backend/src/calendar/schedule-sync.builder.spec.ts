import { buildDesiredEvents } from './schedule-sync.builder';
import type { ItineraryLeg } from '../schedule/itinerary.builder';

const leg = (overrides: Partial<ItineraryLeg>): ItineraryLeg => ({
  key: 'home>class:c1',
  kind: 'from_home',
  start: 510,
  end: 540,
  toLabel: 'campus',
  late: false,
  ...overrides,
});

describe('buildDesiredEvents travel', () => {
  it('turns itinerary legs into travel events with stable keys and titles', () => {
    const events = buildDesiredEvents({
      classes: [],
      shifts: [],
      study: [],
      travel: [
        { date: '2026-10-20', leg: leg({}) },
        {
          date: '2026-10-20',
          leg: leg({
            key: 'class:c1>home',
            kind: 'to_home',
            start: 660,
            end: 690,
            toLabel: 'home',
          }),
        },
      ],
    });
    expect(
      events.map((e) => [e.sourceKey, e.kind, e.title, e.startMinutes]),
    ).toEqual([
      ['travel:2026-10-20:home>class:c1', 'travel', 'Travel to campus', 510],
      ['travel:2026-10-20:class:c1>home', 'travel', 'Travel home', 660],
    ]);
  });

  it('warns in the description when a direct trip does not fit', () => {
    const [event] = buildDesiredEvents({
      classes: [],
      shifts: [],
      study: [],
      travel: [
        {
          date: '2026-10-20',
          leg: leg({
            key: 'class:c1>shift:s1',
            kind: 'between',
            toLabel: 'McDonalds',
            late: true,
          }),
        },
      ],
    });
    expect(event.title).toBe('Travel to McDonalds');
    expect(event.description).toMatch(/arrive late/);
  });
});
