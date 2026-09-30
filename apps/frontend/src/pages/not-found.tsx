import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@tanstack/react-router';
import { FileQuestion, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotFound() {
    const { t } = useTranslation();
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="py-6 max-w-md w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground">
                        <FileQuestion className="h-full w-full" />
                    </div>
                    <CardTitle>
                        {t('web.notFound.title')}
                    </CardTitle>
                    <CardDescription>
                        {t('web.notFound.subtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground mb-6">
                        {t('web.notFound.description')}
                    </p>
                    <Button asChild className="w-full">
                        <Link to="/">
                            <Home className="mr-2 h-4 w-4" />
                            {t('web.notFound.goHome')}
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
