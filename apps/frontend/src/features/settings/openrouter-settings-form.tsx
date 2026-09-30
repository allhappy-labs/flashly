import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SensitiveInput } from '@/components/ui/sensitive-input';
import { useAuth } from '@/hooks/use-auth';
import {
    DEFAULT_OPENROUTER_MODEL,
    getOpenRouterSettings,
    saveOpenRouterSettings,
} from '@/utils/openrouter-settings';

export function OpenRouterSettingsForm() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL);

    useEffect(() => {
        const settings = getOpenRouterSettings(user?.id);
        setApiKey(settings.apiKey);
        setModel(settings.model);
    }, [user?.id]);

    const handleSave = useCallback(() => {
        const nextSettings = {
            apiKey: apiKey.trim(),
            model: model.trim() || DEFAULT_OPENROUTER_MODEL,
        };
        saveOpenRouterSettings(nextSettings, user?.id);
        setApiKey(nextSettings.apiKey);
        setModel(nextSettings.model);
        toast.success(t('web.settings.openRouter.saved'));
    }, [apiKey, model, user?.id, t]);

    const handleReset = useCallback(() => {
        const settings = getOpenRouterSettings(user?.id);
        setApiKey(settings.apiKey);
        setModel(settings.model);
    }, [user?.id]);

    return (
        <Card className="py-6">
            <CardHeader>
                <CardTitle>
                    {t('web.settings.openRouter.title')}
                </CardTitle>
                <CardDescription>
                    {t('web.settings.openRouter.subtitle')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="openrouter-settings-key">
                        {t('web.settings.openRouter.apiKey')}
                    </Label>
                    <SensitiveInput
                        id="openrouter-settings-key"
                        placeholder={t('web.settings.openRouter.apiKeyPlaceholder')}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t('web.settings.openRouter.savedLocally')}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="openrouter-settings-model">
                        {t('web.settings.openRouter.defaultModel')}
                    </Label>
                    <Input
                        id="openrouter-settings-model"
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder={t('web.settings.openRouter.defaultModelPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t('web.settings.openRouter.defaultModelHelp')}
                    </p>
                </div>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleReset}>
                        {t('common.reset')}
                    </Button>
                    <Button type="button" onClick={handleSave}>
                        {t('web.settings.openRouter.save')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
