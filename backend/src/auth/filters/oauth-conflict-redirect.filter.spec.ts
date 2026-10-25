import { ArgumentsHost, UnauthorizedException } from '@nestjs/common';
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
