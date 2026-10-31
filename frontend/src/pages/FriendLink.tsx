import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import LinesSkeleton from '../components/UI/LinesSkeleton';
import PersonAvatar from '../components/Social/PersonAvatar';
import useDocumentTitle from '../hooks/useDocumentTitle';
import {
  acceptFriendLink,
  previewFriendLink,
  type FriendLinkParams,
  type FriendLinkPreview,
} from '../api/socialService';
import { notifySocialChanged } from '../lib/socialEvents';
import { friendPath, socialTabPath } from '../lib/appLinks';
import { useFeedback } from '../context/useFeedback';
import { useI18n } from '../i18n/useI18n';

type LoadState = 'loading' | 'ready' | 'not_found' | 'error';

// Quem abre um link de amizade ve logo de quem e e se quer ser amigo. Com
// o link assinado (partilhado ha menos de 7 dias) aceitar torna-vos amigos
// sem mais nada; sem assinatura vai um pedido, como com o codigo.
export default function FriendLink() {
  const { t } = useI18n();
  useDocumentTitle(t('friendLink.docTitle'));
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const { code = '' } = useParams<{ code: string }>();
  const [search] = useSearchParams();
  const [state, setState] = useState<LoadState>('loading');
  const [preview, setPreview] = useState<FriendLinkPreview | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const expires = Number(search.get('e'));
  const token = search.get('t') ?? undefined;
  const params: FriendLinkParams = {
    friendCode: code,
    ...(Number.isFinite(expires) && expires > 0 && token ? { expires, token } : {}),
  };
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    previewFriendLink(JSON.parse(paramsKey) as FriendLinkParams)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(isAxiosError(error) && error.response?.status === 404 ? 'not_found' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [paramsKey]);

  const name = preview?.person.name ?? t('social.anonymous');

  const accept = async () => {
    if (!preview) return;
    setIsSending(true);
    try {
      const result = await acceptFriendLink(params);
      notifySocialChanged();
      if (result.status === 'ACCEPTED') {
        notify(t('friendLink.nowFriends', { name }), 'success');
        navigate(friendPath(preview.person.id));
        return;
      }
      setSent(true);
    } catch {
      notify(t('friendLink.failed'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  const status = preview?.status;

  return (
    <PageLayout>
      <Breadcrumbs
        items={[{ label: t('nav.social'), to: socialTabPath('friends') }, { label: t('friendLink.crumb') }]}
      />
      <PageHeader title={t('friendLink.title')} />

      {state === 'loading' && <LinesSkeleton lines={3} />}
      {state === 'not_found' && <ErrorState message={t('friendLink.notFound')} />}
      {state === 'error' && <ErrorState message={t('friendLink.loadError')} />}

      {state === 'ready' && preview && (
        <section className="max-w-lg rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center gap-4">
            <PersonAvatar name={name} avatarUrl={preview.person.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-white">{name}</p>
              <p className="text-sm text-neutral-400">
                {status === 'SELF'
                  ? t('friendLink.self')
                  : status === 'FRIEND'
                    ? t('friendLink.alreadyFriends')
                    : status === 'INCOMING'
                      ? t('friendLink.incoming')
                      : sent || status === 'REQUESTED'
                        ? t('friendLink.requested')
                        : preview.instant
                          ? t('friendLink.invite')
                          : t('friendLink.inviteRequest')}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {status === 'FRIEND' && (
              <Link
                to={friendPath(preview.person.id)}
                className="text-sm font-medium text-violet-400 hover:text-violet-300"
              >
                {t('social.friend.open')}
              </Link>
            )}
            {(status === 'NONE' || status === 'INCOMING') && !sent && (
              <ActionButton disabled={isSending} onClick={() => void accept()}>
                {preview.instant || status === 'INCOMING' ? t('friendLink.accept') : t('friendLink.sendRequest')}
              </ActionButton>
            )}
            <Link to={socialTabPath('friends')} className="text-sm text-neutral-400 hover:text-white">
              {t('friendLink.goToSocial')}
            </Link>
          </div>
          {preview.instant && status === 'NONE' && !sent && (
            <p className="mt-4 text-xs text-neutral-500">{t('friendLink.instantHelp')}</p>
          )}
        </section>
      )}
    </PageLayout>
  );
}
