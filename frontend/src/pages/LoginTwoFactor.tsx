import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import AuthCard from '../components/Auth/AuthCard';
import TwoFactorCodeForm from '../components/Auth/TwoFactorCodeForm';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Destino do login OAuth quando a conta tem 2FA: /login/2fa#token=...
// (o token vai no fragmento para nunca aparecer em logs de servidores).
export default function LoginTwoFactor() {
  useDocumentTitle('Two-factor login');
  const navigate = useNavigate();
  const { login } = useAuth();

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('token');
  }, []);

  return (
    <PageLayout>
      <AuthCard title="Two-factor authentication">
        {token ? (
          <TwoFactorCodeForm
            token={token}
            onSuccess={(csrfToken) => {
              login(csrfToken);
              navigate('/dashboard', { replace: true });
            }}
          />
        ) : (
          <p className="text-sm text-neutral-400">
            This link has expired.{' '}
            <Link to="/login" className="underline text-violet-400 hover:text-violet-300">
              Back to login
            </Link>
          </p>
        )}
      </AuthCard>
    </PageLayout>
  );
}
