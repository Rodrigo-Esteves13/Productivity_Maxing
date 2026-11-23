import { useEffect, useState, type ClipboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CopyButton from '../UI/CopyButton';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import ConfirmActionDialog from '../Turma/ConfirmActionDialog';
import SaveStatusText from '../Collab/SaveStatusText';
import VersionConflictBanner from '../Collab/VersionConflictBanner';
import { deletePadAsAdmin } from '../../api/padsService';
import { useAuth } from '../../context/useAuth';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useTurmaAction } from '../../hooks/useTurmas';
import { useI18n } from '../../i18n/useI18n';
import { usePad } from '../../hooks/usePad';
import { PADS_ADMIN_PATH, loginPathReturningTo, padPath } from '../../lib/appLinks';
import { PAD_MAX_CONTENT_LENGTH } from '../../lib/padSlug';
import { openLinkOnModClick } from '../../lib/ctrlClickLink';
import { pasteExceedsLimit, rememberPad } from '../../lib/padRecents';
import { downloadTextFile } from '../../utils/downloadTextFile';
import { DownloadIcon } from '../UI/Icons';

const PAD_EXPORT_MIME = 'text/plain;charset=utf-8';

// Um pad aberto: textarea que grava sozinha, como o dontpad. Sem conta da
// para ler e escrever (com menos espaco); com conta da para trancar.
export default function PadEditor({ slug, onRetry }: { slug: string; onRetry?: () => void }) {
  const { t } = useI18n();
  const pad = usePad(slug);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirmAction(t('turma.actionError'));
  const lock = useTurmaAction(pad.setLocked, t('turma.actionError'));
  const isAdmin = user?.role === 'ADMIN';
  const link = `${window.location.origin}${padPath(slug)}`;
  const [pasteTrimmed, setPasteTrimmed] = useState(false);
  const isLoaded = pad.doc !== null;

  // Guarda o nome na lista dos ultimos pads abertos (so depois de abrir).
  useEffect(() => {
    if (isLoaded) rememberPad(slug);
  }, [isLoaded, slug]);

  if (pad.status === 'loading' && pad.doc === null) return <LinesSkeleton />;
  if (pad.status === 'error' && pad.doc === null) return <ErrorState message={t('pad.loadError')} onRetry={onRetry} />;

  const text = pad.doc ?? '';
  const meta = pad.meta;
  const maxLength = meta?.maxLength ?? PAD_MAX_CONTENT_LENGTH;
  const isReadOnly = Boolean(meta?.locked && !meta.lockedByMe);

  // O browser corta em silencio o que passa do maxLength: avisa quando a
  // colagem nao cabe toda.
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const pasted = e.clipboardData.getData('text').length;
    setPasteTrimmed(pasteExceedsLimit(text.length, target.selectionEnd - target.selectionStart, pasted, maxLength));
  };

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {isReadOnly ? (
          <span className="text-xs text-amber-400">{t('pad.lockedByOther')}</span>
        ) : (
          <SaveStatusText status={pad.status} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-neutral-500">
            {text.length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
          <CopyButton text={link} label={t('pad.copyLink')} />
          <CopyButton text={text} label={t('ux4notes.pad.copyText')} />
          <Button
            variant="secondary"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
            onClick={() => downloadTextFile(text, `${slug}.txt`, PAD_EXPORT_MIME)}
          >
            <DownloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t('ux4notes.pad.download')}
          </Button>
          {/* Trancar e so de admin; quem trancou antes disso ainda destranca. */}
          {isAuthenticated && meta && (isAdmin || (meta.locked && meta.lockedByMe)) && (
            <Button
              variant="secondary"
              className="px-2.5 py-1 text-xs"
              disabled={lock.isBusy}
              onClick={() => void lock.execute(!meta.locked)}
            >
              {t(meta.locked ? 'pad.unlock' : 'pad.lock')}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="danger"
              className="px-2.5 py-1 text-xs"
              onClick={() =>
                confirm.request({
                  title: t('pad.admin.delete'),
                  message: t('pad.admin.deleteConfirm', { name: slug }),
                  confirmLabel: t('common.delete'),
                  tone: 'danger',
                  run: async () => {
                    await deletePadAsAdmin(slug);
                    navigate(PADS_ADMIN_PATH);
                  },
                })
              }
            >
              {t('pad.admin.delete')}
            </Button>
          )}
        </div>
      </div>
      {lock.error && <FormError message={lock.error} />}
      {pad.status === 'conflict' && <VersionConflictBanner onTakeRemote={pad.takeRemote} onKeepMine={pad.keepMine} />}
      <textarea
        onClick={openLinkOnModClick}
        value={text}
        onChange={(e) => {
          setPasteTrimmed(false);
          pad.change(e.target.value);
        }}
        onPaste={handlePaste}
        readOnly={isReadOnly}
        maxLength={maxLength}
        spellCheck={false}
        aria-label={t('pad.textLabel', { name: slug })}
        placeholder={isReadOnly ? '' : t('pad.placeholder')}
        className="block min-h-[65dvh] w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 p-4 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-600/50"
      />
      {pasteTrimmed && (
        <p role="alert" className="mt-2 text-xs text-amber-400">
          {t('ux4notes.pad.pasteTrimmed', { max: maxLength.toLocaleString() })}
        </p>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        {t(meta?.locked ? 'pad.lockedHint' : 'pad.publicWarning')}
        {!isAuthenticated && (
          <>
            {' '}
            <Link to={loginPathReturningTo(padPath(slug))} className="text-violet-400 hover:underline">
              {t('pad.signInPerks')}
            </Link>
          </>
        )}
      </p>
      <ConfirmActionDialog state={confirm} />
    </section>
  );
}
