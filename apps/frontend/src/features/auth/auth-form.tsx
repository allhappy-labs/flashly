import { Button } from '@/components/ui/button';
import { handleMagicLinkAuth } from './auth-utils';
import { Input } from '@/components/ui/input';
import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2Icon, MailCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

const MAGIC_LINK_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthState = {
    emailSent: boolean;
    sentAt: number | null;
    error?: string;
};

async function sendMagicLinkAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
    const email = formData.get('email');
    if (!email) {
        return { ...prevState, error: 'Email is required' };
    }

    try {
        const result = await handleMagicLinkAuth({ email: String(email) });
        if (result.error) {
            return {
                ...prevState,
                error: `Can't send magic link: ${result.error.statusText}`,
            };
        } else {
            return { emailSent: true, sentAt: Date.now() };
        }
    } catch {
        return { ...prevState, error: 'Something went wrong' };
    }
}

export function AuthForm() {
    const { t } = useTranslation();
    const [state, submitAction, isPending] = useActionState(sendMagicLinkAction, {
        emailSent: false,
        sentAt: null,
    });
    const formRef = useRef<HTMLFormElement>(null);
    const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);
    const [email, setEmail] = useState('');

    const handleSubmitButton = useCallback(() => {
        formRef.current?.requestSubmit();
    }, []);

    useEffect(() => {
        if (state.error) {
            toast.error(state.error);
        }
    }, [state.error]);

    useEffect(() => {
        if (!state.sentAt) {
            return;
        }

        setCooldownSecondsLeft(MAGIC_LINK_COOLDOWN_SECONDS);
    }, [state.sentAt]);

    useEffect(() => {
        if (cooldownSecondsLeft <= 0) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setCooldownSecondsLeft((seconds) => Math.max(seconds - 1, 0));
        }, 1000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [cooldownSecondsLeft]);

    const isCooldownActive = cooldownSecondsLeft > 0;
    const isEmailValid = EMAIL_PATTERN.test(email.trim());
    const sendButtonLabel = isCooldownActive
        ? t('web.auth.sendLoginLinkCooldown', { seconds: cooldownSecondsLeft })
        : t('web.auth.sendLoginLink');
    const handleFormSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
        if (isCooldownActive || isPending || !isEmailValid) {
            event.preventDefault();
        }
    }, [isCooldownActive, isPending, isEmailValid]);

    return (
        <Card className="py-6 mx-auto w-full max-w-2xl border-border/80 bg-background/95 shadow-[0_22px_60px_-45px_rgba(33,62,128,0.75)] lg:mx-0">
            <CardHeader className="space-y-5 pb-4 sm:pb-5">
                <CardTitle className="text-3xl leading-tight sm:text-4xl">
                    {t('web.auth.signInTitle')}
                </CardTitle>
                <CardDescription className="text-base leading-relaxed text-foreground/75 sm:text-lg">
                    {t('web.auth.signInDescription')}
                </CardDescription>
                <div className="grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                        <span>{t('web.auth.valueProps.noPassword')}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        <span>{t('web.auth.valueProps.quickAccess')}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pb-2">
                {state.emailSent ? (
                    <div className="mb-5 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                            <MailCheck className="h-4 w-4 text-primary" />
                            {t('web.auth.magicLinkSentTitle')}
                        </div>
                        <p className="mt-2">{t('web.auth.magicLinkSentDescription')}</p>
                        <div className="mt-3 flex items-center gap-2 font-medium text-foreground">
                            <MailCheck className="h-4 w-4 text-primary" />
                            {t('web.auth.magicLinkTipTitle')}
                        </div>
                        <p className="mt-2">{t('web.auth.magicLinkTipBody')}</p>
                    </div>
                ) : null}
                <form ref={formRef} action={submitAction} onSubmit={handleFormSubmit}>
                    <div className="flex flex-col gap-5">
                        {state.emailSent ? (
                            <input type="hidden" name="email" value={email} />
                        ) : (
                            <div className="grid gap-2.5">
                                <Label htmlFor="email" className="text-sm font-medium">
                                    {t('web.auth.emailLabel')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder={t('web.auth.emailPlaceholder')}
                                    value={email}
                                    onChange={(event) => {
                                        setEmail(event.target.value);
                                    }}
                                    required
                                    className="h-12 rounded-xl border-border/80 bg-background"
                                />
                            </div>
                        )}
                    </div>
                </form>
            </CardContent>
            <CardFooter className="flex-col gap-3">
                {isPending ? (
                    <Button variant="default" className="h-12 w-full rounded-xl" disabled>
                        <Loader2Icon className="animate-spin" />
                        {t('common.pleaseWait')}
                    </Button>
                ) : (
                    <Button variant="default" type="submit" className="h-12 w-full rounded-xl text-base" onClick={handleSubmitButton} disabled={isCooldownActive || !isEmailValid}>
                        {sendButtonLabel}
                    </Button>
                )}
                <p className="text-center text-xs text-muted-foreground">
                    {t('web.auth.disclaimer')}
                </p>
            </CardFooter>
        </Card>
    );
}
