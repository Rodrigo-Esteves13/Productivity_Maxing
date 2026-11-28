import CopyButton from '../../UI/CopyButton';
import { LinkIcon } from '../../UI/Icons';
import { useI18n } from '../../../i18n/useI18n';
import type { UseEntryShareResult } from '../../../hooks/useEntryShare';

// Criar o link, ou copia-lo e deixar de partilhar.
export default function ShareLinkRow({ share }: { share: UseEntryShareResult }) {
  const { t } = useI18n();
  const { token, shareUrl, isLoading, create, revoke } = share;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {token ? (
        <>
          <input
            readOnly
            value={shareUrl}
            aria-label={t('share.linkLabel')}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 focus:border-violet-500 focus:outline-none"
          />
          <CopyButton text={shareUrl} className="px-2.5 py-1.5" />
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void revoke()}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-neutral-800 disabled:opacity-50"
          >
            {t('share.stop')}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void create()}
          className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <LinkIcon className="h-3.5 w-3.5" />
          {isLoading ? t('share.loading') : t('share.create')}
        </button>
      )}
    </div>
  );
}
