import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Vai buscar o token ao URL (?token=eyJ...)
    const token = searchParams.get('token');

    if (token) {
      // 2. Guarda o token no navegador
      localStorage.setItem('token', token);
      
      // 3. Redireciona para o dashboard e limpa o histórico
      navigate('/dashboard', { replace: true });
    } else {
      // Se por algum motivo não houver token, manda de volta para o login
      navigate('/', { replace: true });
    }
  }, [navigate, searchParams]);

  // Um ecrã de loading muito simples para a fração de segundo que isto demora
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
      <p>A finalizar autenticação...</p>
    </div>
  );
}