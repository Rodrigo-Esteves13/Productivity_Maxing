import { useState, type SyntheticEvent  } from 'react';
import { setPasswordRequest } from '../api/userService';
import type { User } from '../types/models';

export interface UsePasswordFormOptions {
  user: User;
  onUserUpdate?: (user: User) => void;
}

export interface UsePasswordFormResult {
  showPasswordFields: boolean;
  newPassword: string;
  confirmNewPassword: string;
  passwordError: string;
  passwordSuccess: boolean;
  isSavingPassword: boolean;
  hasPassword: boolean;
  setShowPasswordFields: (value: boolean) => void;
  setNewPassword: (value: string) => void;
  setConfirmNewPassword: (value: string) => void;
  handleCancel: () => void;
  handleSetPassword: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  reset: (hasPassword: boolean) => void;
}

/**
 * Secção "Add/Change password": ação independente do resto do form (não
 * pode ser um <form> aninhado dentro do form principal), por isso tem o
 * seu próprio estado e submissão.
 *
 * `hasPassword` é mantido em estado local porque a prop `user` não é
 * atualizada automaticamente depois de setPasswordRequest ter sucesso (esse
 * endpoint só devolve uma mensagem, não o User).
 */
export function usePasswordForm({ user, onUserUpdate }: UsePasswordFormOptions): UsePasswordFormResult {
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(user.hasPassword);

  const handleCancel = () => {
    setShowPasswordFields(false);
    setPasswordError('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleSetPassword = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await setPasswordRequest(newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordFields(false);
      setHasPassword(true);
      // Atualiza o User global sem fechar o modal (onUserUpdate), ao
      // contrário de onSaved que a Profile.tsx usa para fechar o modal
      // depois de guardar Nome/Foto.
      onUserUpdate?.({ ...user, hasPassword: true });
    } catch {
      // CORREÇÃO DE SEGURANÇA: não passar o objeto de erro ao console.error.
      // Um AxiosError inclui `error.config.data`, que é o corpo do pedido
      // que falhou - ou seja, a própria password em texto plano que o
      // utilizador acabou de escrever. Ficaria visível na consola do
      // browser e, pior, seria capturado automaticamente por qualquer
      // ferramenta de monitorização de erros do frontend (Sentry e
      // semelhantes costumam serializar objetos passados a console.error).
      setPasswordError('Could not update your password. Please try again.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const reset = (nextHasPassword: boolean) => {
    setShowPasswordFields(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordError('');
    setPasswordSuccess(false);
    setHasPassword(nextHasPassword);
  };

  return {
    showPasswordFields,
    newPassword,
    confirmNewPassword,
    passwordError,
    passwordSuccess,
    isSavingPassword,
    hasPassword,
    setShowPasswordFields,
    setNewPassword,
    setConfirmNewPassword,
    handleCancel,
    handleSetPassword,
    reset,
  };
}
