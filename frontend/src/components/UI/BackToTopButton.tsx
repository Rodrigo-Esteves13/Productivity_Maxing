import { useEffect, useState } from 'react';
import { ArrowUpIcon } from './Icons';

const SHOW_AFTER_PX = 480;

export default function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > SHOW_AFTER_PX);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
      className="print-hide fixed bottom-6 right-6 z-40 p-3 rounded-full bg-neutral-800/90 hover:bg-violet-600 border border-neutral-700 hover:border-violet-500 text-neutral-300 hover:text-white shadow-lg backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
    >
      <ArrowUpIcon />
    </button>
  );
}
