import OAuthButton from './OAuthButton';
import { API_BASE_URL } from '../../api/apiBaseUrl';

interface OAuthProviderListProps {
  message: string;
}

const apiUrl = API_BASE_URL;

export default function OAuthProviderList({ message }: OAuthProviderListProps) {
  return (
    <div className="mt-8 pt-6 border-t border-neutral-800 space-y-3">
      <p className="text-center text-sm text-neutral-400 mb-4">{message}</p>

      <OAuthButton provider="GOOGLE" href={`${apiUrl}/auth/google`} />
      <OAuthButton provider="DISCORD" href={`${apiUrl}/auth/discord`} />
      <OAuthButton provider="GITHUB" href={`${apiUrl}/auth/github`} />
    </div>
  );
}
