import type { Provider } from '../../types/models';
import { GoogleIcon, DiscordIcon, GithubIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

interface OAuthButtonProps {
  provider: Provider;
  href: string;
  onClick?: () => void;
}

const PROVIDER_CONFIG: Record<Provider, { label: string; Icon: typeof GoogleIcon }> = {
  GOOGLE: { label: 'Google', Icon: GoogleIcon },
  DISCORD: { label: 'Discord', Icon: DiscordIcon },
  GITHUB: { label: 'GitHub', Icon: GithubIcon },
};

export default function OAuthButton({ provider, href, onClick }: OAuthButtonProps) {
  const { label, Icon } = PROVIDER_CONFIG[provider];
  const { t } = useI18n();

  return (
    <a
      href={href}
      onClick={onClick}
      className="border border-neutral-700 rounded p-2 text-center text-neutral-200 hover:border-neutral-500 flex items-center justify-center gap-2"
    >
      <Icon />
      {t('ui.continueWithProvider', { provider: label })}
    </a>
  );
}
