import { useEffect, useRef, useState, type ChangeEvent } from 'react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, mesmo limite do backend
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export interface UseAvatarUploadResult {
  selectedFile: File | null;
  previewUrl: string | null;
  removePhoto: boolean;
  error: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemovePhotoClick: () => void;
  reset: () => void;
}

/**
 * Encapsula a escolha de ficheiro, validação (tipo/tamanho) e geração do
 * preview para o upload de avatar.
 *
 * A geração do preview passa a imagem por um <canvas> em vez de usar
 * URL.createObjectURL diretamente sobre os bytes do ficheiro. Isto obriga o
 * browser a descodificar o ficheiro como pixels de imagem reais antes de o
 * mostrarmos: um ficheiro "polyglot" (bytes de imagem válidos + payload
 * escondido a seguir) não sobrevive a este round-trip, e ficheiros que não
 * sejam mesmo imagens (apesar da extensão/mimetype) são rejeitados aqui,
 * antes de irem para o backend.
 */
export function useAvatarUpload(): UseAvatarUploadResult {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;

    createImageBitmap(selectedFile)
      .then((bitmap) => {
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
        bitmap.close();
        setPreviewUrl(canvas.toDataURL('image/png'));
      })
      .catch(() => {
        if (cancelled) return;
        setError('This file does not look like a valid image.');
        setSelectedFile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Use PNG, JPG, WEBP or GIF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 5MB.');
      return;
    }

    setError('');
    setRemovePhoto(false);
    setSelectedFile(file);
  };

  const handleRemovePhotoClick = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const reset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemovePhoto(false);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return {
    selectedFile,
    previewUrl,
    removePhoto,
    error,
    fileInputRef,
    handleFileChange,
    handleRemovePhotoClick,
    reset,
  };
}
