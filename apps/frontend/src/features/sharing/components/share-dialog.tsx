/**
 * ShareDialog - Dialog with sharing options
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, QrCode, Code, Copy, Check, Twitter, Facebook, Linkedin } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckName: string;
  isPublic?: boolean;
}

export function ShareDialog({
  open,
  onOpenChange,
  deckId,
  deckName,
  isPublic = false,
}: ShareDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  // Generate share URL
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/marketplace/${deckId}`
    : '';

  // Generate embed code
  const embedCode = `<iframe src="${shareUrl}/embed" width="100%" height="600" frameborder="0"></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success(t('sharing.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success(t('sharing.copied'));
  };

  const handleSocialShare = (platform: string) => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(t('sharing.socialText', { deckName }));

    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };

    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  if (!isPublic) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('sharing.title')}</DialogTitle>
            <DialogDescription>{t('sharing.privateWarning')}</DialogDescription>
          </DialogHeader>

          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {t('sharing.makePublicInstructions')}
            </p>
            <Button onClick={() => onOpenChange(false)}>
              {t('common.ok')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('sharing.title')}</DialogTitle>
          <DialogDescription>{t('sharing.description')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">
              <Link className="h-4 w-4 mr-2" />
              {t('sharing.tabs.link')}
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="h-4 w-4 mr-2" />
              {t('sharing.tabs.qr')}
            </TabsTrigger>
            <TabsTrigger value="embed">
              <Code className="h-4 w-4 mr-2" />
              {t('sharing.tabs.embed')}
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4">
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button onClick={handleCopyLink} variant="outline">
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Social Share Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('sharing.socialShare')}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSocialShare('twitter')}
                  className="flex-1"
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Twitter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSocialShare('facebook')}
                  className="flex-1"
                >
                  <Facebook className="h-4 w-4 mr-2" />
                  Facebook
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSocialShare('linkedin')}
                  className="flex-1"
                >
                  <Linkedin className="h-4 w-4 mr-2" />
                  LinkedIn
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-4">
            <div className="flex justify-center p-4 bg-muted rounded-lg">
              {/* Placeholder QR code - in production, use a QR code library */}
              <div className="text-center">
                <QrCode className="h-48 w-48 mx-auto mb-4 text-foreground" />
                <p className="text-sm text-muted-foreground">
                  {shareUrl}
                </p>
              </div>
            </div>
            <Button onClick={handleCopyLink} variant="outline" className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              {t('sharing.copyLink')}
            </Button>
          </TabsContent>

          {/* Embed Tab */}
          <TabsContent value="embed" className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('sharing.embedTitle')}</p>
              <Textarea
                value={embedCode}
                readOnly
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={handleCopyEmbed} variant="outline" className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              {t('sharing.copyEmbed')}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
