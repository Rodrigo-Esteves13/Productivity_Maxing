import { useEffect, useRef, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import ActionButton from '../UI/ActionButton';
import Avatar from './Avatar';
import { updateUserProfile, uploadAvatar, removeAvatar, setPasswordRequest } from '../../api/userService';
import type { User } from '../../types/models';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSaved: (user: User) => void;
  // Chamado só depois de mudar a password: atualiza o User global (para o
  // resto da app já saber que esta conta passou a ter password) SEM fechar
  // o modal, ao contrário de onSaved - a pessoa deve conseguir ver a
  // mensagem de sucesso antes de fechar manualmente.
  onUserUpdate?: (user: User) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, mesmo limite do backend
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function EditProfileModal({ isOpen, onClose, user, onSaved, onUserUpdate }: EditProfileModalProps) {
  const [name, setName] = useState(user.name ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Secção "Add/Change password" - ação independente do resto do form (não
  // pode ser um <form> aninhado dentro do form principal), por isso tem o
  // seu próprio estado e botão de submeter.
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  // Estado local, porque a prop `user` não é atualizada automaticamente
  // depois de setPasswordRequest ter sucesso (esse endpoint só devolve uma
  // mensagem, não o User) - ver sync com onSaved em handleSetPassword.
  const [hasPassword, setHasPassword] = useState(user.hasPassword);

  // Sempre que o modal abre, repõe tudo com os dados atuais do user.
  useEffect(() => {
    if (isOpen) {
      setName(user.name ?? '');
      setSelectedFile(null);
      setPreviewUrl(null);
      setRemovePhoto(false);
      setError('');
      setShowPasswordFields(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordError('');
      setPasswordSuccess(false);
      setHasPassword(user.hasPassword);
    }
  }, [isOpen, user]);

  // Gera o preview sempre que o ficheiro selecionado muda. Em vez de um
  // blob: URL diretamente sobre os bytes do ficheiro (URL.createObjectURL),
  // descodificamos a imagem através de um <canvas> e voltamos a exportá-la
  // com toDataURL(). Isto obriga o browser a interpretar o ficheiro como
  // pixels de imagem reais antes de o mostrarmos: um ficheiro "polyglot"
  // (bytes de imagem válidos + payload escondido a seguir) não sobrevive a
  // este round-trip, e ficheiros que não sejam mesmo imagens (apesar da
  // extensão/mimetype) são rejeitados aqui, antes de irem para o backend.
  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;

    createImageBitmap(selectedFile)
      .then((bitmap) => {
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
        bitmap.close();
        setPreviewUrl(canvas.toDataURL('image/png'));
      })
      .catch(() => {
        if (cancelled) return;
        setError('This file does not look like a valid image.');
        setSelectedFile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Use PNG, JPG, WEBP or GIF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 5MB.');
      return;
    }

    setError('');
    setRemovePhoto(false);
    setSelectedFile(file);
  };

  const handleRemovePhotoClick = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      let latestUser: User = user;

      // 1. Nome (só se mudou)
      if (trimmedName !== (user.name ?? '')) {
        latestUser = await updateUserProfile({ name: trimmedName });
      }

      // 2. Foto: upload de um ficheiro novo, ou remoção explícita
      if (selectedFile) {
        latestUser = await uploadAvatar(selectedFile);
      } else if (removePhoto && user.avatarUrl) {
        latestUser = await removeAvatar();
      }

      onSaved(latestUser);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Could not save your changes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPassword = async (e: FormEvent) => {
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
    } catch (err) {
      console.error('Failed to set password:', err);
      setPasswordError('Could not update your password. Please try again.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const initials = name ? name.substring(0, 2).toUpperCase() : user.email.substring(0, 2).toUpperCase();
  const displayedImage = previewUrl ?? (!removePhoto ? user.avatarUrl : null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar initials={initials} avatarUrl={displayedImage} alt="Avatar preview" size="md" />

          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
              id="avatar-upload"
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose Photo
              </Button>
              {displayedImage && (
                <Button type="button" variant="secondary" onClick={handleRemovePhotoClick}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-neutral-500">PNG, JPG, WEBP or GIF, up to 5MB.</p>
          </div>
        </div>

        <FormField label="Name" htmlFor="profile-name">
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </FormField>

        {error && <FormError message={error} />}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <ActionButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </ActionButton>
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-300 mb-2">
          {hasPassword ? 'Change Password' : 'Add a Password'}
        </h3>

        {!hasPassword && !showPasswordFields && !passwordSuccess && (
          <p className="text-xs text-neutral-500 mb-3">
            Your account currently signs in only through a connected provider. Add a password to
            also be able to log in with your email.
          </p>
        )}

        {passwordSuccess && (
          <p className="text-sm text-green-400 mb-3">Password updated successfully.</p>
        )}

        {!showPasswordFields ? (
          <Button type="button" variant="secondary" onClick={() => setShowPasswordFields(true)}>
            {hasPassword ? 'Change Password' : 'Add Password'}
          </Button>
        ) : (
          <form onSubmit={handleSetPassword} className="space-y-3">
            {passwordError && <FormError message={passwordError} />}

            <FormField label="New Password" htmlFor="new-password">
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FormField>

            <FormField label="Confirm New Password" htmlFor="confirm-new-password">
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="••••••••"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </FormField>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowPasswordFields(false);
                  setPasswordError('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              >
                Cancel
              </Button>
              <ActionButton type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? 'Saving...' : 'Save Password'}
              </ActionButton>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}