import { Suspense, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { lazyWithPreload } from '../lib/lazyWithPreload';
import type { User } from '../types/models';
import { wasPushPromptAnswered } from './pushPromptStorage';

const PushPromptDialog = lazyWithPreload(() => import('./PushPromptDialog'));

// Montado uma vez (AppRouter). Pede as notificacoes logo ao entrar, em vez
// de as deixar escondidas no Profile, mas so quando faz sentido: sessao
// iniciada, browser com push, servidor configurado, notificacoes ainda
// desligadas neste dispositivo e a pergunta ainda sem resposta.
export default function PushPermissionPrompt() {
  const { isAuthenticated, user, updateUser } = useAuth();
  if (!isAuthenticated || !user) return null;
  // key: trocar de conta no mesmo browser volta a ler a resposta dessa conta.
  return <PushPromptGate key={user.id} user={user} onUserUpdate={updateUser} />;
}

interface GateProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

function PushPromptGate({ user, onUserUpdate }: GateProps) {
  const [isAnswered, setIsAnswered] = useState(() => wasPushPromptAnswered(user.id));
  if (isAnswered) return null;
  // So monta o dialogo (e o GET /push/public-key) enquanto falta resposta.
  return (
    <Suspense fallback={null}>
      <PushPromptDialog user={user} onUserUpdate={onUserUpdate} onDone={() => setIsAnswered(true)} />
    </Suspense>
  );
}
