import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';
import Input from '../components/Input';
import Button from '../components/Button';
import OAuthButton from '../components/OAuthButton';

const apiUrl = import.meta.env.VITE_API_URL;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleLogin() {
    setError(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (!data?.access_token) {
        console.error('Resposta sem access_token:', data);
        setError('Login falhou: resposta inesperada do servidor.');
        return;
      }
      localStorage.setItem('token', data.access_token);
      navigate('/dashboard');
    } catch (err) {
      console.error('Erro no login:', err);
      setError('Email ou password inválidos, ou o servidor não respondeu.');
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar isAuthenticated={false} />

      <div className="flex items-center justify-center py-24">
        <div className="w-full max-w-sm p-8 bg-neutral-900 rounded-xl shadow">
          <h1 className="text-xl font-bold mb-6 text-white">Entrar</h1>

          <div className="flex flex-col gap-3">
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
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button onClick={handleLogin}>Entrar</Button>
          </div>

          <div className="my-4 text-center text-sm text-neutral-500">ou</div>

          <div className="flex flex-col gap-2">
            <OAuthButton provider="Google" href={`${apiUrl}/auth/google`} />
            <OAuthButton provider="GitHub" href={`${apiUrl}/auth/github`} />
            <OAuthButton provider="Discord" href={`${apiUrl}/auth/discord`} />
          </div>
        </div>
      </div>
    </div>
  );
}