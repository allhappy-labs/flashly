import type { ReactNode } from 'react';

type ProgressStatusCardProps = Readonly<{
    title: string;
    progressPercent: number;
    footer: ReactNode;
}>;

export function ProgressStatusCard(props: ProgressStatusCardProps) {
    const clampedPercent = Number.isFinite(props.progressPercent)
        ? Math.min(100, Math.max(0, props.progressPercent))
        : 0;

    return (
        <div className="space-y-3 rounded-xl border border-border/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{props.title}</p>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
                <div
                    className="h-2 rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.round(clampedPercent)}%` }}
                />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">{props.footer}</div>
        </div>
    );
}
