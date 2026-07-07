import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { fetchCsrfToken } from '../../api/userService';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  // Evita disparar o pedido duas vezes no StrictMode (dev) / re-renders.
  const hasRun = useRef(false);
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // O OAuthConflictRedirectFilter no backend redireciona para aqui com
    // ?error=account_conflict&email=... quando o mesmo email já tem conta
    // por outro método - mostramos uma mensagem clara em vez de tentar
    // continuar o login (que ia falhar de qualquer forma, sem sessão).
    const error = searchParams.get('error');
    if (error === 'account_conflict') {
      setConflictEmail(searchParams.get('email'));
      return;
    }

    (async () => {
      try {
        // O backend já definiu o cookie de sessão HttpOnly antes deste
        // redirect - só falta ir buscar um csrf token para o resto da app
        // poder fazer pedidos que alteram estado.
        const csrfToken = await fetchCsrfToken();
        login(csrfToken);
        navigate('/dashboard', { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate, login, searchParams]);

  if (conflictEmail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-neutral-100 mb-3">
            Account already exists
          </h1>
          <p className="text-neutral-400 mb-6">
            There's already an account with the email <strong>{conflictEmail}</strong>. Sign
            in with your original method, then link this provider from your profile settings.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-md bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <p className="text-neutral-400 animate-pulse">Authenticating...</p>
    </div>
  );
}