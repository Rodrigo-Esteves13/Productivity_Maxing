import { useEffect, useState } from 'react';
import { ArrowUpIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';
import { MODAL_EXIT_MS, usePresence } from '../../hooks/usePresence';

const SHOW_AFTER_PX = 480;

export default function BackToTopButton() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > SHOW_AFTER_PX);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { mounted, state } = usePresence(isVisible, MODAL_EXIT_MS);
  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      data-state={state}
      className="motion-modal print-hide fixed bottom-6 right-6 z-40 p-3 rounded-full bg-neutral-800/90 hover:bg-violet-600 border border-neutral-700 hover:border-violet-500 text-neutral-300 hover:text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
    >
      <ArrowUpIcon />
    </button>
  );
}
