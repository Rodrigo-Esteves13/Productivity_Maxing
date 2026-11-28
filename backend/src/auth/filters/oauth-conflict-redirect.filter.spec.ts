import { ArgumentsHost, UnauthorizedException } from '@nestjs/common';
import { OAuthAccountConflictException } from '../exceptions/oauth-account-conflict.exception';
import { OAuthConflictRedirectFilter } from './oauth-conflict-redirect.filter';

function hostWith(redirect: jest.Mock<void, [string]>): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => ({ redirect }) }),
  } as unknown as ArgumentsHost;
}

describe('OAuthConflictRedirectFilter (E-06)', () => {
  it('sends a blocked account to the blocked screen with the appeal token in the fragment', () => {
    const redirect = jest.fn<void, [string]>();
    new OAuthConflictRedirectFilter().catch(
      new UnauthorizedException({
        code: 'ACCOUNT_BLOCKED',
        message: 'This account has been banned.',
        appealToken: 'appeal.jwt',
      }),
      hostWith(redirect),
    );
    const url = redirect.mock.calls[0][0];
    expect(url).toMatch(
      /\/auth\/callback\?error=account_blocked#appeal=appeal\.jwt$/,
    );
  });

  it('puts the conflict email in the fragment, not the query string', () => {
    const redirect = jest.fn<void, [string]>();
    new OAuthConflictRedirectFilter().catch(
      new OAuthAccountConflictException('a@b.pt'),
      hostWith(redirect),
    );
    const url = redirect.mock.calls[0][0];
    expect(url).toMatch(
      /\/auth\/callback\?error=account_conflict#email=a%40b\.pt$/,
    );
    expect(url.split('#')[0]).not.toContain('a%40b.pt');
  });

  it('keeps the generic error for anything else', () => {
    const redirect = jest.fn<void, [string]>();
    const filter = new OAuthConflictRedirectFilter();
    jest
      .spyOn(
        (filter as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);
    filter.catch(new Error('db down'), hostWith(redirect));
    expect(redirect.mock.calls[0][0]).toMatch(/error=oauth_failed$/);
  });
});
