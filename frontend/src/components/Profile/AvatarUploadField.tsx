import type { ChangeEvent, RefObject } from 'react';
import Button from '../UI/Button';
import Avatar from './Avatar';
import { useI18n } from '../../i18n/useI18n';

interface AvatarUploadFieldProps {
  initials: string;
  displayedImage: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveClick: () => void;
}

export default function AvatarUploadField({
  initials,
  displayedImage,
  fileInputRef,
  onFileChange,
  onRemoveClick,
}: AvatarUploadFieldProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-4">
      <Avatar initials={initials} avatarUrl={displayedImage} alt={t('ui.avatarPreview')} size="md" />

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFileChange}
          className="hidden"
          id="avatar-upload"
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {t('ui.choosePhoto')}
          </Button>
          {displayedImage && (
            <Button type="button" variant="secondary" onClick={onRemoveClick}>
              {t('ui.remove')}
            </Button>
          )}
        </div>
        <p className="text-xs text-neutral-500">{t('ui.pngJpgWebpOrGif')}</p>
      </div>
    </div>
  );
}
