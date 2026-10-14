import {
  providerAvatarOrigin,
  shouldSyncProviderAvatar,
  trustedProviderAvatar,
} from './provider-avatar.util';

const GOOGLE_OLD = 'https://lh3.googleusercontent.com/a/OLD=s96-c';
const GOOGLE_NEW = 'https://lh3.googleusercontent.com/a/NEW=s96-c';
const GITHUB = 'https://avatars.githubusercontent.com/u/1?v=4';
const UPLOADED =
  'https://x.supabase.co/storage/v1/object/public/avatars/user/a.png';

describe('providerAvatarOrigin', () => {
  it('reconhece os hosts de cada provider', () => {
    expect(providerAvatarOrigin(GOOGLE_OLD)).toBe('google');
    expect(providerAvatarOrigin(GITHUB)).toBe('github');
    expect(
      providerAvatarOrigin('https://cdn.discordapp.com/avatars/1/a.png'),
    ).toBe('discord');
  });

  it('rejeita http, hosts desconhecidos, lookalikes e lixo', () => {
    expect(
      providerAvatarOrigin('http://lh3.googleusercontent.com/a'),
    ).toBeNull();
    expect(providerAvatarOrigin(UPLOADED)).toBeNull();
    expect(
      providerAvatarOrigin('https://googleusercontent.com.evil.test/a'),
    ).toBeNull();
    expect(providerAvatarOrigin('javascript:alert(1)')).toBeNull();
    expect(providerAvatarOrigin('not a url')).toBeNull();
    expect(providerAvatarOrigin(null)).toBeNull();
  });
});

describe('trustedProviderAvatar', () => {
  it('devolve o URL só quando é de confiança', () => {
    expect(trustedProviderAvatar(GITHUB)).toBe(GITHUB);
    expect(trustedProviderAvatar('https://evil.test/a.png')).toBeNull();
    expect(trustedProviderAvatar(undefined)).toBeNull();
  });
});

describe('shouldSyncProviderAvatar', () => {
  it('preenche quando não há avatar', () => {
    expect(shouldSyncProviderAvatar(null, GOOGLE_NEW)).toBe(true);
  });

  it('acompanha a mudança de foto no mesmo provider', () => {
    expect(shouldSyncProviderAvatar(GOOGLE_OLD, GOOGLE_NEW)).toBe(true);
  });

  it('não escreve se a foto é igual', () => {
    expect(shouldSyncProviderAvatar(GOOGLE_OLD, GOOGLE_OLD)).toBe(false);
  });

  it('nunca sobrescreve foto carregada pelo utilizador', () => {
    expect(shouldSyncProviderAvatar(UPLOADED, GOOGLE_NEW)).toBe(false);
  });

  it('nunca sobrescreve a foto de outro provider', () => {
    expect(shouldSyncProviderAvatar(GITHUB, GOOGLE_NEW)).toBe(false);
  });

  it('ignora fotos novas que não são de confiança', () => {
    expect(shouldSyncProviderAvatar(GOOGLE_OLD, 'https://evil.test/a')).toBe(
      false,
    );
    expect(shouldSyncProviderAvatar(null, 'https://evil.test/a')).toBe(false);
  });
});
