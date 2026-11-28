import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAccount } from '../api/userService';
import { useAuth } from '../context/useAuth';
import { translateNow } from '../i18n/translate';
import { removeAccountStorage } from '../lib/storageKeys';

const CONFIRM_TEXT = 'DELETE';

export function useDeleteAccount() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => setIsOpen(true);

  const close = () => {
    setIsOpen(false);
    setConfirmText('');
    setError(null);
  };

  const confirm = async () => {
    if (confirmText !== CONFIRM_TEXT) return;
    setIsDeleting(true);
    setError(null);
    const userId = user?.id;
    try {
      await deleteAccount();
      // O backend já limpou o cookie de sessão; logout() trata do estado
      // local (csrf token em memória, user, isAuthenticated) e não faz mal
      // nenhum voltar a chamar /auth/logout com um cookie já inexistente.
      await logout();
      // Conta apagada: saem tambem as chaves com o id dela.
      if (userId) removeAccountStorage(userId);
      navigate('/login', { replace: true });
    } catch {
      setError(translateNow('hook.couldNotDeleteYourAccountPlease'));
      setIsDeleting(false);
    }
  };

  return {
    isOpen,
    confirmText,
    isDeleting,
    error,
    isConfirmEnabled: confirmText === CONFIRM_TEXT,
    setConfirmText,
    open,
    close,
    confirm,
  };
}
