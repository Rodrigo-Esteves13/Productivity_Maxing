import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { fetchCsrfToken } from '../../api/userService';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  // Evita disparar o pedido duas vezes no StrictMode (dev) / re-renders.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

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
  }, [navigate, login]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <p className="text-neutral-400 animate-pulse">Authenticating...</p>
    </div>
  );
}
