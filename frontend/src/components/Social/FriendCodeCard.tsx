import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface Props {
  code: string;
  onRegenerate: () => Promise<boolean>;
}

export default function FriendCodeCard({ code, onRegenerate }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // o codigo continua visivel
    }
  };

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-semibold text-white">{t('social.code.title')}</h2>
      <p className="mt-1 text-xs text-neutral-500">{t('social.code.hint')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-neutral-800 px-3 py-1.5 font-mono text-sm text-violet-300 select-all">
          {code}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          {copied ? t('packs.list.copied') : t('social.code.copy')}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => void onRegenerate().then(() => setConfirming(false))}
              className="rounded-md bg-red-600/80 px-3 py-1.5 text-sm text-white hover:bg-red-600"
            >
              {t('social.code.regenerateConfirm')}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-sm text-neutral-400 hover:text-white">
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="text-sm text-neutral-400 hover:text-white">
            {t('social.code.regenerate')}
          </button>
        )}
      </div>
    </section>
  );
}
