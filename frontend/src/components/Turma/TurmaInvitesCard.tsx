import { useNavigate } from 'react-router-dom';
import Card from '../UI/Card';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import { acceptTurmaInvite, declineTurmaInvite } from '../../api/turmasService';
import { useTurmaAction, useTurmaInvites } from '../../hooks/useTurmas';
import { useI18n } from '../../i18n/useI18n';
import { turmaPath } from '../../lib/appLinks';
import { formatDateTime } from '../../lib/timeFormat';

// Convites diretos pendentes. So aparece quando ha algum.
export default function TurmaInvitesCard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: invites, reload } = useTurmaInvites();
  const accept = useTurmaAction(acceptTurmaInvite, t('turma.actionError'));
  const decline = useTurmaAction(declineTurmaInvite, t('turma.actionError'));
  const isBusy = accept.isBusy || decline.isBusy;

  if (!invites || invites.length === 0) return null;

  return (
    <Card className="mb-6">
      <h2 className="mb-3 font-semibold text-white">{t('turma.invites.title')}</h2>
      <ul className="divide-y divide-neutral-800">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{invite.turmaName}</p>
              <p className="text-xs text-neutral-500">
                {t('turma.invites.from', { name: invite.invitedByName ?? t('ui.unknown') })}
                {' · '}
                {t('turma.memberCount', { count: invite.memberCount })}
                {' · '}
                {formatDateTime(invite.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isBusy}
                onClick={async () => {
                  if ((await decline.execute(invite.id)) !== null) reload();
                }}
              >
                {t('turma.invites.decline')}
              </Button>
              <Button
                size="sm"
                disabled={isBusy}
                onClick={async () => {
                  const joined = await accept.execute(invite.id);
                  if (joined) navigate(turmaPath(joined.id));
                }}
              >
                {t('turma.invites.accept')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {(accept.error || decline.error) && <FormError message={accept.error || decline.error} />}
    </Card>
  );
}
