import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { registerRequest, resendVerificationRequest } from '../api/userService';
import { useI18n } from '../i18n/useI18n';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import OAuthProviderList from '../components/Auth/OAuthProviderList';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';
import useSeo from '../hooks/useSeo';

export default function Register() {
  useSeo({
    title: 'Register',
    description: 'Create a free Productivity Maxing account to start tracking tasks, deadlines, and grades.',
    path: '/register',
  });
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Preenchido quando o backend exige verificacao de email: nao ha sessao,
  // so "vai ao teu email". Com a flag desligada nunca acontece.
  const { t } = useI18n();
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState('');

  const handleRegister = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordsMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerRequest({ name, email, password });
      if (result.requiresEmailVerification) {
        setPendingVerificationEmail(result.email);
        return;
      }
      const { csrfToken } = result;

      // Mesmo comportamento do Login: guarda o csrf token e entra logo na conta
      login(csrfToken);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Could not create the account. Check your details or try another email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingVerificationEmail) return;
    setResendMessage('');
    try {
      await resendVerificationRequest(pendingVerificationEmail);
      setResendMessage('If the email is still waiting for verification, a new link was sent.');
    } catch {
      setResendMessage('Could not resend right now. Try again in a minute.');
    }
  };

  if (pendingVerificationEmail) {
    return (
      <PageLayout>
        <AuthCard title={t('auth.checkEmail')}>
          <p className="text-sm text-neutral-300">
            We sent a confirmation link to <strong>{pendingVerificationEmail}</strong>. Open it to
            activate your account, then log in.
          </p>
          <Button type="button" className="w-full mt-4" onClick={handleResend}>
            {t('auth.resendEmail')}
          </Button>
          {resendMessage && <p className="mt-3 text-xs text-neutral-400">{resendMessage}</p>}
          <AuthSwitchLink question="Already confirmed?" linkText="Login" to="/login" />
        </AuthCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <AuthCard title={t('auth.registerTitle')}>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && <FormError message={error} />}

          <Input
            label={t('auth.name')}
            type="text"
            placeholder={t('auth.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={t('auth.email')}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t('auth.password')}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label={t('auth.confirmPassword')}
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <AuthSwitchLink question="Already have an account?" linkText="Login" to="/login" />

        <OAuthProviderList message="Or create an account with" />
      </AuthCard>
    </PageLayout>
  );
}
