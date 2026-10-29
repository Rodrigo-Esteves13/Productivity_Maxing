import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import FormError from '../components/UI/FormError';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import TurmaRoleBadge from '../components/Turma/TurmaRoleBadge';
import TurmaInvitesCard from '../components/Turma/TurmaInvitesCard';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useCreateTurma, useJoinTurma, useMyTurmas } from '../hooks/useTurmas';
import { useI18n } from '../i18n/useI18n';
import { turmaPath } from '../lib/appLinks';
import { hasUnseenAnnouncement } from '../lib/turmaSeen';
import { INVITE_CODE_LENGTH, TURMA_NAME_MAX_LENGTH, TURMA_DESCRIPTION_MAX_LENGTH } from '../components/Turma/turmaConfig';

// Turmas: as minhas, criar uma (fico delegado) ou entrar com um codigo.
// /classes?code=XXXX (link de convite) ja traz o codigo preenchido.
export default function Turmas() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.turmas'));
  const { data: turmas, isLoading, error } = useMyTurmas();

  return (
    <PageLayout>
      <PageHeader title={t('nav.turmas')} description={t('turma.description')} />
      <TurmaInvitesCard />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <JoinTurmaCard />
        <CreateTurmaCard />
      </div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">{t('turma.mine')}</h2>
      {isLoading ? (
        <CardGridSkeleton />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !turmas || turmas.length === 0 ? (
        <EmptyState message={t('turma.none')} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {turmas.map((turma) => (
            <li key={turma.id}>
              <Link
                to={turmaPath(turma.id)}
                className="block h-full rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-violet-700"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-white">{turma.name}</span>
                  <TurmaRoleBadge role={turma.myRole} />
                </div>
                {turma.description && <p className="mb-2 line-clamp-2 text-sm text-neutral-400">{turma.description}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-neutral-500">{t('turma.memberCount', { count: turma.memberCount })}</p>
                  {hasUnseenAnnouncement(turma.id, turma.latestAnnouncementAt) && (
                    <span className="rounded-full bg-violet-600/20 px-2 py-0.5 text-xs text-violet-200">
                      {t('turma.announcements.new')}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}

function JoinTurmaCard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => (params.get('code') ?? '').toUpperCase().slice(0, INVITE_CODE_LENGTH));
  const join = useJoinTurma(t('turma.join.error'));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await join.execute(code.trim().toUpperCase());
    if (result) navigate(turmaPath(result.id));
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 className="font-semibold text-white">{t('turma.join.title')}</h2>
        <Input
          label={t('turma.join.code')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={INVITE_CODE_LENGTH}
          autoComplete="off"
          className="font-mono tracking-widest"
        />
        {join.error && <FormError message={join.error} />}
        <Button type="submit" disabled={join.isBusy || code.trim().length !== INVITE_CODE_LENGTH}>
          {t('turma.join.submit')}
        </Button>
      </form>
    </Card>
  );
}

function CreateTurmaCard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateTurma(t('turma.create.error'));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await create.execute({ name: name.trim(), description: description.trim() || undefined });
    if (result) navigate(turmaPath(result.id));
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 className="font-semibold text-white">{t('turma.create.title')}</h2>
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
        <p className="text-xs text-neutral-500">{t('turma.create.hint')}</p>
        {create.error && <FormError message={create.error} />}
        <Button type="submit" disabled={create.isBusy || !name.trim()}>
          {t('turma.create.submit')}
        </Button>
      </form>
    </Card>
  );
}
