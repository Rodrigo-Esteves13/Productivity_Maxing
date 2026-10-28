import OAuthButton from './OAuthButton';
import { API_BASE_URL } from '../../api/apiBaseUrl';
import { rememberPostAuthRedirect } from '../../lib/postAuthRedirect';

interface OAuthProviderListProps {
  message: string;
  /** Destino depois do login (ex: ?redirect= de um link de convite). */
  returnTo?: string | null;
}

const apiUrl = API_BASE_URL;

export default function OAuthProviderList({ message, returnTo }: OAuthProviderListProps) {
  const remember = () => rememberPostAuthRedirect(returnTo);
  return (
    <div className="mt-8 pt-6 border-t border-neutral-800 space-y-3">
      <p className="text-center text-sm text-neutral-400 mb-4">{message}</p>

      <OAuthButton provider="GOOGLE" href={`${apiUrl}/auth/google`} onClick={remember} />
      <OAuthButton provider="DISCORD" href={`${apiUrl}/auth/discord`} onClick={remember} />
      <OAuthButton provider="GITHUB" href={`${apiUrl}/auth/github`} onClick={remember} />
    </div>
  );
}
