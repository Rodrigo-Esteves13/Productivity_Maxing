import { isAllowedPushEndpoint, PushService } from './push.service';
import { buildPushText } from './push-messages';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
    'https://web.push.apple.com/Q',
  ])('aceita %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    'https://evil.com/',
    'http://fcm.googleapis.com/x',
    'https://fcm.googleapis.com.evil.com/x',
    'https://169.254.169.254/latest/meta-data',
    'not a url',
  ])('recusa %s (SSRF)', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

describe('buildPushText', () => {
  it('escreve na língua da subscrição', () => {
    const text = buildPushText('ko', 'shareAccessRequested', {
      name: 'Min',
      title: '선형대수',
    });
    expect(text.body).toContain('Min');
    expect(text.body).toContain('선형대수');
  });

  it('tem textos em francês e alemão', () => {
    expect(
      buildPushText('fr', 'shareAccessApproved', { title: 'T' }).title,
    ).toBe('Accès approuvé');
    expect(
      buildPushText('de', 'shareAccessApproved', { title: 'T' }).title,
    ).toBe('Zugriff genehmigt');
  });

  it('cai para inglês numa língua desconhecida', () => {
    expect(
      buildPushText('xx', 'shareAccessApproved', { title: 'T' }).title,
    ).toBe('Access approved');
  });
});

describe('PushService.notifyUserOnce', () => {
  const DAY = 24 * 60 * 60 * 1000;

  function makeService() {
    const service = new PushService({} as never);
    const notify = jest.spyOn(service, 'notifyUser').mockResolvedValue(1);
    return { service, notify };
  }

  it('sends the first notification for a key', async () => {
    const { service, notify } = makeService();
    const delivered = await service.notifyUserOnce(
      'owner',
      'notesRequested',
      { url: '/social' },
      'k1',
      DAY,
      0,
    );
    expect(delivered).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('suppresses a repeat of the same key inside the cooldown', async () => {
    const { service, notify } = makeService();
    await service.notifyUserOnce(
      'owner',
      'notesRequested',
      { url: '/social' },
      'k1',
      DAY,
      0,
    );
    const delivered = await service.notifyUserOnce(
      'owner',
      'notesRequested',
      { url: '/social' },
      'k1',
      DAY,
      DAY - 1,
    );
    expect(delivered).toBe(0);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('sends again once the cooldown has passed, and keys are independent', async () => {
    const { service, notify } = makeService();
    await service.notifyUserOnce(
      'owner',
      'notesRequested',
      { url: '/social' },
      'k1',
      DAY,
      0,
    );
    await service.notifyUserOnce(
      'owner',
      'notesRequested',
      { url: '/social' },
      'k2',
      DAY,
      10,
    );
    await service.notifyUserOnce(
      'owner',
      'notesRequested',
      { url: '/social' },
      'k1',
      DAY,
      DAY,
    );
    expect(notify).toHaveBeenCalledTimes(3);
  });
});
