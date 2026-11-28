import { useState } from 'react';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import UserStatusBadge from '../Users/UserStatusBadge';
import type { AppealAdmin, AppealResolution, UserStatus } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface AppealRowProps {
  appeal: AppealAdmin;
  onResolve: (id: string, resolution: AppealResolution, resolutionNote?: string) => Promise<void>;
  // Linha do historico: mostra a decisao em vez dos botoes.
  readOnly?: boolean;
}

// Faixa lateral colorida por severidade - mesma cor que UserStatusBadge já
// usa para BANNED/SUSPENDED, só que aqui carrega a informação sem precisar
// de outra borda inteira à volta do cartão. ACTIVE não deveria acontecer
// (um appeal só existe enquanto a conta está restringida), mas o tipo
// UserStatus inclui-o, daí o fallback neutro.
const ACCENT: Record<UserStatus, string> = {
  BANNED: 'border-l-red-600',
  SUSPENDED: 'border-l-amber-500',
  ACTIVE: 'border-l-neutral-700',
};

export default function AppealRow({ appeal, onResolve, readOnly = false }: AppealRowProps) {
  const { t, lang } = useI18n();
  const [note, setNote] = useState('');
  const [showNoteFor, setShowNoteFor] = useState<AppealResolution | null>(null);
  // Enquanto o pedido segue os botoes ficam desativados (sem duplo envio).
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A linha sai da lista no mesmo render (remocao otimista em
  // useAppealsPage); o estado so cobre o instante ate sair, e o caso em que
  // falha e a linha volta (volta montada de novo, com os botoes livres).
  const confirm = async (resolution: AppealResolution) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onResolve(appeal.id, resolution, note.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-lg border-y border-r border-neutral-800 bg-neutral-900 p-4 border-l-4 ${ACCENT[appeal.statusAtSubmission]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white font-medium">
            {appeal.user.name ?? appeal.user.email}
          </p>
          <p className="text-xs text-neutral-500">{appeal.user.email}</p>
        </div>
        <UserStatusBadge status={appeal.statusAtSubmission} />
      </div>

      {appeal.reasonAtSubmission && (
        <p className="mt-3 text-xs text-neutral-500 break-words">
          {t('ui.originalReason', { reasonAtSubmission: appeal.reasonAtSubmission })}</p>
      )}

      <p className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap break-words leading-relaxed">
        {appeal.message}
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        {t('ui.submitted', { newDate: new Date(appeal.createdAt).toLocaleString(lang) })}</p>

      {readOnly ? (
        <div className="mt-4 space-y-1 border-t border-neutral-800 pt-3 text-xs text-neutral-400">
          <p className="font-medium text-neutral-200">
            {appeal.resolution === null
              ? t('quickWins.appealStillPending')
              : t(appeal.resolution === 'APPROVED' ? 'quickWins.appealResolvedApproved' : 'quickWins.appealResolvedDenied')}
          </p>
          {appeal.resolvedAt && (
            <p>
              {t('quickWins.appealResolvedOn', {
                date: new Date(appeal.resolvedAt).toLocaleString(lang),
                name: appeal.resolvedBy ? (appeal.resolvedBy.name ?? appeal.resolvedBy.email) : '-',
              })}
            </p>
          )}
          {appeal.resolutionNote && <p className="whitespace-pre-wrap break-words">{appeal.resolutionNote}</p>}
        </div>
      ) : showNoteFor ? (
        <div className="mt-4">
          <Textarea
            label={t(showNoteFor === 'APPROVED' ? 'ui.appealNoteApproving' : 'ui.appealNoteDenying')}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant={showNoteFor === 'APPROVED' ? 'primary' : 'secondary'}
              className={showNoteFor === 'DENIED' ? 'border-red-800 text-red-400' : ''}
              disabled={isSubmitting}
              onClick={() => void confirm(showNoteFor)}
            >
              {t(showNoteFor === 'APPROVED' ? 'ui.confirmApprove' : 'ui.confirmDeny')}
            </Button>
            <Button variant="secondary" disabled={isSubmitting} onClick={() => setShowNoteFor(null)}>
              {t('ui.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button disabled={isSubmitting} onClick={() => setShowNoteFor('APPROVED')}>
            {t('ui.approve')}
          </Button>
          <Button
            variant="secondary"
            className="border-red-800 text-red-400"
            disabled={isSubmitting}
            onClick={() => setShowNoteFor('DENIED')}
          >
            {t('ui.deny')}
          </Button>
        </div>
      )}
    </div>
  );
}
