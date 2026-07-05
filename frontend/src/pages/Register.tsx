import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api/client';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import AuthCard from '../components/Auth/AuthCard';
import OAuthProviderList from '../components/Auth/OAuthProviderList';
import AuthSwitchLink from '../components/Auth/AuthSwitchLink';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/auth/register', { name, email, password });
      const { token } = response.data;

      // Mesmo comportamento do Login: guarda o token e entra logo na conta
      login(token);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Could not create the account. Check your details or try another email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <AuthCard title="Create Account">
        <form onSubmit={handleRegister} className="space-y-4">
          {error && <FormError message={error} />}

          <Input
            label="Name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <AuthSwitchLink question="Already have an account?" linkText="Login" to="/login" />

        <OAuthProviderList message="Or create an account with" />
      </AuthCard>
    </PageLayout>
  );
}
