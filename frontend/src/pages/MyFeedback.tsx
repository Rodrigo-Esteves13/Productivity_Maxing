import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import IconButton from '../components/UI/IconButton';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import { PencilIcon, RefreshIcon, TrashIcon } from '../components/UI/Icons';
import FeedbackEditForm from '../components/Feedback/FeedbackEditForm';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import {
  canEditFeedback,
  feedbackStatusKey,
  FEEDBACK_CATEGORY_KEY,
  FEEDBACK_STATUS_CLASS,
} from '../components/Feedback/feedbackStatus';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useLoadOnce } from '../hooks/useLoadOnce';
import { useFeedback } from '../context/useFeedback';
import { deleteMyFeedback, getMyFeedback } from '../api/feedbackService';
import { formatDateTime } from '../lib/timeFormat';
import { useI18n } from '../i18n/useI18n';

const FeedbackModal = lazy(() => import('../components/Feedback/FeedbackModal'));

// ?send=1 (paleta Ctrl+K) abre logo o formulario.
const SEND_PARAM = 'send';

// O feedback que o proprio enviou, com o estado e a resposta da equipa.
// O aviso push de uma resposta abre aqui.
export default function MyFeedback() {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  useDocumentTitle(t('feedback.mine.title'));
  const { data, isLoading, error, reload } = useLoadOnce(getMyFeedback);
  const items = data ?? [];
  const [isComposing, setIsComposing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sendRequested = searchParams.has(SEND_PARAM);
  useEffect(() => {
    if (!sendRequested) return;
    setIsComposing(true);
    setSearchParams(
      (params) => {
        params.delete(SEND_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [sendRequested, setSearchParams]);
  const confirm = useConfirmAction(t('feedback.mine.error'));
  const [editingId, setEditingId] = useState<string | null>(null);

  // Depois de enviar, a lista volta a pedir-se para o novo feedback aparecer.
  const closeComposer = useCallback(() => {
    setIsComposing(false);
    reload();
  }, [reload]);

  const requestDelete = (id: string) =>
    confirm.request({
      title: t('ux4adm2.myFeedback.deleteTitle'),
      message: t('ux4adm2.myFeedback.deleteMessage'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      run: async () => {
        await deleteMyFeedback(id);
        notify(t('ux4adm2.myFeedback.deleted'), 'success');
        reload();
      },
    });

  const sendButton = <Button onClick={() => setIsComposing(true)}>{t('ux4adm2.myFeedback.send')}</Button>;

  return (
    <PageLayout>
      <PageHeader title={t('feedback.mine.title')} description={t('feedback.mine.description')} />
      {isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : error ? (
        <ErrorState message={t('feedback.mine.error')} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState message={t('feedback.mine.empty')} action={sendButton} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <IconButton label={t('ux4adm2.myFeedback.refresh')} onClick={reload}>
              <RefreshIcon className="h-4 w-4" />
            </IconButton>
            {sendButton}
          </div>
          <ul className="space-y-3">
            {items.map((item) => {
              const statusKey = feedbackStatusKey(item);
              return (
                <li key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                    <span className={`rounded-full border px-2 py-0.5 ${FEEDBACK_STATUS_CLASS[statusKey]}`}>
                      {t(statusKey)}
                    </span>
                    <span className="rounded-full border border-neutral-700 px-2 py-0.5">
                      {t(FEEDBACK_CATEGORY_KEY[item.category])}
                    </span>
                    <span>{formatDateTime(item.createdAt, lang)}</span>
                    <div className="ml-auto flex items-center">
                      {canEditFeedback(item) && editingId !== item.id && (
                        <IconButton label={t('ux4global.feedback.edit')} onClick={() => setEditingId(item.id)}>
                          <PencilIcon className="h-4 w-4" />
                        </IconButton>
                      )}
                      <IconButton
                        label={t('ux4adm2.myFeedback.delete')}
                        tone="danger"
                        onClick={() => requestDelete(item.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                  {editingId === item.id ? (
                    <FeedbackEditForm
                      id={item.id}
                      initial={item.message}
                      onClose={() => setEditingId(null)}
                      onChanged={reload}
                    />
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-100">{item.message}</p>
                  )}
                  {item.adminReply && (
                    <div className="mt-3 rounded-lg border-l-2 border-violet-500 bg-neutral-950/60 px-3 py-2">
                      <p className="text-xs text-neutral-400">
                        {t('feedback.mine.reply')}
                        {item.repliedAt && ` · ${formatDateTime(item.repliedAt, lang)}`}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-200">{item.adminReply}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <ConfirmActionDialog state={confirm} />
      {isComposing && (
        <Suspense fallback={null}>
          <FeedbackModal isOpen onClose={closeComposer} />
        </Suspense>
      )}
    </PageLayout>
  );
}
