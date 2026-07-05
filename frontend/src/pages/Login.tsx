import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { loginRequest } from '../api/userService';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import OAuthProviderList from '../components/Auth/OAuthProviderList';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Login() {
  useDocumentTitle('Login');
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
