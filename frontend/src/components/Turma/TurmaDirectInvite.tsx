import { useMemo, useState, type FormEvent } from 'react';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Select from '../UI/Select';
import FormError from '../UI/FormError';
import { inviteToTurma } from '../../api/turmasService';
import { getSocialOverview } from '../../api/socialService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useTurmaAction } from '../../hooks/useTurmas';
import { useAuth } from '../../context/useAuth';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import type { TurmaDetail } from '../../types/models';

interface TurmaDirectInviteProps {
  turma: TurmaDetail;
}

// Convidar um amigo (qualquer membro) ou, sendo admin, qualquer conta por
// email. O convite fica pendente na pagina das turmas da pessoa.
export default function TurmaDirectInvite({ turma }: TurmaDirectInviteProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { notify } = useFeedback();
  const isAdmin = user?.role === 'ADMIN';
  const { data: social } = useLoadOnce(getSocialOverview);
  const invite = useTurmaAction(inviteToTurma, t('turma.actionError'));
  const [friendId, setFriendId] = useState('');
  const [email, setEmail] = useState('');

  // Amigos que ainda nao estao na turma.
  const candidates = useMemo(() => {
    const memberIds = new Set(turma.members.map((m) => m.userId));
    return (social?.friends ?? []).filter((f) => !memberIds.has(f.userId));
  }, [social, turma.members]);

  const send = async (input: { userId?: string; email?: string }) => {
    if ((await invite.execute(turma.id, input)) !== null) {
      notify(t('turma.directInvite.sent'), 'success');
      setFriendId('');
      setEmail('');
    }
  };

  const submitFriend = (e: FormEvent) => {
    e.preventDefault();
    if (friendId) void send({ userId: friendId });
  };

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) void send({ email: email.trim() });
  };

  return (
    <div className="mt-4 space-y-3 border-t border-neutral-800 pt-4">
      <h4 className="text-sm font-semibold text-neutral-300">{t('turma.directInvite.title')}</h4>
      {candidates.length === 0 ? (
        <p className="text-xs text-neutral-500">{t('turma.directInvite.noFriends')}</p>
      ) : (
        <form onSubmit={submitFriend} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Select
              aria-label={t('turma.directInvite.pickFriend')}
              value={friendId}
              onChange={(e) => setFriendId(e.target.value)}
            >
              <option value="">{t('turma.directInvite.pickFriend')}</option>
              {candidates.map((f) => (
                <option key={f.userId} value={f.userId}>
                  {f.name ?? t('ui.unknown')}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={!friendId || invite.isBusy}>
            {t('turma.directInvite.send')}
          </Button>
        </form>
      )}
      {isAdmin && (
        <form onSubmit={submitEmail} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('turma.directInvite.adminEmail')}
              aria-label={t('turma.directInvite.adminEmail')}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={!email.trim() || invite.isBusy}>
            {t('turma.directInvite.send')}
          </Button>
        </form>
      )}
      {invite.error && <FormError message={invite.error} />}
    </div>
  );
}
