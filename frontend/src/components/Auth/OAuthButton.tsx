import type { Provider } from '../../types/models';

interface OAuthButtonProps {
  provider: Provider;
  href: string;
}

export default function OAuthButton({ provider, href }: OAuthButtonProps) {
  return (
    <a 
      href={href}
      className="border border-neutral-700 rounded p-2 text-center text-neutral-200 hover:border-neutral-500 block"
    >
      Continuar com {provider}
    </a>
  );
}