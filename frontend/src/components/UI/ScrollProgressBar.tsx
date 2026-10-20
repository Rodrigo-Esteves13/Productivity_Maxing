import { useEffect, useRef } from 'react';

// Sem estado React: cada scroll so agenda UM frame (rAF) que escreve
// transform: scaleX() direto no elemento. Antes era um setState por evento
// e uma transicao de `width` (relayout a cada frame do scroll); o scaleX
// fica so no compositor e o resto da arvore nunca volta a renderizar.
export default function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const scrollable = scrollHeight - clientHeight;
      const ratio = scrollable > 0 ? Math.min(1, scrollTop / scrollable) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${ratio})`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <div
      ref={barRef}
      // Sem a classe scale-x-0: no Tailwind 4 usa a propriedade `scale`, que
      // se somava ao transform escrito acima e deixava a barra sempre a zero.
      className="print-hide fixed top-0 left-0 h-0.5 w-full origin-left bg-violet-500 z-[60] will-change-transform"
      style={{ transform: 'scaleX(0)' }}
      aria-hidden="true"
    />
  );
}
