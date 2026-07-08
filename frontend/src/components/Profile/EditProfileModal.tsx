import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import ActionButton from '../UI/ActionButton';
import AvatarUploadField from './AvatarUploadField';
import PasswordSection from './PasswordSection';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { usePasswordForm } from '../../hooks/usePasswordForm';
import { updateUserProfile, uploadAvatar, removeAvatar } from '../../api/userService';
import type { User } from '../../types/models';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSaved: (user: User) => void;
  // Chamado só depois de mudar a password: atualiza o User global (para o
  // resto da app já saber que esta conta passou a ter password) SEM fechar
  // o modal, ao contrário de onSaved, a pessoa deve conseguir ver a
  // mensagem de sucesso antes de fechar manualmente.
  onUserUpdate?: (user: User) => void;
}

export default function EditProfileModal({ isOpen, onClose, user, onSaved, onUserUpdate }: EditProfileModalProps) {
  const [name, setName] = useState(user.name ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const avatar = useAvatarUpload();
  const passwordForm = usePasswordForm({ user, onUserUpdate });

  // Sempre que o modal abre, repõe tudo com os dados atuais do user.
  useEffect(() => {
    if (isOpen) {
      setName(user.name ?? '');
      setError('');
      avatar.reset();
      passwordForm.reset(user.hasPassword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  useEffect(() => {
    if (avatar.error) setError(avatar.error);
  }, [avatar.error]);

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
      if (avatar.selectedFile) {
        latestUser = await uploadAvatar(avatar.selectedFile);
      } else if (avatar.removePhoto && user.avatarUrl) {
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

  const initials = name ? name.substring(0, 2).toUpperCase() : user.email.substring(0, 2).toUpperCase();
  const displayedImage = avatar.previewUrl ?? (!avatar.removePhoto ? user.avatarUrl : null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <form onSubmit={handleSubmit} className="space-y-5">
        <AvatarUploadField
          initials={initials}
          displayedImage={displayedImage}
          fileInputRef={avatar.fileInputRef}
          onFileChange={avatar.handleFileChange}
          onRemoveClick={avatar.handleRemovePhotoClick}
        />

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

      <PasswordSection
        hasPassword={passwordForm.hasPassword}
        showPasswordFields={passwordForm.showPasswordFields}
        newPassword={passwordForm.newPassword}
        confirmNewPassword={passwordForm.confirmNewPassword}
        passwordError={passwordForm.passwordError}
        passwordSuccess={passwordForm.passwordSuccess}
        isSavingPassword={passwordForm.isSavingPassword}
        onShowFields={() => passwordForm.setShowPasswordFields(true)}
        onCancel={passwordForm.handleCancel}
        onNewPasswordChange={passwordForm.setNewPassword}
        onConfirmPasswordChange={passwordForm.setConfirmNewPassword}
        onSubmit={passwordForm.handleSetPassword}
      />
    </Modal>
  );
}
