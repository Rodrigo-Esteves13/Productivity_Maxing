import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { loginRequest } from '../api/userService';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import OAuthProviderList from '../components/Auth/OAuthProviderList';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';
import AccountBlockedPage from '../components/AccountBlocked/AccountBlockedPage';
import useSeo from '../hooks/useSeo';

interface BlockedLoginInfo {
  message: string;
  appealToken: string;
}

export default function Login() {
  useSeo({
    title: 'Login',
    description: 'Log in to Productivity Maxing to manage your academic tasks, deadlines, and grades.',
    path: '/login',
  });
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Distinto de `error`: SUSPENDED/BANNED não é "credenciais erradas",
  // troca o formulário inteiro pelo mesmo ecrã de bloqueio usado a meio
  // de uma sessão (ver AccountBlockedGate.tsx) - só que aqui não existe
  // cookie nenhum ainda (o login falhou mesmo), por isso passamos o
  // appealToken de curta duração devolvido no próprio erro (ver
  // AuthService.accountBlockedResponse no backend).
  const [blockedInfo, setBlockedInfo] = useState<BlockedLoginInfo | null>(null);

  const handleLogin = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); // Impede o browser de recarregar a página ao dar Enter!
    setError('');

    try {
      const { csrfToken } = await loginRequest(email, password);

      // Usa o hook para guardar o csrf token em memória e notificar a app
      login(csrfToken);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      if (data?.code === 'ACCOUNT_BLOCKED' && typeof data.appealToken === 'string') {
        setBlockedInfo({
          message: typeof data.message === 'string' ? data.message : 'Your account is restricted.',
          appealToken: data.appealToken,
        });
        return;
      }
      setError('Invalid credentials or server error.');
    }
  };

  if (blockedInfo) {
    return (
      <AccountBlockedPage
        bearerToken={blockedInfo.appealToken}
        initialMessage={blockedInfo.message}
      />
    );
  }

  return (
    <PageLayout>
      <AuthCard title="Login to Your Account">
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <FormError message={error} />}

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
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
          <div className="text-right -mt-2">
            <Link to="/forgot-password" className="text-sm text-violet-400 hover:text-violet-300">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>

        <AuthSwitchLink question="Don't have an account yet?" linkText="Sign up" to="/register" />

        <OAuthProviderList message="Or sign in with your accounts" />
      </AuthCard>
    </PageLayout>
  );
}
