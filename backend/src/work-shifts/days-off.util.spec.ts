import { isDayOff } from './days-off.util';

describe('isDayOff', () => {
  it('é folga quando o dia está na lista', () => {
    expect(isDayOff([0, 6], 6)).toBe(true);
    expect(isDayOff([0, 6], 0)).toBe(true);
  });

  it('não é folga fora da lista', () => {
    expect(isDayOff([0, 6], 3)).toBe(false);
  });

  it('sem lista ou sem dia (turno pontual) nunca é folga', () => {
    expect(isDayOff(undefined, 1)).toBe(false);
    expect(isDayOff(null, 1)).toBe(false);
    expect(isDayOff([1], null)).toBe(false);
    expect(isDayOff([], 1)).toBe(false);
  });
});
