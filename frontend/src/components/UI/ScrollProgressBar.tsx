import { useEffect, useState } from 'react';

// Passive scroll listener, no rAF throttle needed - this only does a
// couple of cheap reads + one setState per event, and React 19 batches
// updates that happen in the same tick anyway. If this were ever doing
// heavier work per scroll event it'd be worth revisiting.
export default function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const scrollable = scrollHeight - clientHeight;
      setProgress(scrollable > 0 ? (scrollTop / scrollable) * 100 : 0);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  return (
    <div
      className="print-hide fixed top-0 left-0 h-0.5 bg-violet-500 z-[60] transition-[width] duration-150 ease-out"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  );
}
