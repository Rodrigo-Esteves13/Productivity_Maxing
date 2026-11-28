import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import { AlertTriangleIcon, ClockIcon } from '../UI/Icons';
import AppealProgress from './AppealProgress';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';
import { appealState, formatRemaining } from '../../lib/accountBlocked';
import type { AccountStatusInfo } from '../../types/models';

function formatDate(value: string | null, lang: string, unknownLabel: string): string {
  if (!value) return unknownLabel;
  return new Date(value).toLocaleString(lang);
}

interface DetailsProps {
  data: AccountStatusInfo;
  message: string;
  setMessage: (value: string) => void;
  submitting: boolean;
  submitError: string | null;
  justSubmittedAt: string | null;
  onSubmit: () => void;
  onLogout: () => void;
}

export default function AccountBlockedDetails({
  data,
  message,
  setMessage,
  submitting,
  submitError,
  justSubmittedAt,
  onSubmit,
  onLogout,
}: DetailsProps) {
  const { t, lang } = useI18n();
  const isBanned = data.status === 'BANNED';
  const accentText = isBanned ? 'text-red-400' : 'text-amber-400';

  const { pendingAppeal, resolvedAppeal, availability, cooldownActive, canSubmitNewAppeal } = appealState(
    data,
    justSubmittedAt,
  );

  return (
    <>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-6 text-left space-y-2">
        {!isBanned && (
          <div className="flex items-start gap-2 text-sm text-neutral-300">
            <ClockIcon className="h-4 w-4 shrink-0 mt-0.5 text-neutral-500" />
            <span>{t('ui.suspendedUntil2', { suspendedUntil: formatDate(data.suspendedUntil, lang, t('ui.unknownDate')) })}</span>
          </div>
        )}
        <div className="flex items-start gap-2 text-sm text-neutral-300">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 mt-0.5 text-neutral-500" />
          <span>{data.statusReason || t('ui.noReasonWasGiven')}</span>
        </div>
        <p className="text-xs text-neutral-500 pt-1">
          {t('ui.lastUpdated', { statusUpdatedAt: formatDate(data.statusUpdatedAt, lang, t('ui.unknownDate')) })}</p>
      </div>

      {availability && (
        <AppealProgress availability={availability} accentText={accentText} isBanned={isBanned} />
      )}

      {pendingAppeal && (
        <p className="text-sm text-neutral-400 mb-6">
          {t('ui.yourAppealWasSubmittedOn', { createdAt: formatDate(pendingAppeal.createdAt, lang, t('ui.unknownDate')) })}</p>
      )}

      {resolvedAppeal && resolvedAppeal.resolution === 'DENIED' && (
        <p className="text-sm text-neutral-400 mb-4">
          {resolvedAppeal.resolutionNote
            ? t('ui.appealDeniedOnNote', { date: formatDate(resolvedAppeal.resolvedAt, lang, t('ui.unknownDate')), note: resolvedAppeal.resolutionNote })
            : t('ui.appealDeniedOn', { date: formatDate(resolvedAppeal.resolvedAt, lang, t('ui.unknownDate')) })}
        </p>
      )}

      {resolvedAppeal && resolvedAppeal.resolution === 'APPROVED' && (
        <p className="text-sm text-neutral-400 mb-6">
          {t('ui.yourAppealWasApprovedOn', { resolvedAt: formatDate(resolvedAppeal.resolvedAt, lang, t('ui.unknownDate')) })}</p>
      )}

      {!pendingAppeal && availability?.appealsExhausted && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 mb-6 text-sm text-neutral-400">
          {t(isBanned ? 'ui.appealsExhaustedBan' : 'ui.appealsExhaustedSuspension', { max: availability.maxAppeals })}
        </div>
      )}

      {!pendingAppeal && !availability?.appealsExhausted && cooldownActive && availability && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 mb-6 text-sm text-neutral-400">
          {fillNodes(t('ui.finalAppealIn'), {
            time: (
              <span className={`font-semibold ${accentText}`}>
                {formatRemaining(availability.nextAppealAllowedAt as string)}
              </span>
            ),
          })}
        </div>
      )}

      {canSubmitNewAppeal && (
        <div className="text-left mb-6">
          <Textarea
            label={t('ui.appealThisDecision')}
            placeholder={t('ui.explainWhyYouBelieveThis')}
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
          />
          {submitError && <p className="mt-2 text-sm text-red-400">{submitError}</p>}
          <Button className="mt-3 w-full" onClick={onSubmit} disabled={submitting}>
            {submitting ? t('ui.submitting') : t('ui.submitAppeal')}
          </Button>
        </div>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={onLogout}
          className="text-sm text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
        >
          {t('ui.logOut')}
        </button>
      </div>
    </>
  );
}
