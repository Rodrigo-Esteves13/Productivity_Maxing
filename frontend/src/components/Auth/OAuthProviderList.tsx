import OAuthButton from './OAuthButton';

interface OAuthProviderListProps {
  message: string;
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
