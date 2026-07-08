import type { ChangeEvent, RefObject } from 'react';
import Button from '../UI/Button';
import Avatar from './Avatar';

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
  return (
    <div className="flex items-center gap-4">
      <Avatar initials={initials} avatarUrl={displayedImage} alt="Avatar preview" size="md" />

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
            Choose Photo
          </Button>
          {displayedImage && (
            <Button type="button" variant="secondary" onClick={onRemoveClick}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-neutral-500">PNG, JPG, WEBP or GIF, up to 5MB.</p>
      </div>
    </div>
  );
}
