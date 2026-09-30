import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { UserSettingsForm } from './user-settings-form';
import { I18nextProvider } from 'react-i18next';
import { i18n, initI18n } from '@/i18n';
import { AuthProvider } from '@/contexts/auth-context';

void initI18n();

const meta: Meta<typeof UserSettingsForm> = {
    title: 'Features/Settings/UserSettingsForm',
    component: UserSettingsForm,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'User settings form with profile information, avatar upload, and username validation.',
            },
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Default state showing user profile form with current user data.',
            },
        },
    },
};

export const EmptyUser: Story = {
    decorators: [
        (Story) => (
            <I18nextProvider i18n={i18n}>
                <AuthProvider>
                    <div className="max-w-md mx-auto">
                        <Story />
                    </div>
                </AuthProvider>
            </I18nextProvider>
        ),
    ],
    parameters: {
        docs: {
            description: {
                story: 'Form state when no user is logged in.',
            },
        },
    },
};

export const InteractiveForm: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // Find form elements
        const nameInput = canvas.getByPlaceholderText(/enter your display name/i);
        const usernameInput = canvas.getByPlaceholderText(/enter your username/i);

        // Test clearing and entering new name
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Jane Smith');

        // Test username change
        await userEvent.clear(usernameInput);
        await userEvent.type(usernameInput, 'janesmith');

        // Verify the input values
        await expect(nameInput).toHaveValue('Jane Smith');
        await expect(usernameInput).toHaveValue('janesmith');
    },
    parameters: {
        docs: {
            description: {
                story: 'Interactive test demonstrating form input interactions.',
            },
        },
    },
};

export const FormSubmission: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // Fill out the form
        const nameInput = canvas.getByPlaceholderText(/enter your display name/i);
        const submitButton = canvas.getByRole('button', { name: /save changes/i });

        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Test User');

        await expect(submitButton).toBeEnabled();
    },
    parameters: {
        docs: {
            description: {
                story: 'Prepare a valid profile edit for submission.',
            },
        },
    },
};

export const ResetForm: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // Fill out the form with new values
        const nameInput = canvas.getByPlaceholderText(/enter your display name/i);
        const usernameInput = canvas.getByPlaceholderText(/enter your username/i);
        const resetButton = canvas.getByRole('button', { name: /reset/i });

        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Modified Name');

        await userEvent.clear(usernameInput);
        await userEvent.type(usernameInput, 'modifieduser');

        // Reset the form
        await userEvent.click(resetButton);

        // Verify form is reset to original values
        await expect(nameInput).toHaveValue('');
        await expect(usernameInput).toHaveValue('');
    },
    parameters: {
        docs: {
            description: {
                story: 'Test form reset functionality.',
            },
        },
    },
};

export const UsernameValidation: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        const usernameInput = canvas.getByPlaceholderText(/enter your username/i);

        // Test short username (should trigger validation)
        await userEvent.clear(usernameInput);
        await userEvent.type(usernameInput, 'ab');

        // Test valid username length
        await userEvent.clear(usernameInput);
        await userEvent.type(usernameInput, 'validusername');

        // Verify the username input has the correct value
        await expect(usernameInput).toHaveValue('validusername');
    },
    parameters: {
        docs: {
            description: {
                story: 'Test username validation and feedback.',
            },
        },
    },
};
