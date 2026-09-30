import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/style-utils';
import type { DeckPreviewData } from './deck-preview-adapter';

/**
 * Props for the DeckImportPreview component
 */
export interface DeckImportPreviewProps {
    data: DeckPreviewData;
    labels: {
        cards: string;
        language: string;
        materialType: string;
        deckType: string;
    };
    className?: string;
}

/**
 * Header component displaying deck name and description
 */
function DeckPreviewHeader({ name, description }: { name: string; description?: string | null }) {
    return (
        <div className="space-y-1">
            <h3 className="text-base font-semibold leading-tight">{name}</h3>
            {description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
            )}
        </div>
    );
}

/**
 * Individual metadata badge component
 */
function MetadataBadge({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{label}:</span>
            <Badge variant="secondary" className="text-xs">
                {value}
            </Badge>
        </div>
    );
}

/**
 * Grid layout for deck metadata badges
 */
function DeckMetadataGrid({
    data,
    labels,
}: {
    data: DeckPreviewData;
    labels: DeckImportPreviewProps['labels'];
}) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            <MetadataBadge label={labels.cards} value={`${data.cardCount}`} />
            <MetadataBadge label={labels.language} value={data.locale} />
            {data.materialType && (
                <MetadataBadge label={labels.materialType} value={data.materialType} />
            )}
            {data.deckType && <MetadataBadge label={labels.deckType} value={data.deckType} />}
        </div>
    );
}

/**
 * Preview component for imported .flashly decks
 *
 * Displays deck metadata including name, description, card count, language,
 * material type, and deck type in a clean, organized layout.
 */
export function DeckImportPreview({ data, labels, className }: DeckImportPreviewProps) {
    if (!data) {
        return null;
    }

    return (
        <div className={cn('space-y-2', className)}>
            <DeckPreviewHeader name={data.name} description={data.description} />
            <DeckMetadataGrid data={data} labels={labels} />
        </div>
    );
}
