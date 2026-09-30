/**
 * AudioUploadButton - Component for uploading audio files
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { uploadAudio } from '@/lib/api/upload-service';

export interface AudioUploadButtonProps {
  onUploadComplete: (url: string) => void;
  currentUrl?: string;
  disabled?: boolean;
}

export function AudioUploadButton({
  onUploadComplete,
  currentUrl,
  disabled = false,
}: AudioUploadButtonProps) {
  const { t } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert(t('decks.cards.upload.invalidAudio'));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(t('decks.cards.upload.fileTooLarge'));
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadAudio(file);
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
        <audio src={currentUrl} controls className="h-8" />
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
        accept="audio/mp3,audio/wav,audio/ogg,audio/m4a"
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
            {t('decks.cards.upload.audio')}
          </>
        )}
      </Button>
    </div>
  );
}
