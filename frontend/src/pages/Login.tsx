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
import useSeo from '../hooks/useSeo';

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

  const handleLogin = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); // Impede o browser de recarregar a página ao dar Enter!
    setError('');

    try {
      const { csrfToken } = await loginRequest(email, password);

      // Usa o hook para guardar o csrf token em memória e notificar a app
      login(csrfToken);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Invalid credentials or server error.');
    }
  };

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
