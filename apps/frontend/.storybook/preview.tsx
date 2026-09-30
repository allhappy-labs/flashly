import React from 'react';
import type { Preview } from '@storybook/react-vite';
import { AuthProvider } from '../src/contexts/auth-context';
import { I18nextProvider } from 'react-i18next';
import { i18n, initI18n } from '../src/i18n';
import '../src/styles.css';

void initI18n('eng');

const preview: Preview = {
    decorators: [
        (Story, context) => {
            return (
                <I18nextProvider i18n={i18n}>
                    <AuthProvider>
                        <div className={context.parameters.layout === 'fullscreen' ? '' : 'max-w-4xl mx-auto p-4'}>
                            <Story />
                        </div>
                    </AuthProvider>
                </I18nextProvider>
            );
        },
    ], parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/,
            },
        },
    },
};

export default preview;
