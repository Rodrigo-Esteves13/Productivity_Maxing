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
      setError('As passwords não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/auth/register', { name, email, password });
      const { token } = response.data;

      // Mesmo comportamento do Login: guarda o token e entra logo na conta
      login(token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Não foi possível criar a conta. Verifica os dados ou tenta outro email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <AuthCard title="Criar Conta">
        <form onSubmit={handleRegister} className="space-y-4">
          {error && <FormError message={error} />}

          <Input
            label="Nome"
            type="text"
            placeholder="O teu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
          <Input
            label="Confirmar Password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'A criar conta...' : 'Criar Conta'}
          </Button>
        </form>

        <AuthSwitchLink question="Já tens conta?" linkText="Entrar" to="/login" />

        <OAuthProviderList message="Ou cria conta com" />
      </AuthCard>
    </PageLayout>
  );
}
