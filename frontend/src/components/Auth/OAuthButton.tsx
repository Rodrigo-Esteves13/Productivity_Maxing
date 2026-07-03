import type { Provider } from '../../types/models';
import { GoogleIcon, DiscordIcon, GithubIcon } from '../UI/icons';

interface OAuthButtonProps {
  provider: Provider;
  href: string;
}

const PROVIDER_CONFIG: Record<Provider, { label: string; Icon: typeof GoogleIcon }> = {
  GOOGLE: { label: 'Google', Icon: GoogleIcon },
  DISCORD: { label: 'Discord', Icon: DiscordIcon },
  GITHUB: { label: 'GitHub', Icon: GithubIcon },
};

export default function OAuthButton({ provider, href }: OAuthButtonProps) {
  const { label, Icon } = PROVIDER_CONFIG[provider];

  return (
    <a
      href={href}
      className="border border-neutral-700 rounded p-2 text-center text-neutral-200 hover:border-neutral-500 flex items-center justify-center gap-2"
    >
      <Icon />
      Continuar com {label}
    </a>
  );
}
