import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import { completePasswordLinkRequest } from '../api/userService';
import { getApiCode } from '../lib/httpError';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import { fillNodes } from '../i18n/fillNodes';

const PASSWORD_MIN_LENGTH = 8;
const REDIRECT_DELAY_MS = 2500;
const INVALID_LINK_CODE = 'INVALID_PASSWORD_LINK';

// Destino do link "adicionar password" (/set-password?token=...), enviado
// pelo backend quando alguem se regista ou pede "esqueci a password" com o
// email de uma conta criada por Google/GitHub/Discord. A password escolhida
// aqui fica ligada a essa mesma conta. Nao abre sessao: depois e o login
// normal (com 2FA, se a conta o tiver).
export default function SetPassword() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.setPassword.docTitle'));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!token) return;

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t('auth.reset.tooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { email } = await completePasswordLinkRequest(token, password);
      setLinkedEmail(email);
      setTimeout(() => navigate('/login', { replace: true }), REDIRECT_DELAY_MS);
    } catch (err) {
      if (getApiCode(err) === INVALID_LINK_CODE) {
        setLinkInvalid(true);
        return;
      }
      setError(t('auth.setPassword.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkedEmail) {
    return (
      <PageLayout>
        <AuthCard title={t('auth.setPassword.doneTitle')}>
          <p className="text-center text-neutral-300 text-sm">
            {fillNodes(t('auth.setPassword.done'), { email: <strong>{linkedEmail}</strong> })}
          </p>
        </AuthCard>
      </PageLayout>
    );
  }

  if (linkInvalid) {
    return (
      <PageLayout>
        <AuthCard title={t('auth.reset.expiredTitle')}>
          <p className="text-center text-neutral-300 text-sm mb-4">{t('auth.setPassword.invalid')}</p>
          <Link
            to="/forgot-password"
            className="block text-center text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            {t('auth.reset.requestNew')}
          </Link>
        </AuthCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <AuthCard title={t('auth.setPassword.title')}>
        <p className="text-sm text-neutral-400 mb-4">{t('auth.setPassword.intro')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <FormError message={error} />}

          <Input
            label={t('auth.reset.newPassword')}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label={t('auth.reset.confirm')}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('auth.setPassword.saving') : t('auth.setPassword.submit')}
          </Button>
        </form>
      </AuthCard>
    </PageLayout>
  );
}
