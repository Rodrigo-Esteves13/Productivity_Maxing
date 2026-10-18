import { useState, type SyntheticEvent } from 'react';
import { forgotPasswordRequest } from '../api/userService';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';

export default function ForgotPassword() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.forgot.docTitle'));

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await forgotPasswordRequest(email);
      // Mostra sempre o mesmo resultado, exista ou não a conta - ver
      // comentário em forgotPasswordRequest.
      setSent(true);
    } catch {
      setError(t('auth.forgot.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <AuthCard title={t('auth.forgot.title')}>
        {sent ? (
          <p className="text-center text-neutral-300 text-sm">
            {t('auth.forgot.sent')}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <FormError message={error} />}

            <p className="text-sm text-neutral-400">
              {t('auth.forgot.intro')}
            </p>

            <Input
              label={t('auth.email')}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('auth.sending') : t('auth.forgot.send')}
            </Button>
          </form>
        )}

        <AuthSwitchLink question={t('auth.forgot.remembered')} linkText={t('auth.backToLogin')} to="/login" />
      </AuthCard>
    </PageLayout>
  );
}