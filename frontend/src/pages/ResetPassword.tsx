import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Página pública para onde o link do email de recuperação do Supabase
// redireciona (ver redirectTo em AuthService.forgotPassword). O Supabase
// coloca o access_token de recovery no fragmento da URL e o cliente
// (detectSessionInUrl: true) processa-o automaticamente ao carregar - por
// isso esperamos por onAuthStateChange/getSession antes de mostrar o
// formulário, em vez de assumir logo que a sessão já está pronta.
export default function ResetPassword() {
  useDocumentTitle('Reset Password');
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        readyRef.current = true;
        setReady(true);
      }
    });

    // Cobre o caso de a sessão já ter sido processada antes deste efeito
    // correr (ex: em StrictMode/re-render) - o evento acima pode não
    // disparar de novo, por isso confirmamos diretamente.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        readyRef.current = true;
        setReady(true);
      }
    });

    // Se ao fim de alguns segundos nada tiver confirmado uma sessão, o
    // link é inválido ou já expirou (os links de recovery do Supabase
    // duram pouco tempo).
    const timeout = setTimeout(() => {
      if (!readyRef.current) setLinkInvalid(true);
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Não queremos deixar uma sessão Supabase viva no browser - a app
      // usa sempre o nosso cookie HttpOnly, nunca a sessão do Supabase.
      await supabase.auth.signOut();
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch {
      setError('Something went wrong. Please request a new reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <PageLayout>
        <AuthCard title="Password Updated">
          <p className="text-center text-neutral-300 text-sm">
            Your password has been updated. Redirecting to login...
          </p>
        </AuthCard>
      </PageLayout>
    );
  }

  if (linkInvalid) {
    return (
      <PageLayout>
        <AuthCard title="Link Expired">
          <p className="text-center text-neutral-300 text-sm mb-4">
            This password reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="block text-center text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            Request a new link
          </Link>
        </AuthCard>
      </PageLayout>
    );
  }

  if (!ready) {
    return (
      <PageLayout>
        <AuthCard title="Reset Your Password">
          <p className="text-center text-neutral-400 text-sm animate-pulse">Verifying link...</p>
        </AuthCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <AuthCard title="Set a New Password">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <FormError message={error} />}

          <Input
            label="New Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </AuthCard>
    </PageLayout>
  );
}