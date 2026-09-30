import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SensitiveInput } from '@/components/ui/sensitive-input';
import { DEFAULT_OPENROUTER_MODEL, getOpenRouterSettings, saveOpenRouterSettings } from '@/utils/openrouter-settings';
import { getElevenLabsSettings, saveElevenLabsSettings } from '@/utils/elevenlabs-settings';
import { getUnsplashSettings, saveUnsplashSettings } from '@/utils/unsplash-settings';

type FlashcardGenerationSettingsFormProps = Readonly<{
    settingsUserId?: string;
}>;

export function FlashcardGenerationSettingsForm(props: FlashcardGenerationSettingsFormProps) {
    const { t } = useTranslation();
    const [openRouterApiKey, setOpenRouterApiKey] = useState('');
    const [openRouterModel, setOpenRouterModel] = useState(DEFAULT_OPENROUTER_MODEL);
    const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
    const [elevenLabsVoiceName, setElevenLabsVoiceName] = useState('');
    const [elevenLabsModelId, setElevenLabsModelId] = useState('');
    const [unsplashAccessKey, setUnsplashAccessKey] = useState('');

    useEffect(() => {
        const openRouterSettings = getOpenRouterSettings(props.settingsUserId);
        setOpenRouterApiKey(openRouterSettings.apiKey);
        setOpenRouterModel(openRouterSettings.model);

        const elevenLabsSettings = getElevenLabsSettings(props.settingsUserId);
        setElevenLabsApiKey(elevenLabsSettings.apiKey);
        setElevenLabsVoiceName(elevenLabsSettings.voiceName);
        setElevenLabsModelId(elevenLabsSettings.modelId);

        const unsplashSettings = getUnsplashSettings(props.settingsUserId);
        setUnsplashAccessKey(unsplashSettings.accessKey);
    }, [props.settingsUserId]);

    const handleSave = useCallback(() => {
        const nextOpenRouter = {
            apiKey: openRouterApiKey.trim(),
            model: openRouterModel.trim() || DEFAULT_OPENROUTER_MODEL,
        };
        saveOpenRouterSettings(nextOpenRouter, props.settingsUserId);
        setOpenRouterApiKey(nextOpenRouter.apiKey);
        setOpenRouterModel(nextOpenRouter.model);

        const nextElevenLabs = {
            apiKey: elevenLabsApiKey.trim(),
            voiceName: elevenLabsVoiceName.trim(),
            modelId: elevenLabsModelId.trim(),
        };
        saveElevenLabsSettings(nextElevenLabs, props.settingsUserId);
        setElevenLabsApiKey(nextElevenLabs.apiKey);
        setElevenLabsVoiceName(nextElevenLabs.voiceName);
        setElevenLabsModelId(nextElevenLabs.modelId);

        const nextUnsplash = {
            accessKey: unsplashAccessKey.trim(),
        };
        saveUnsplashSettings(nextUnsplash, props.settingsUserId);
        setUnsplashAccessKey(nextUnsplash.accessKey);

        toast.success(t('web.settings.flashcardGeneration.saved'));
    }, [
        openRouterApiKey,
        openRouterModel,
        elevenLabsApiKey,
        elevenLabsVoiceName,
        elevenLabsModelId,
        unsplashAccessKey,
        props.settingsUserId,
        t,
    ]);

    const handleReset = useCallback(() => {
        const openRouterSettings = getOpenRouterSettings(props.settingsUserId);
        setOpenRouterApiKey(openRouterSettings.apiKey);
        setOpenRouterModel(openRouterSettings.model);

        const elevenLabsSettings = getElevenLabsSettings(props.settingsUserId);
        setElevenLabsApiKey(elevenLabsSettings.apiKey);
        setElevenLabsVoiceName(elevenLabsSettings.voiceName);
        setElevenLabsModelId(elevenLabsSettings.modelId);

        const unsplashSettings = getUnsplashSettings(props.settingsUserId);
        setUnsplashAccessKey(unsplashSettings.accessKey);
    }, [props.settingsUserId]);

    return (
        <Card className="py-6">
            <CardHeader>
                <CardTitle>
                    {t('web.settings.flashcardGeneration.title')}
                </CardTitle>
                <CardDescription>
                    {t('web.settings.flashcardGeneration.description')}{' '}
                    <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                    >
                        {t('web.settings.flashcardGeneration.openRouterLink')}
                    </a>{' '}
                    {t('web.settings.flashcardGeneration.or')}{' '}
                    <a
                        href="https://elevenlabs.io/app/settings/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                    >
                        {t('web.settings.flashcardGeneration.elevenLabsLink')}
                    </a>{' '}
                    {t('web.settings.flashcardGeneration.or')}{' '}
                    <a href="https://unsplash.com/developers" target="_blank" rel="noreferrer" className="underline">
                        {t('web.settings.flashcardGeneration.unsplashLink')}
                    </a>
                    .<p className="mt-2">{t('web.settings.flashcardGeneration.providerStorageNotice')}</p>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="openrouter-settings-key">
                            {t('web.settings.flashcardGeneration.openRouterKey')}
                        </Label>
                        <SensitiveInput
                            id="openrouter-settings-key"
                            placeholder={t('web.settings.flashcardGeneration.openRouterKeyPlaceholder')}
                            value={openRouterApiKey}
                            onChange={(event) => setOpenRouterApiKey(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('web.settings.flashcardGeneration.savedLocally')}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="openrouter-settings-model">
                            {t('web.settings.flashcardGeneration.openRouterModel')}
                        </Label>
                        <Input
                            id="openrouter-settings-model"
                            value={openRouterModel}
                            onChange={(event) => setOpenRouterModel(event.target.value)}
                            placeholder={t('web.settings.flashcardGeneration.openRouterModelPlaceholder')}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('web.settings.flashcardGeneration.openRouterModelHelp')}
                        </p>
                    </div>
                </div>

                <div className="border-t" aria-hidden="true" />

                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="elevenlabs-settings-key">
                            {t('web.settings.flashcardGeneration.elevenLabsKey')}
                        </Label>
                        <SensitiveInput
                            id="elevenlabs-settings-key"
                            placeholder={t('web.settings.flashcardGeneration.elevenLabsKeyPlaceholder')}
                            value={elevenLabsApiKey}
                            onChange={(event) => setElevenLabsApiKey(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('web.settings.flashcardGeneration.savedLocally')}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="elevenlabs-settings-voice">
                            {t('web.settings.flashcardGeneration.voiceName')}
                        </Label>
                        <Input
                            id="elevenlabs-settings-voice"
                            placeholder={t('web.settings.flashcardGeneration.voiceNamePlaceholder')}
                            value={elevenLabsVoiceName}
                            onChange={(event) => setElevenLabsVoiceName(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('web.settings.flashcardGeneration.voiceNameHelp')}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="elevenlabs-settings-model">
                            {t('web.settings.flashcardGeneration.modelId')}
                        </Label>
                        <Input
                            id="elevenlabs-settings-model"
                            placeholder={t('web.settings.flashcardGeneration.modelIdPlaceholder')}
                            value={elevenLabsModelId}
                            onChange={(event) => setElevenLabsModelId(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('web.settings.flashcardGeneration.modelIdHelp')}
                        </p>
                    </div>
                </div>

                <div className="border-t" aria-hidden="true" />

                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="unsplash-settings-key">
                            {t('web.settings.flashcardGeneration.unsplashKey')}
                        </Label>
                        <SensitiveInput
                            id="unsplash-settings-key"
                            placeholder={t('web.settings.flashcardGeneration.unsplashKeyPlaceholder')}
                            value={unsplashAccessKey}
                            onChange={(event) => setUnsplashAccessKey(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('web.settings.flashcardGeneration.savedLocally')}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleReset}>
                        {t('common.reset')}
                    </Button>
                    <Button type="button" onClick={handleSave}>
                        {t('common.saveSettings')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
