import { useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useProfileStats } from '../hooks/useProfileStats';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ProfileHeaderCard from '../components/Profile/ProfileHeaderCard';
import DeleteAccountSection from '../components/Profile/DeleteAccountSection';
import GoogleCalendarCard from '../components/Profile/GoogleCalendarCard';
import PreferencesCard from '../components/Profile/PreferencesCard';
import PushNotificationsCard from '../components/Profile/PushNotificationsCard';
import InstallAppCard from '../pwa/InstallAppCard';
import TwoFactorCard from '../components/Profile/TwoFactorCard';
import AccessibilitySettingsCard from '../components/Profile/AccessibilitySettingsCard';
import CommuteSettingsCard from '../components/Schedule/CommuteSettingsCard';
import DeleteAccountModal from '../components/Profile/DeleteAccountModal';
import EditProfileModal from '../components/Profile/EditProfileModal';
import FormSkeleton from '../components/UI/FormSkeleton';
import ActionButton from '../components/UI/ActionButton';
import { PencilIcon } from '../components/UI/Icons';
import { useAuth } from '../context/useAuth';
import { useI18n } from '../i18n/useI18n';

export default function Profile() {
  const { t } = useI18n();
  useDocumentTitle('Profile');
  const { user, isLoadingUser, updateUser } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const stats = useProfileStats();
  const deleteAccount = useDeleteAccount();

  if (isLoadingUser || !user) {
    return (
      <PageLayout>
        <PageHeader title={t('ui.userProfile')} description={t('ui.manageYourPersonalInformationAnd')} />
        <FormSkeleton sections={4} />
      </PageLayout>
    );
  }

  const initials = user.name ? user.name.substring(0, 2).toUpperCase() : user.email.substring(0, 2).toUpperCase();

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.userProfile')}
        description={t('ui.manageYourPersonalInformationAnd')}
        action={
          <ActionButton onClick={() => setIsEditOpen(true)} className="flex items-center gap-2">
            <PencilIcon />
            {t('ui.editProfile')}
          </ActionButton>
        }
      />

      <ProfileHeaderCard user={user} initials={initials} stats={stats} isLoadingStats={stats.isLoading} />

      <GoogleCalendarCard />

      <PreferencesCard user={user} onUserUpdate={updateUser} />
      <InstallAppCard alwaysShow className="max-w-3xl mt-8" />
      <PushNotificationsCard />

      <TwoFactorCard user={user} onUserUpdate={updateUser} />

      <AccessibilitySettingsCard />

      <CommuteSettingsCard user={user} onUserUpdate={updateUser} />

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
