import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from './Icons';

export interface LightboxImage {
  id: string;
  url: string;
  alt?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  // null = fechado.
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

// So mostra URLs http(s): o que vem do servidor ja e assim, mas um data:/
// javascript: nunca chega a um <img> por engano.
function isSafeImageUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url, window.location.origin);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

// Ecra inteiro para ampliar fotos: Esc fecha, setas navegam, clicar fora
// fecha. Bloqueia o scroll da pagina enquanto esta aberto.
export default function ImageLightbox({ images, index, onIndexChange }: ImageLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = index !== null && index >= 0 && index < images.length;
  const total = images.length;

  const close = useCallback(() => onIndexChange(null), [onIndexChange]);
  const go = useCallback(
    (delta: number) => {
      if (index === null || total === 0) return;
      onIndexChange((index + delta + total) % total);
    },
    [index, total, onIndexChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close, go]);

  if (!isOpen || index === null) return null;
  const image = images[index];
  if (!isSafeImageUrl(image.url)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${total}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      onClick={close}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close photo"
        onClick={close}
        className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
      >
        <XIcon className="h-5 w-5" />
      </button>

      {total > 1 && (
        <button
          type="button"
          aria-label="Previous photo"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
      )}

      <img
        src={image.url}
        alt={image.alt ?? ''}
        referrerPolicy="no-referrer"
        decoding="async"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl"
      />

      {total > 1 && (
        <button
          type="button"
          aria-label="Next photo"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        >
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      )}

      {total > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-neutral-200">
          {index + 1} / {total}
        </p>
      )}
    </div>
  );
}
