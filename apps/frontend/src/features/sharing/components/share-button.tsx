/**
 * ShareButton - Button to open share dialog
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ShareDialog } from './share-dialog';

export interface ShareButtonProps {
  deckId: string;
  deckName: string;
  isPublic?: boolean;
}

export function ShareButton({ deckId, deckName, isPublic = false }: ShareButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4 mr-2" />
        {t('sharing.share')}
      </Button>

      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        deckId={deckId}
        deckName={deckName}
        isPublic={isPublic}
      />
    </>
  );
}
