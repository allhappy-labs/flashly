import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/hooks/use-auth', () => ({
    useAuth: () => ({
        user: {
            id: 'hosted-user-123',
        },
    }),
}));

vi.mock('@/features/settings/user-settings-form', () => ({
    UserSettingsForm: () => null,
}));

vi.mock('@/features/settings/flashcard-generation-settings-form', () => ({
    FlashcardGenerationSettingsForm: (props: Readonly<{ settingsUserId?: string }>) => (
        <div>{props.settingsUserId ?? 'missing-user-id'}</div>
    ),
}));

import { Account } from './account';

describe('Account', () => {
    it('scopes flashcard generation settings to the authenticated user', () => {
        const markup = renderToStaticMarkup(<Account />);

        expect(markup).toContain('hosted-user-123');
        expect(markup).not.toContain('missing-user-id');
    });
});
