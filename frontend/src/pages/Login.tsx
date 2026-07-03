import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import OAuthButton from '../components/Auth/OAuthButton';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Login() {
  const navigate = useNavigate();
  // hook
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // O evento agora é do tipo FormEvent
  const handleLogin = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); // Impede o browser de recarregar a página ao dar Enter!
    setError('');

    try {
      // Se ainda não tens login manual no backend, isto é um placeholder.
      // O teu foco atual são os botões OAuth (Google/Discord) cá em baixo.
      const response = await api.post('/auth/login', { email, password });
      const { token } = response.data;
      
      // Usa o hook para guardar o token e notificar a app
      login(token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Credenciais inválidas ou erro no servidor.');
    }
  };

  return (
    <PageLayout>
      <div className="max-w-md mx-auto mt-20 bg-neutral-900/50 p-8 border border-neutral-800 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Entrar na Conta</h2>
        
        {/* 4. O formulário que permite submissão com a tecla Enter */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}
          
          <Input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <Input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          
          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-neutral-800 space-y-3">
          <p className="text-center text-sm text-neutral-400 mb-4">Ou entra com as tuas contas</p>
          
          {/* Usamos o teu OAuthButton e o Enum Provider */}
          <OAuthButton provider="GOOGLE" href={`${apiUrl}/auth/google`} />
          <OAuthButton provider="DISCORD" href={`${apiUrl}/auth/discord`} />
          <OAuthButton provider="GITHUB" href={`${apiUrl}/auth/github`} />
        </div>
      </div>
    </PageLayout>
  );
}