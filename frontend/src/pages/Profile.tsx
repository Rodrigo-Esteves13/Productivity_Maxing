import { useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useProfileStats } from '../hooks/useProfileStats';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ProfileHeaderCard from '../components/Profile/ProfileHeaderCard';
import DeleteAccountSection from '../components/Profile/DeleteAccountSection';
import GoogleCalendarCard from '../components/Profile/GoogleCalendarCard';
import AccessibilitySettingsCard from '../components/Profile/AccessibilitySettingsCard';
import DeleteAccountModal from '../components/Profile/DeleteAccountModal';
import EditProfileModal from '../components/Profile/EditProfileModal';
import FormSkeleton from '../components/UI/FormSkeleton';
import ActionButton from '../components/UI/ActionButton';
import { PencilIcon } from '../components/UI/Icons';
import { useAuth } from '../context/useAuth';

export default function Profile() {
  useDocumentTitle('Profile');
  const { user, isLoadingUser, updateUser } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const stats = useProfileStats();
  const deleteAccount = useDeleteAccount();

  if (isLoadingUser || !user) {
    return (
      <PageLayout>
        <PageHeader title="User Profile" description="Manage your personal information and settings." />
        <FormSkeleton sections={4} />
      </PageLayout>
    );
  }

  const initials = user.name ? user.name.substring(0, 2).toUpperCase() : user.email.substring(0, 2).toUpperCase();

  return (
    <PageLayout>
      <PageHeader
        title="User Profile"
        description="Manage your personal information and settings."
        action={
          <ActionButton onClick={() => setIsEditOpen(true)} className="flex items-center gap-2">
            <PencilIcon />
            Edit Profile
          </ActionButton>
        }
      />

      <ProfileHeaderCard user={user} initials={initials} stats={stats} isLoadingStats={stats.isLoading} />

      <GoogleCalendarCard />

      <AccessibilitySettingsCard />

      <DeleteAccountSection onOpen={deleteAccount.open} />

      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={user}
        onSaved={(updatedUser) => {
          updateUser(updatedUser);
          setIsEditOpen(false);
        }}
        onUserUpdate={updateUser}
      />

      {deleteAccount.isOpen && (
        <DeleteAccountModal
          confirmText={deleteAccount.confirmText}
          isDeleting={deleteAccount.isDeleting}
          isConfirmEnabled={deleteAccount.isConfirmEnabled}
          error={deleteAccount.error}
          onConfirmTextChange={deleteAccount.setConfirmText}
          onCancel={deleteAccount.close}
          onConfirm={deleteAccount.confirm}
        />
      )}
    </PageLayout>
  );
}
