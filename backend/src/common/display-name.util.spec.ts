import { pushDisplayName } from './display-name.util';

describe('pushDisplayName', () => {
  it('uses the name when present', () => {
    expect(pushDisplayName({ name: 'Ana', email: 'ana@x.pt' })).toBe('Ana');
  });

  it('falls back to the email local part when the name is missing or blank', () => {
    expect(pushDisplayName({ name: null, email: 'ana.s@x.pt' })).toBe('ana.s');
    expect(pushDisplayName({ name: '   ', email: 'ana.s@x.pt' })).toBe('ana.s');
  });

  it('returns an empty string when nothing is known', () => {
    expect(pushDisplayName(null)).toBe('');
  });
});
