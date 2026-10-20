import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider } from '@prisma/client';
import { SessionTokenService } from './session-token.service';
import type { SessionStateService } from '../../account-status/session-state.service';

const SECRET = 'test-secret-for-link-state-spec';

function setup() {
  const jwt = new JwtService({ secret: SECRET });
  const service = new SessionTokenService(jwt, {} as SessionStateService);
  const sessionFor = (sub: string) =>
    jwt.sign({ sub, email: `${sub}@example.test`, role: 'USER', tv: 0 });
  return { service, sessionFor };
}

describe('SessionTokenService.consumeLinkState', () => {
  it('accepts the state when the callback carries the same user session', () => {
    const { service, sessionFor } = setup();
    const state = service.createLinkState('owner', Provider.GOOGLE);
    expect(
      service.consumeLinkState(state, Provider.GOOGLE, sessionFor('owner')),
    ).toBe('owner');
  });

  it('refuses a state completed by a browser with another user session', () => {
    const { service, sessionFor } = setup();
    const state = service.createLinkState('attacker', Provider.GOOGLE);
    expect(() =>
      service.consumeLinkState(state, Provider.GOOGLE, sessionFor('victim')),
    ).toThrow(UnauthorizedException);
  });

  it('refuses a state completed without any session', () => {
    const { service } = setup();
    const state = service.createLinkState('attacker', Provider.GITHUB);
    expect(() =>
      service.consumeLinkState(state, Provider.GITHUB, undefined),
    ).toThrow(UnauthorizedException);
  });

  it('refuses a state from another provider', () => {
    const { service, sessionFor } = setup();
    const state = service.createLinkState('owner', Provider.DISCORD);
    expect(() =>
      service.consumeLinkState(state, Provider.GOOGLE, sessionFor('owner')),
    ).toThrow(UnauthorizedException);
  });
});
