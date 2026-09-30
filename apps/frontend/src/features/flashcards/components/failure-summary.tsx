import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FailureSummaryCard } from './failure-summary-card';
import type { GenerationFailures, MediaFailure } from '@flashly/shared/src';

interface FailureSummaryProps {
    failures: GenerationFailures;
    retryingCardIds: Set<string>;
    onRetryAudio: (failure: MediaFailure) => void;
    onRetryImage: (failure: MediaFailure) => void;
}

export function FailureSummary({ failures, retryingCardIds, onRetryAudio, onRetryImage }: FailureSummaryProps) {
    const { t } = useTranslation();
    const totalFailures = failures.audio.length + failures.image.length;
    const [isExpanded, setIsExpanded] = useState(true);

    if (totalFailures === 0) {
        return null;
    }

    return (
        <Card className="py-6 border-destructive/50 bg-destructive/5">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <CardTitle className="text-destructive">
                            {t('web.flashcards.failureSummary.title')}
                        </CardTitle>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="mr-1 h-4 w-4" />
                                {t('web.flashcards.failureSummary.collapse')}
                            </>
                        ) : (
                            <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                {t('web.flashcards.failureSummary.expand')}
                            </>
                        )}
                    </Button>
                </div>
                <CardDescription>
                    {t('web.flashcards.failureSummary.itemCount', { count: totalFailures })}
                    {failures.audio.length > 0 && ` ${t('web.flashcards.failureSummary.audioCount', { count: failures.audio.length })}`}
                    {failures.image.length > 0 && ` ${t('web.flashcards.failureSummary.imageCount', { count: failures.image.length })}`}
                </CardDescription>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-3">
                    {failures.audio.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">{t('web.flashcards.failureSummary.audioFailures')}</h4>
                            {failures.audio.map((failure) => (
                                <FailureSummaryCard
                                    key={failure.cardId}
                                    failure={failure}
                                    isRetrying={retryingCardIds.has(failure.cardId)}
                                    onRetry={() => onRetryAudio(failure)}
                                />
                            ))}
                        </div>
                    )}

                    {failures.image.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">{t('web.flashcards.failureSummary.imageFailures')}</h4>
                            {failures.image.map((failure) => (
                                <FailureSummaryCard
                                    key={failure.cardId}
                                    failure={failure}
                                    isRetrying={retryingCardIds.has(failure.cardId)}
                                    onRetry={() => onRetryImage(failure)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
