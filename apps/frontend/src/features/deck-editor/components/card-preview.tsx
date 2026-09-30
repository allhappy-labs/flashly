/**
 * CardPreview - Live preview component for card editing
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface CardPreviewProps {
  front: string;
  back: string;
  category?: string | null;
  pos?: string | null;
  gender?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
}

export function CardPreview({
  front,
  back,
  category,
  pos,
  gender,
  imageUrl,
  audioUrl,
}: CardPreviewProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="p-4 space-y-3">
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2">
          {category && (
            <Badge variant="secondary" className="text-xs">
              {category}
            </Badge>
          )}
          {pos && (
            <Badge variant="outline" className="text-xs">
              {pos}
            </Badge>
          )}
          {gender && (
            <Badge variant="outline" className="text-xs">
              {gender}
            </Badge>
          )}
        </div>

        {/* Front */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase">Front</p>
          <p className="font-medium line-clamp-3">{front || <span className="text-muted-foreground italic">No content</span>}</p>
        </div>

        {/* Image preview */}
        {imageUrl && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Image</p>
            <div className="relative w-full h-32 bg-muted rounded overflow-hidden">
              <img
                src={imageUrl}
                alt="Card preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ccc"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EError%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>
          </div>
        )}

        {/* Audio indicator */}
        {audioUrl && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Audio</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>🔊</span>
              <span className="truncate">{audioUrl}</span>
            </div>
          </div>
        )}

        {/* Back */}
        <div className="space-y-1 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase">Back</p>
          <p className="text-sm text-muted-foreground line-clamp-3">{back || <span className="italic">No content</span>}</p>
        </div>
      </CardContent>
    </Card>
  );
}
