import { AlertCircle, Volume2, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownContent } from '@/components/ui/markdown';
import type { MediaFailure } from '@flashly/shared/src';

interface FailureSummaryCardProps {
    failure: MediaFailure;
    isRetrying: boolean;
    onRetry: () => void;
}

export function FailureSummaryCard({ failure, isRetrying, onRetry }: FailureSummaryCardProps) {
    const { t } = useTranslation();
    const errorTypeKey = failure.errorType === 'audio' ? 'audio' : 'image';
    const errorTypeLabel = t(`web.flashcards.failureSummary.${errorTypeKey}`);

    return (
        <Card className="py-6 border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <CardTitle className="text-sm font-medium">
                            {t('web.flashcards.failureSummary.error')} {errorTypeLabel}
                        </CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {t('web.flashcards.failureSummary.cardNumber', { index: failure.cardIndex + 1 })}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                    <div>
                        <span className="font-medium">{t('web.flashcards.failureSummary.front')}:</span>
                        <div className="mt-1">
                            {failure.card.front ? (
                                <MarkdownContent value={failure.card.front} className="font-medium" cloze />
                            ) : (
                                <em className="text-muted-foreground/50">{t('web.flashcards.failureSummary.noFrontText')}</em>
                            )}
                        </div>
                    </div>
                    {failure.card.back && (
                        <div>
                            <span className="font-medium">{t('web.flashcards.failureSummary.back')}:</span>
                            <div className="mt-1">
                                <MarkdownContent value={failure.card.back} className="text-sm text-muted-foreground" cloze />
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                    <span className="font-medium">{t('web.flashcards.failureSummary.error')}:</span> {failure.errorMessage}
                </div>

                <Button
                    onClick={onRetry}
                    disabled={isRetrying}
                    variant="outline"
                    size="sm"
                    className="w-full"
                >
                    {isRetrying ? (
                        <>
                            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            {t('web.flashcards.failureSummary.retrying')}
                        </>
                    ) : (
                        <>
                            {failure.errorType === 'audio' ? (
                                <Volume2 className="mr-2 h-4 w-4" />
                            ) : (
                                <ImageIcon className="mr-2 h-4 w-4" />
                            )}
                            {t('web.flashcards.failureSummary.retry', { type: errorTypeLabel })}
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
