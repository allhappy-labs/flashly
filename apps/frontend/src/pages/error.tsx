import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@tanstack/react-router';
import { AlertCircle, Home } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function ErrorPage() {
    const { t } = useTranslation();
    const handleReload = useCallback(() => {
        globalThis.location.reload();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="py-6 max-w-md w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 text-destructive">
                        <AlertCircle className="h-full w-full" />
                    </div>
                    <CardTitle>
                        {t('web.error.title')}
                    </CardTitle>
                    <CardDescription>
                        {t('web.error.subtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground mb-6">
                        {t('web.error.description')}
                    </p>
                    <div className="flex gap-4">
                        <Button asChild variant="outline" className="flex-1">
                            <Link to="/">
                                <Home className="mr-2 h-4 w-4" />
                                {t('web.error.goHome')}
                            </Link>
                        </Button>
                        <Button onClick={handleReload} className="flex-1">
                            {t('web.error.tryAgain')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
