import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAccount } from '../api/userService';
import { useAuth } from '../context/useAuth';

const CONFIRM_TEXT = 'DELETE';

export function useDeleteAccount() {
  const { logout } = useAuth();
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
    try {
      await deleteAccount();
      // O backend já limpou o cookie de sessão; logout() trata do estado
      // local (csrf token em memória, user, isAuthenticated) e não faz mal
      // nenhum voltar a chamar /auth/logout com um cookie já inexistente.
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setError('Could not delete your account. Please try again.');
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
