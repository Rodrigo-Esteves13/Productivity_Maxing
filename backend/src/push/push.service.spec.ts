import { isAllowedPushEndpoint } from './push.service';
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
