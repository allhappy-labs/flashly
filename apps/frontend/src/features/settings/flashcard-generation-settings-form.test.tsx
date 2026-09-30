import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/button', () => ({
    Button: (props: ComponentProps<'button'>) => <button {...props} />,
}));

vi.mock('@/components/ui/card', () => ({
    Card: (props: ComponentProps<'div'>) => <div {...props} />,
    CardContent: (props: ComponentProps<'div'>) => <div {...props} />,
    CardDescription: (props: ComponentProps<'div'>) => <div {...props} />,
    CardHeader: (props: ComponentProps<'div'>) => <div {...props} />,
    CardTitle: (props: ComponentProps<'div'>) => <div {...props} />,
}));

vi.mock('@/components/ui/input', () => ({
    Input: (props: ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
    Label: (props: ComponentProps<'label'>) => <label {...props} />,
}));

vi.mock('@/components/ui/sensitive-input', () => ({
    SensitiveInput: (props: ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/utils/openrouter-settings', () => ({
    DEFAULT_OPENROUTER_MODEL: 'openai/test-model',
    getOpenRouterSettings: () => ({
        apiKey: '',
        model: 'openai/test-model',
    }),
    saveOpenRouterSettings: vi.fn(),
}));

vi.mock('@/utils/elevenlabs-settings', () => ({
    getElevenLabsSettings: () => ({
        apiKey: '',
        voiceName: '',
        modelId: '',
    }),
    saveElevenLabsSettings: vi.fn(),
}));

vi.mock('@/utils/unsplash-settings', () => ({
    getUnsplashSettings: () => ({
        accessKey: '',
    }),
    saveUnsplashSettings: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

import { FlashcardGenerationSettingsForm } from './flashcard-generation-settings-form';

describe('FlashcardGenerationSettingsForm', () => {
    it('renders Unsplash credentials and the local provider storage notice', () => {
        const markup = renderToStaticMarkup(<FlashcardGenerationSettingsForm />);

        expect(markup).toContain('id="unsplash-settings-key"');
        expect(markup).toContain('web.settings.flashcardGeneration.unsplashKey');
        expect(markup).toContain('https://unsplash.com/developers');
        expect(markup).toContain('web.settings.flashcardGeneration.providerStorageNotice');
    });
});
