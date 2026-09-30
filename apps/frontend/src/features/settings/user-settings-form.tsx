import { startTransition, useActionState, useCallback, useOptimistic } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useUsernameCheck } from '@/hooks/use-username-check';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getFormString } from '@/utils/form-helpers';
import { useTranslation } from 'react-i18next';
import { ThemePreferenceField } from '@/features/settings/theme-preference-field';

type UpdateUserState = {
    success?: boolean;
    error?: string;
};

type UpdateUserData = {
    name?: string;
    username?: string;
    image?: string;
};

async function updateUserAction(
    _prevState: UpdateUserState,
    formData: FormData,
    updateUserFn: (data: UpdateUserData) => Promise<void>,
    translate: (key: string) => string,
): Promise<UpdateUserState> {
    const name = getFormString(formData, 'name');
    const username = getFormString(formData, 'username');

    try {
        await updateUserFn({ name, username });
        toast.success(translate('web.profile.updateSuccess'));
        return { success: true };
    } catch (error) {
        console.error('Failed to update user:', error);
        const errorMessage = error instanceof Error ? error.message : 'Update failed';
        toast.error(errorMessage);
        return { error: errorMessage };
    }
}

export function UserSettingsForm() {
    const { user, updateUser } = useAuth();
    const { t } = useTranslation();
    const [_state, submitAction, isPending] = useActionState(
        (prevState: UpdateUserState, formData: FormData) => updateUserAction(prevState, formData, updateUser, t),
        {},
    );

    const { isChecking, isAvailable, message, optimisticAvailable, checkUsername, resetState } = useUsernameCheck();

    // Optimistic updates for immediate UI feedback
    const [optimisticUser, addOptimisticUser] = useOptimistic(
        user,
        (
            currentUser,
            newUserData: Partial<{
                name?: string;
                username?: string;
                image?: string;
            }>,
        ) =>
            currentUser
                ? {
                      ...currentUser,
                      ...newUserData,
                  }
                : null,
    );

    const handleFormSubmit = useCallback(
        (formData: FormData) => {
            // Prevent submission if username is not available
            const username = getFormString(formData, 'username');
            if (username && username.length >= 3 && isAvailable === false) {
                return;
            }

            // Add optimistic update for immediate UI feedback
            startTransition(() => {
                addOptimisticUser({
                    name: getFormString(formData, 'name'),
                    username: username,
                });
            });

            return submitAction(formData);
        },
        [isAvailable, addOptimisticUser, submitAction],
    );

    const handleAvatarUploadSuccess = useCallback(
        async (url: string) => {
            // Add optimistic update for avatar
            startTransition(() => {
                addOptimisticUser({ image: url });
            });

            // Auto-save avatar to user data immediately
            try {
                await updateUser({ image: url });
            } catch (error) {
                console.error('Failed to auto-save avatar:', error);
            }
        },
        [addOptimisticUser, updateUser],
    );

    const handleUsernameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newUsername = e.target.value;
            const currentUsername = user?.username ?? '';
            startTransition(() => {
                checkUsername(newUsername, currentUsername);
            });
        },
        [user, checkUsername],
    );

    const handleReset = useCallback(() => {
        const form = document.querySelector('form');
        if (form instanceof HTMLFormElement) {
            form.reset();
        }
        resetState();
    }, [resetState]);

    return (
        <Card className="py-6">
            <CardHeader>
                <CardTitle>
                    {t('web.profile.title')}
                </CardTitle>
                <CardDescription>
                    {t('web.profile.subtitle')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <ThemePreferenceField />
                <div className="border-t" aria-hidden="true" />
                <form action={handleFormSubmit} className="space-y-6">
                    <div className="flex justify-center">
                        <AvatarUpload
                            currentImage={optimisticUser?.image || ''}
                            onUploadSuccess={handleAvatarUploadSuccess}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="name"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {t('web.profile.displayName')}
                        </label>
                        <Input
                            id="name"
                            name="name"
                            defaultValue={optimisticUser?.name || ''}
                            placeholder={t('web.profile.displayNamePlaceholder')}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="username"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {t('web.profile.username')}
                        </label>
                        <div className="relative mt-1">
                            <Input
                                id="username"
                                name="username"
                                defaultValue={optimisticUser?.username ?? ''}
                                placeholder={t('web.profile.usernamePlaceholder')}
                                onChange={handleUsernameChange}
                                className={
                                    (() => {
                                        const availability = optimisticAvailable ?? isAvailable;
                                        if (availability === true) return 'pr-10 border-green-500 focus:border-green-500';
                                        if (availability === false) return 'pr-10 border-red-500 focus:border-red-500';
                                        return 'pr-10';
                                    })()
                                }
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                {(() => {
                                    if (isChecking) return <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />;
                                    const availability = optimisticAvailable ?? isAvailable;
                                    if (availability === true) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
                                    if (availability === false) return <XCircle className="h-4 w-4 text-red-500" />;
                                    return null;
                                })()}
                            </div>
                        </div>
                        {message && (
                            <p
                                className={(() => {
                                    const availability = optimisticAvailable ?? isAvailable;
                                    const colorClass = availability === true
                                        ? 'text-green-600'
                                        : availability === false
                                          ? 'text-red-600'
                                          : 'text-gray-600';
                                    return `text-sm mt-1 ${colorClass}`;
                                })()}
                            >
                                {message}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={handleReset} disabled={isPending}>
                            {t('common.reset')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending || isChecking || (optimisticAvailable ?? isAvailable) === false}
                        >
                            {isPending ? t('common.saving') : t('common.saveChanges')}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
