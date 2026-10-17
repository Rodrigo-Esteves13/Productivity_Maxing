import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import AuthCard from '../components/Auth/AuthCard';
import TwoFactorCodeForm from '../components/Auth/TwoFactorCodeForm';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import { fillNodes } from '../i18n/fillNodes';

// Destino do login OAuth quando a conta tem 2FA: /login/2fa#token=...
// (o token vai no fragmento para nunca aparecer em logs de servidores).
export default function LoginTwoFactor() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.twoFactor.docTitle'));
  const navigate = useNavigate();
  const { login } = useAuth();

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('token');
  }, []);

  return (
    <PageLayout>
      <AuthCard title={t('auth.twoFactorTitle')}>
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
            {fillNodes(t('auth.twoFactor.expired'), {
              link: (
                <Link to="/login" className="underline text-violet-400 hover:text-violet-300">
                  {t('auth.backToLogin')}
                </Link>
              ),
            })}
          </p>
        )}
      </AuthCard>
    </PageLayout>
  );
}
