import { useMemo, useState } from 'react';
import { ImageIcon, XIcon, ZoomInIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';
import ImageLightbox from '../../UI/ImageLightbox';
import type { LightboxImage } from '../../UI/ImageLightbox';
import type { NotebookPhoto } from '../../../types/models';
import { useI18n } from '../../../i18n/useI18n';

interface NotebookPhotoGridProps {
  photos: Pick<NotebookPhoto, 'id' | 'url'>[];
  // Presente so em edicao: mostra o botao de remover em cada foto.
  onRemove?: (photoId: string) => void;
  className?: string;
}

// Grelha de fotos com ampliacao (lightbox). Partilhada pelo editor do
// Notebook e pela pagina publica de partilha, para as duas se comportarem
// igual.
export default function NotebookPhotoGrid({
  photos,
  onRemove,
  className = 'grid grid-cols-3 gap-2 sm:grid-cols-4',
}: NotebookPhotoGridProps) {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Indices do lightbox so cobrem as fotos com URL (as outras mostram o
  // placeholder e nao se ampliam).
  const viewable = useMemo<LightboxImage[]>(
    () => photos.flatMap((p) => (p.url ? [{ id: p.id, url: p.url }] : [])),
    [photos],
  );

  if (photos.length === 0) return null;

  return (
    <>
      <div className={className}>
        {photos.map((photo) => {
          const viewIndex = viewable.findIndex((v) => v.id === photo.id);
          return (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-900">
              {photo.url ? (
                <button
                  type="button"
                  aria-label={t('ui.enlargePhoto')}
                  onClick={() => setOpenIndex(viewIndex)}
                  className="group/zoom block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform group-hover/zoom:scale-105"
                  />
                  <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover/zoom:opacity-100 group-focus-visible/zoom:opacity-100">
                    <ZoomInIcon className="h-3 w-3" />
                  </span>
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-500">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              {onRemove && (
                // Em ecras tateis nao ha hover: o botao fica sempre visivel
                // ate sm, e so aparece ao passar o rato a partir de sm.
                <IconButton
                  label={t('ui.removePhoto')}
                  className="absolute right-1 top-1 rounded-full bg-black/60 text-white sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 hover:text-white"
                  onClick={() => onRemove(photo.id)}
                >
                  <XIcon className="h-3 w-3" />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>

      <ImageLightbox images={viewable} index={openIndex} onIndexChange={setOpenIndex} />
    </>
  );
}
