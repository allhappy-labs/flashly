import { Button } from '@/components/ui/button';

type AppendModeBannerProps = Readonly<{
    title: string;
    loadingMessage: string;
    errorMessage: string | null;
    fallbackErrorMessage: string;
    readyMessage: string | null;
    exitLabel: string;
    onExit: () => void;
    isLoading: boolean;
}>;

export function AppendModeBanner(props: AppendModeBannerProps) {
    return (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-sm font-semibold">{props.title}</p>
                    {props.isLoading ? (
                        <p className="text-sm text-muted-foreground">{props.loadingMessage}</p>
                    ) : props.errorMessage ? (
                        <p className="text-sm text-destructive">
                            {props.errorMessage || props.fallbackErrorMessage}
                        </p>
                    ) : props.readyMessage ? (
                        <p className="text-sm text-muted-foreground">{props.readyMessage}</p>
                    ) : null}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={props.onExit}>
                    {props.exitLabel}
                </Button>
            </div>
        </div>
    );
}
