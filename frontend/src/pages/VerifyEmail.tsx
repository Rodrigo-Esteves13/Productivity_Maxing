import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import AuthCard from '../components/Auth/AuthCard';
import FormError from '../components/UI/FormError';
import { verifyEmailRequest } from '../api/userService';
import { getApiMessage } from '../lib/httpError';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import { fillNodes } from '../i18n/fillNodes';

type State = { kind: 'loading' } | { kind: 'ok'; email: string } | { kind: 'error'; message: string };

// Destino do link do email de verificacao: /verify-email?token=...
export default function VerifyEmail() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.verifyEmail.docTitle'));
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>(
    token ? { kind: 'loading' } : { kind: 'error', message: t('auth.verifyEmail.missingToken') },
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
            message: getApiMessage(err, t('auth.verifyEmail.invalid')),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <PageLayout>
      <AuthCard title={t('auth.verifyEmail.title')}>
        {state.kind === 'loading' && <p className="text-sm text-neutral-400">{t('auth.verifyEmail.verifying')}</p>}
        {state.kind === 'ok' && (
          <p className="text-sm text-neutral-300">
            {fillNodes(t('auth.verifyEmail.ok'), {
              email: <strong>{state.email}</strong>,
              link: (
                <Link to="/login" className="underline text-violet-400 hover:text-violet-300">
                  {t('auth.verifyEmail.logInLink')}
                </Link>
              ),
            })}
          </p>
        )}
        {state.kind === 'error' && (
          <>
            <FormError message={state.message} />
            <p className="mt-3 text-sm text-neutral-400">
              {fillNodes(t('auth.verifyEmail.errorHelp'), {
                link: (
                  <Link to="/login" className="underline text-violet-400 hover:text-violet-300">
                    {t('auth.verifyEmail.goLogin')}
                  </Link>
                ),
              })}
            </p>
          </>
        )}
      </AuthCard>
    </PageLayout>
  );
}
