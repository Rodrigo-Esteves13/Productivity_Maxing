import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../UI/Button';
import Input from '../UI/Input';
import FormError from '../UI/FormError';
import ToggleRow from '../UI/ToggleRow';
import CopyButton from '../UI/CopyButton';
import PersonAvatar from '../Social/PersonAvatar';
import TurmaRoleBadge from './TurmaRoleBadge';
import ConfirmActionDialog from './ConfirmActionDialog';
import TurmaDirectInvite from './TurmaDirectInvite';
import {
  deleteTurma,
  leaveTurma,
  regenerateInviteCode,
  removeTurmaMember,
  transferDelegado,
  updateTurma,
} from '../../api/turmasService';
import { useTurmaAction } from '../../hooks/useTurmas';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { TURMAS_PATH, friendPath, socialTabPath } from '../../lib/appLinks';
import { sendClassmateFriendRequest } from '../../api/socialService';
import { notifySocialChanged } from '../../lib/socialEvents';
import { useFeedback } from '../../context/useFeedback';
import type { TurmaDetail, TurmaMember } from '../../types/models';
import { TURMA_DESCRIPTION_MAX_LENGTH, TURMA_NAME_MAX_LENGTH, turmaInviteLink } from './turmaConfig';

interface TurmaMembersTabProps {
  turma: TurmaDetail;
  onChanged: () => void;
}

// Membros, convite e (para o delegado) definicoes da turma.
export default function TurmaMembersTab({ turma, onChanged }: TurmaMembersTabProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirmAction(t('turma.actionError'));
  const isDelegado = turma.myRole === 'DELEGADO';

  const requestLeave = () =>
    confirm.request({
      title: t('turma.leave'),
      message: t(turma.members.length === 1 ? 'turma.leaveLastConfirm' : 'turma.leaveConfirm', { name: turma.name }),
      confirmLabel: t('turma.leave'),
      tone: 'danger',
      run: async () => {
        await leaveTurma(turma.id);
        navigate(TURMAS_PATH);
      },
    });

  return (
    <div className="space-y-6">
      <InviteSection turma={turma} onChanged={onChanged} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">
          {t('turma.memberCount', { count: turma.members.length })}
        </h2>
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {turma.members.map((member) => {
            const name = member.name ?? t('social.anonymous');
            const isMe = member.userId === user?.id;
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 p-3">
                <PersonAvatar name={name} avatarUrl={member.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                  {name}
                  {isMe && <span className="ml-1 text-neutral-500">({t('turma.you')})</span>}
                </span>
                <TurmaRoleBadge role={member.role} />
                {!isMe && <ClassmateFriendAction turmaId={turma.id} member={member} onChanged={onChanged} />}
                {isDelegado && !isMe && (
                  <span className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      onClick={() =>
                        confirm.request({
                          title: t('turma.makeDelegado'),
                          message: t('turma.makeDelegadoConfirm', { name }),
                          confirmLabel: t('turma.makeDelegado'),
                          tone: 'default',
                          run: async () => {
                            await transferDelegado(turma.id, member.userId);
                            onChanged();
                          },
                        })
                      }
                    >
                      {t('turma.makeDelegado')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      onClick={() =>
                        confirm.request({
                          title: t('turma.removeMember'),
                          message: t('turma.removeMemberConfirm', { name }),
                          confirmLabel: t('turma.removeMember'),
                          tone: 'danger',
                          run: async () => {
                            await removeTurmaMember(turma.id, member.userId);
                            onChanged();
                          },
                        })
                      }
                    >
                      {t('turma.removeMember')}
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isDelegado && <SettingsSection turma={turma} onChanged={onChanged} />}

      <section className="flex flex-wrap gap-2 border-t border-neutral-800 pt-4">
        <Button variant="secondary" onClick={requestLeave}>
          {t('turma.leave')}
        </Button>
        {isDelegado && (
          <Button
            variant="danger"
            onClick={() =>
              confirm.request({
                title: t('turma.delete'),
                message: t('turma.deleteConfirm', { name: turma.name }),
                confirmLabel: t('common.delete'),
                tone: 'danger',
                run: async () => {
                  await deleteTurma(turma.id);
                  navigate(TURMAS_PATH);
                },
              })
            }
          >
            {t('turma.delete')}
          </Button>
        )}
      </section>
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}

// Liga os Membros ao Social: abrir o perfil de um amigo, ou adicionar um
// colega sem precisar do codigo de amigo (estao na mesma turma).
function ClassmateFriendAction({
  turmaId,
  member,
  onChanged,
}: {
  turmaId: string;
  member: TurmaMember;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const link = 'text-xs font-medium text-violet-400 hover:text-violet-300';

  if (member.friendStatus === 'FRIEND') {
    return (
      <Link to={friendPath(member.userId)} className={link}>
        {t('turma.members.friendProfile')}
      </Link>
    );
  }
  if (member.friendStatus === 'REQUESTED') {
    return <span className="text-xs text-neutral-500">{t('turma.members.requestSent')}</span>;
  }
  if (member.friendStatus === 'INCOMING') {
    return (
      <Link to={socialTabPath('requests')} className={link}>
        {t('turma.members.answerRequest')}
      </Link>
    );
  }
  if (member.friendStatus === 'BLOCKED') return null;

  const add = async () => {
    setBusy(true);
    try {
      const result = await sendClassmateFriendRequest(turmaId, member.userId);
      notify(t(result.status === 'ACCEPTED' ? 'turma.members.nowFriends' : 'turma.members.requestSentToast'), 'success');
      notifySocialChanged();
      onChanged();
    } catch {
      notify(t('turma.actionError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" className="px-2.5 py-1 text-xs" disabled={busy} onClick={() => void add()}>
      {t('turma.members.addFriend')}
    </Button>
  );
}

function InviteSection({ turma, onChanged }: TurmaMembersTabProps) {
  const { t } = useI18n();
  const regenerate = useTurmaAction(regenerateInviteCode, t('turma.actionError'));

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
      <h2 className="mb-1 text-sm font-semibold text-neutral-300">{t('turma.invite.title')}</h2>
      <p className="mb-3 text-xs text-neutral-500">{t('turma.invite.hint')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-neutral-950 px-3 py-1.5 font-mono text-lg tracking-widest text-white">
          {turma.inviteCode}
        </span>
        <CopyButton text={turma.inviteCode} label={t('turma.invite.copyCode')} />
        <CopyButton text={turmaInviteLink(turma.inviteCode)} label={t('turma.invite.copyLink')} />
        {turma.myRole === 'DELEGADO' && (
          <Button
            variant="secondary"
            className="px-2.5 py-1 text-xs"
            disabled={regenerate.isBusy}
            onClick={async () => {
              if (await regenerate.execute(turma.id)) onChanged();
            }}
          >
            {t('turma.invite.regenerate')}
          </Button>
        )}
      </div>
      {regenerate.error && <FormError message={regenerate.error} />}
      <TurmaDirectInvite turma={turma} />
    </section>
  );
}

function SettingsSection({ turma, onChanged }: TurmaMembersTabProps) {
  const { t } = useI18n();
  const [name, setName] = useState(turma.name);
  const [description, setDescription] = useState(turma.description ?? '');
  const save = useTurmaAction(updateTurma, t('turma.actionError'));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await save.execute(turma.id, { name: name.trim(), description: description.trim() })) onChanged();
  };

  const toggleEditing = async (value: boolean) => {
    if (await save.execute(turma.id, { membersCanEditNotes: value })) onChanged();
  };

  return (
    <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
      <h2 className="text-sm font-semibold text-neutral-300">{t('turma.settings.title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label={t('turma.create.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={TURMA_NAME_MAX_LENGTH}
        />
        <Input
          label={t('turma.create.descriptionLabel')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={TURMA_DESCRIPTION_MAX_LENGTH}
        />
        <Button type="submit" disabled={save.isBusy || !name.trim()}>
          {t('common.save')}
        </Button>
      </form>
      <ToggleRow
        label={t('turma.settings.membersCanEdit')}
        description={t('turma.settings.membersCanEditHelp')}
        checked={turma.membersCanEditNotes}
        disabled={save.isBusy}
        onChange={(value) => void toggleEditing(value)}
      />
      {save.error && <FormError message={save.error} />}
    </section>
  );
}
