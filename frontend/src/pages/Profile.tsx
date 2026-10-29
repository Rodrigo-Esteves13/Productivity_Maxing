import { useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useProfileStats } from '../hooks/useProfileStats';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import MasonryGrid from '../components/UI/MasonryGrid';
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
import OnThisPage, { SectionAnchor as Anchor } from '../components/Layout/OnThisPage';
import ActionButton from '../components/UI/ActionButton';
import { PencilIcon } from '../components/UI/Icons';
import { useAuth } from '../context/useAuth';
import { useI18n } from '../i18n/useI18n';

// Ancoras do "Nesta pagina": sao muitos cartoes de definicoes e a pagina
// e longa, sobretudo no telemovel (uma coluna).
const SECTIONS = [
  { id: 'calendar', labelKey: 'ui.googleCalendar' },
  { id: 'notifications', labelKey: 'prefs.notificationsTitle' },
  { id: 'install', labelKey: 'install.title' },
  { id: 'push', labelKey: 'push.title' },
  { id: 'two-factor', labelKey: 'ui.twoFactorAuthentication' },
  { id: 'appearance', labelKey: 'prefs.appearanceTitle' },
  { id: 'commute', labelKey: 'ui.commuteQuietHours' },
  { id: 'delete-account', labelKey: 'ui.dangerZone' },
] as const;

export default function Profile() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.profile'));
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

      <OnThisPage
        className="mb-4"
        items={SECTIONS.map((section) => ({ id: section.id, label: t(section.labelKey) }))}
      />

      <ProfileHeaderCard user={user} initials={initials} stats={stats} isLoadingStats={stats.isLoading} />

      {/* Duas colunas a partir de lg: numa so coluna de 768px a pagina tinha
          metade do ecra vazio e o dobro do scroll. Sem esticar o ultimo
          cartao de cada coluna (sao formularios, ficava um fundo vazio). */}
      <MasonryGrid stretchLast={false} className="mt-4">
        <Anchor id="calendar"><GoogleCalendarCard /></Anchor>
        <Anchor id="notifications"><PreferencesCard user={user} onUserUpdate={updateUser} /></Anchor>
        <Anchor id="install"><InstallAppCard alwaysShow className="" /></Anchor>
        <Anchor id="push"><PushNotificationsCard /></Anchor>
        <Anchor id="two-factor"><TwoFactorCard user={user} onUserUpdate={updateUser} /></Anchor>
        <Anchor id="appearance"><AccessibilitySettingsCard /></Anchor>
        <Anchor id="commute"><CommuteSettingsCard user={user} onUserUpdate={updateUser} /></Anchor>
      </MasonryGrid>

      <Anchor id="delete-account"><DeleteAccountSection onOpen={deleteAccount.open} /></Anchor>

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
