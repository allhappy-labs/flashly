import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SensitiveInput } from '@/components/ui/sensitive-input';
import { useAuth } from '@/hooks/use-auth';
import { getElevenLabsSettings, saveElevenLabsSettings } from '@/utils/elevenlabs-settings';

export function ElevenLabsSettingsForm() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState('');
    const [voiceName, setVoiceName] = useState('');
    const [modelId, setModelId] = useState('');

    useEffect(() => {
        const settings = getElevenLabsSettings(user?.id);
        setApiKey(settings.apiKey);
        setVoiceName(settings.voiceName);
        setModelId(settings.modelId);
    }, [user?.id]);

    const handleSave = useCallback(() => {
        const nextSettings = {
            apiKey: apiKey.trim(),
            voiceName: voiceName.trim(),
            modelId: modelId.trim(),
        };
        saveElevenLabsSettings(nextSettings, user?.id);
        setApiKey(nextSettings.apiKey);
        setVoiceName(nextSettings.voiceName);
        setModelId(nextSettings.modelId);
        toast.success(t('web.settings.elevenLabs.saved'));
    }, [apiKey, modelId, voiceName, user?.id, t]);

    const handleReset = useCallback(() => {
        const settings = getElevenLabsSettings(user?.id);
        setApiKey(settings.apiKey);
        setVoiceName(settings.voiceName);
        setModelId(settings.modelId);
    }, [user?.id]);

    return (
        <Card className="py-6">
            <CardHeader>
                <CardTitle>
                    {t('web.settings.elevenLabs.title')}
                </CardTitle>
                <CardDescription>
                    {t('web.settings.elevenLabs.subtitle')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="elevenlabs-settings-key">
                        {t('web.settings.elevenLabs.apiKey')}
                    </Label>
                    <SensitiveInput
                        id="elevenlabs-settings-key"
                        placeholder={t('web.settings.elevenLabs.apiKeyPlaceholder')}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t('web.settings.elevenLabs.savedLocally')}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="elevenlabs-settings-voice">
                        {t('web.settings.elevenLabs.voiceName')}
                    </Label>
                    <Input
                        id="elevenlabs-settings-voice"
                        placeholder={t('web.settings.elevenLabs.voiceNamePlaceholder')}
                        value={voiceName}
                        onChange={(event) => setVoiceName(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t('web.settings.elevenLabs.voiceNameHelp')}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="elevenlabs-settings-model">
                        {t('web.settings.elevenLabs.modelId')}
                    </Label>
                    <Input
                        id="elevenlabs-settings-model"
                        placeholder={t('web.settings.elevenLabs.modelIdPlaceholder')}
                        value={modelId}
                        onChange={(event) => setModelId(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t('web.settings.elevenLabs.modelIdHelp')}
                    </p>
                </div>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleReset}>
                        {t('common.reset')}
                    </Button>
                    <Button type="button" onClick={handleSave}>
                        {t('web.settings.elevenLabs.save')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
