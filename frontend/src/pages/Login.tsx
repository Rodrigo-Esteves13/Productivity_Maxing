import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import OAuthProviderList from '../components/Auth/OAuthProviderList';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
      <AuthCard title="Entrar na Conta">
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <FormError message={error} />}

          <Input
            label="Email"
            type="email"
            placeholder="tu@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>

        <AuthSwitchLink question="Ainda não tens conta?" linkText="Criar conta" to="/register" />

        <OAuthProviderList message="Ou entra com as tuas contas" />
      </AuthCard>
    </PageLayout>
  );
}
