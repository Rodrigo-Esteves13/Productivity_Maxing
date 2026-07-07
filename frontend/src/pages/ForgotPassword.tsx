import { useState, type SyntheticEvent } from 'react';
import { forgotPasswordRequest } from '../api/userService';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function ForgotPassword() {
  useDocumentTitle('Forgot Password');

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
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <AuthCard title="Reset Your Password">
        {sent ? (
          <p className="text-center text-neutral-300 text-sm">
            If an account with that email exists, we've sent a link to reset your password.
            Check your inbox (and spam folder).
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <FormError message={error} />}

            <p className="text-sm text-neutral-400">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        )}

        <AuthSwitchLink question="Remembered your password?" linkText="Back to login" to="/login" />
      </AuthCard>
    </PageLayout>
  );
}