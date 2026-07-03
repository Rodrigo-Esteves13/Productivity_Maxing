import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Extraímos a função login do nosso novo Contexto
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // Usamos o hook! Ele atualiza o contexto, avisa o Navbar e guarda no localStorage sozinho
      login(token); 
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, login]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <p className="text-neutral-400 animate-pulse">Authenticating...</p>
    </div>
  );
}