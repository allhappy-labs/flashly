/**
 * ImageUploadButton - Component for uploading images
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { uploadImage } from '@/lib/api/upload-service';

export interface ImageUploadButtonProps {
  onUploadComplete: (url: string) => void;
  currentUrl?: string;
  disabled?: boolean;
}

export function ImageUploadButton({
  onUploadComplete,
  currentUrl,
  disabled = false,
}: ImageUploadButtonProps) {
  const { t } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert(t('decks.cards.upload.invalidImage'));
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(t('decks.cards.upload.fileTooLarge'));
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadImage(file);
      onUploadComplete(result.url);
    } catch (error) {
      alert(error instanceof Error ? error.message : t('decks.cards.upload.error'));
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onUploadComplete('');
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  if (currentUrl) {
    return (
      <div className="flex items-center gap-2">
        <img
          src={currentUrl}
          alt="Preview"
          className="w-16 h-16 object-cover rounded border"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isUploading}
      >
        {isUploading ? (
          <>
            <span className="animate-spin mr-2">⏳</span>
            {t('decks.cards.upload.uploading')}
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {t('decks.cards.upload.image')}
          </>
        )}
      </Button>
    </div>
  );
}
