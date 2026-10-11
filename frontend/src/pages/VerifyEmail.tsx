import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import AuthCard from '../components/Auth/AuthCard';
import FormError from '../components/UI/FormError';
import { verifyEmailRequest } from '../api/userService';
import { getApiMessage } from '../lib/httpError';
import useDocumentTitle from '../hooks/useDocumentTitle';

type State = { kind: 'loading' } | { kind: 'ok'; email: string } | { kind: 'error'; message: string };

// Destino do link do email de verificacao: /verify-email?token=...
export default function VerifyEmail() {
  useDocumentTitle('Verify email');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>(
    token ? { kind: 'loading' } : { kind: 'error', message: 'This link is missing its token.' },
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmailRequest(token)
      .then(({ email }) => {
        if (!cancelled) setState({ kind: 'ok', email });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: getApiMessage(err, 'This verification link is invalid or has expired.'),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <PageLayout>
      <AuthCard title="Email verification">
        {state.kind === 'loading' && <p className="text-sm text-neutral-400">Verifying...</p>}
        {state.kind === 'ok' && (
          <p className="text-sm text-neutral-300">
            <strong>{state.email}</strong> is confirmed. You can now{' '}
            <Link to="/login" className="underline text-violet-400 hover:text-violet-300">
              log in
            </Link>
            .
          </p>
        )}
        {state.kind === 'error' && (
          <>
            <FormError message={state.message} />
            <p className="mt-3 text-sm text-neutral-400">
              Try logging in: you will be offered a new link.{' '}
              <Link to="/login" className="underline text-violet-400 hover:text-violet-300">
                Go to login
              </Link>
            </p>
          </>
        )}
      </AuthCard>
    </PageLayout>
  );
}
