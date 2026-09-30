/**
 * AuthScreen - Email authentication with magic link
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Alert,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authClient } from '../services/auth/auth-client';
import type { HostedDeckStackParamList } from '../navigation/types';
import { logger } from '../utils/logger';

type AuthScreenRouteParams = {
    token?: string;
    ott?: string;
    error?: string;
    errorDescription?: string;
    magicLinkAttempted?: boolean;
    magicLinkNonce?: number;
};

type AuthScreenRouteProp = RouteProp<{ Auth: AuthScreenRouteParams }, 'Auth'>;
const MAGIC_LINK_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getObjectProperty(value: unknown, key: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    return Reflect.get(value, key);
}

function getStringProperty(value: unknown, key: string): string | undefined {
    const property = getObjectProperty(value, key);
    return typeof property === 'string' ? property : undefined;
}

function getNumberProperty(value: unknown, key: string): number | undefined {
    const property = getObjectProperty(value, key);
    return typeof property === 'number' ? property : undefined;
}

function hasUserRecord(value: unknown): boolean {
    return Boolean(getObjectProperty(value, 'user'));
}

function getNestedObject(value: unknown, key: string): unknown {
    return getObjectProperty(value, key);
}

export default function AuthScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NativeStackNavigationProp<HostedDeckStackParamList>>();
    const route = useRoute<AuthScreenRouteProp>();

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);
    const [localError, setLocalError] = useState<string | null>(null);
    const [hasSentLink, setHasSentLink] = useState(false);
    const sessionQuery = authClient.useSession();
    const sessionData = sessionQuery.data ?? null;
    const isAuthenticated = Boolean(sessionData?.user);

    const getMagicLinkErrorMessage = (error: unknown) => {
        const details = [
            getStringProperty(error, 'code'),
            getStringProperty(error, 'message'),
            getStringProperty(error, 'statusText'),
            getStringProperty(getNestedObject(error, 'error'), 'code'),
            getStringProperty(getNestedObject(error, 'error'), 'message'),
        ]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join(' ')
            .toLowerCase();

        if (getNumberProperty(error, 'status') === 410 || details.includes('expired')) {
            return t('mobile.auth.magicLinkErrorExpired');
        }

        if (
            details.includes('used')
            || details.includes('already')
            || details.includes('consumed')
        ) {
            return t('mobile.auth.magicLinkErrorUsed');
        }

        if (
            getNumberProperty(error, 'status') === 400
            || getNumberProperty(error, 'status') === 401
            || getNumberProperty(error, 'status') === 404
            || details.includes('invalid')
            || details.includes('not found')
            || details.includes('malformed')
        ) {
            return t('mobile.auth.magicLinkErrorInvalid');
        }

        return t('mobile.auth.magicLinkErrorGeneric');
    };

    // Check for token from deep link on mount
    useEffect(() => {
        const token = route.params?.token;
        const ott = route.params?.ott;

        if (token) {
            logger.debug('[AuthScreen] Processing magic link token from deep link');
            void handleTokenVerification(token);
            return;
        }

        if (ott) {
            logger.debug('[AuthScreen] Processing one-time token from deep link');
            void handleOneTimeTokenVerification(ott);
        }
    }, [route.params?.token, route.params?.ott, route.params?.magicLinkNonce]);

    useEffect(() => {
        const error = route.params?.error;
        const errorDescription = route.params?.errorDescription;
        if (!error && !errorDescription) {
            return;
        }

        const friendlyMessage = getMagicLinkErrorMessage({
            code: error,
            message: errorDescription,
        });
        Alert.alert(t('mobile.auth.magicLinkErrorTitle'), friendlyMessage);
        setLocalError(friendlyMessage);
        navigation.setParams({ error: undefined, errorDescription: undefined, magicLinkAttempted: undefined });
    }, [navigation, route.params?.error, route.params?.errorDescription]);

    useEffect(() => {
        const attempted = route.params?.magicLinkAttempted;
        const token = route.params?.token;
        const ott = route.params?.ott;
        const error = route.params?.error;
        const errorDescription = route.params?.errorDescription;
        if (!attempted || token || ott || error || errorDescription) {
            return;
        }

        let cancelled = false;
        const timeoutId = setTimeout(() => {
            void authClient.getSession().then((sessionResult) => {
                if (cancelled) {
                    return;
                }

                const hasAuthenticatedUser = hasUserRecord(getObjectProperty(sessionResult, 'data'));
                if (hasAuthenticatedUser) {
                    navigation.setParams({ magicLinkAttempted: undefined });
                    return;
                }

                const friendlyMessage = t('mobile.auth.magicLinkErrorGeneric');
                Alert.alert(t('mobile.auth.magicLinkErrorTitle'), friendlyMessage);
                setLocalError(friendlyMessage);
                navigation.setParams({ magicLinkAttempted: undefined });
            }).catch(() => {
                if (cancelled) {
                    return;
                }

                const friendlyMessage = t('mobile.auth.magicLinkErrorGeneric');
                Alert.alert(t('mobile.auth.magicLinkErrorTitle'), friendlyMessage);
                setLocalError(friendlyMessage);
                navigation.setParams({ magicLinkAttempted: undefined });
            });
        }, 1200);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [
        navigation,
        route.params?.magicLinkAttempted,
        route.params?.token,
        route.params?.ott,
        route.params?.error,
        route.params?.errorDescription,
        t,
    ]);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            if (navigation.canGoBack()) {
                navigation.goBack();
            }
        }
    }, [isAuthenticated, navigation]);

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

    const handleAuth = async () => {
        const trimmedEmail = email.trim();
        if (!EMAIL_PATTERN.test(trimmedEmail)) {
            return;
        }

        setIsLoading(true);
        setLocalError(null);

        try {
            logger.debug('[AuthScreen] Requesting magic link');
            const result = await authClient.signIn.magicLink({
                email: trimmedEmail,
                callbackURL: 'flashly://auth',
            });
            const signInData = getObjectProperty(result, 'data');
            logger.debug('[AuthScreen] Magic link response', {
                ok: !getObjectProperty(result, 'error'),
                status: getObjectProperty(signInData, 'status'),
            });
            const resultError = getObjectProperty(result, 'error');
            if (resultError) {
                throw resultError;
            }
            setHasSentLink(true);
            setCooldownSecondsLeft(MAGIC_LINK_COOLDOWN_SECONDS);
        } catch (error) {
            logger.error('[AuthScreen] Magic link request failed', error);
            setLocalError(error instanceof Error ? error.message : t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleTokenVerification = async (token: string) => {
        setIsLoading(true);

        try {
            logger.debug('[AuthScreen] Verifying magic link token');
            const result = await authClient.magicLink.verify({
                query: { token },
            });
            const verifyData = getObjectProperty(result, 'data');
            logger.debug('[AuthScreen] Magic link verify response', {
                ok: !getObjectProperty(result, 'error'),
                hasUser: hasUserRecord(verifyData),
            });
            const resultError = getObjectProperty(result, 'error');
            if (resultError) {
                throw resultError;
            }
            if (!hasUserRecord(verifyData)) {
                throw (
                    getObjectProperty(verifyData, 'error')
                    ?? new Error(getStringProperty(verifyData, 'message') ?? 'invalid magic link')
                );
            }
            navigation.setParams({
                token: undefined,
                ott: undefined,
                error: undefined,
                errorDescription: undefined,
                magicLinkAttempted: undefined,
                magicLinkNonce: undefined,
            });

        } catch (error) {
            logger.error('[AuthScreen] Magic link verify failed', error);
            const friendlyMessage = getMagicLinkErrorMessage(error);
            Alert.alert(t('mobile.auth.magicLinkErrorTitle'), friendlyMessage);
            setLocalError(friendlyMessage);
            navigation.setParams({
                token: undefined,
                ott: undefined,
                error: undefined,
                errorDescription: undefined,
                magicLinkAttempted: undefined,
                magicLinkNonce: undefined,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOneTimeTokenVerification = async (token: string) => {
        setIsLoading(true);

        try {
            logger.debug('[AuthScreen] Verifying one-time token');
            const result = await authClient.oneTimeToken.verify({
                token,
            });
            const verifyData = getObjectProperty(result, 'data');
            logger.debug('[AuthScreen] One-time token verify response', {
                ok: !getObjectProperty(result, 'error'),
                hasUser: hasUserRecord(verifyData),
                hasSession: Boolean(getObjectProperty(verifyData, 'session')),
            });
            const resultError = getObjectProperty(result, 'error');
            if (resultError) {
                throw resultError;
            }
            if (!hasUserRecord(verifyData)) {
                throw (
                    getObjectProperty(verifyData, 'error')
                    ?? new Error(getStringProperty(verifyData, 'message') ?? 'invalid one-time token')
                );
            }
            navigation.setParams({
                token: undefined,
                ott: undefined,
                error: undefined,
                errorDescription: undefined,
                magicLinkAttempted: undefined,
                magicLinkNonce: undefined,
            });
        } catch (error) {
            logger.error('[AuthScreen] One-time token verify failed', error);
            const friendlyMessage = t('mobile.auth.magicLinkErrorGeneric');
            Alert.alert(t('mobile.auth.magicLinkErrorTitle'), friendlyMessage);
            setLocalError(friendlyMessage);
            navigation.setParams({
                token: undefined,
                ott: undefined,
                error: undefined,
                errorDescription: undefined,
                magicLinkAttempted: undefined,
                magicLinkNonce: undefined,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const benefits = useMemo(
        () => [
            t('mobile.auth.benefitSync'),
            t('mobile.auth.benefitSmart'),
            t('mobile.auth.benefitOffline'),
        ],
        [t]
    );

    const authColors = useMemo(
        () => ({
            background: '#0a0f1f',
            surface: '#121a2f',
            border: '#1f2a44',
            text: '#f5f7ff',
            textMuted: '#b7c2df',
            primary: '#5a6bff',
        }),
        []
    );
    const styles = React.useMemo(() => createStyles(), []);
    const canSubmit = EMAIL_PATTERN.test(email.trim()) && !isLoading && cooldownSecondsLeft === 0;
    const sendButtonLabel = cooldownSecondsLeft > 0
        ? t('web.auth.sendLoginLinkCooldown', { seconds: cooldownSecondsLeft })
        : t('web.auth.sendLoginLink');

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: authColors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <View style={styles.header}>
                    <Text style={[styles.brand, { color: authColors.primary }]}>{t('brand.name')}</Text>
                    <Text style={[styles.title, { color: authColors.text }]}>
                        {t('mobile.auth.title')}
                    </Text>
                    <Text style={[styles.subtitle, { color: authColors.textMuted }]}>
                        {t('mobile.auth.subtitle')}
                    </Text>
                </View>

                <View style={styles.form}>
                    <Text style={[styles.label, { color: authColors.textMuted }]}>
                        {t('web.auth.emailLabel')}
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: authColors.surface,
                                color: authColors.text,
                                borderColor: authColors.border,
                            },
                        ]}
                        placeholder={t('web.auth.emailPlaceholder')}
                        placeholderTextColor={authColors.textMuted}
                        value={email}
                        onChangeText={(value) => {
                            if (localError) setLocalError(null);
                            if (hasSentLink) setHasSentLink(false);
                            setEmail(value);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        editable={!isLoading}
                        returnKeyType="send"
                        onSubmitEditing={() => {
                            if (canSubmit) handleAuth();
                        }}
                    />

                    {localError ? (
                        <View style={[styles.message, { borderColor: authColors.border, backgroundColor: authColors.surface }]}>
                            <Text style={[styles.messageText, { color: authColors.text }]}>
                                {localError}
                            </Text>
                        </View>
                    ) : null}

                    {hasSentLink ? (
                        <View style={[styles.success, { borderColor: authColors.border, backgroundColor: authColors.surface }]}>
                            <Text style={[styles.successTitle, { color: authColors.text }]}>
                                {t('web.auth.magicLinkSentTitle')}
                            </Text>
                            <Text style={[styles.successText, { color: authColors.textMuted }]}>
                                {t('web.auth.magicLinkSentDescription')}
                            </Text>
                            <Text style={[styles.successHint, { color: authColors.textMuted }]}>
                                {t('mobile.auth.magicLinkHint')}
                            </Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[
                            styles.button,
                            { backgroundColor: authColors.primary, opacity: canSubmit ? 1 : 0.6 },
                        ]}
                        onPress={handleAuth}
                        disabled={!canSubmit}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>
                                {sendButtonLabel}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.benefits}>
                    <Text style={[styles.benefitsTitle, { color: authColors.text }]}>
                        {t('mobile.auth.benefitsTitle')}
                    </Text>
                    {benefits.map((benefit) => (
                        <View key={benefit} style={styles.benefitRow}>
                            <View style={[styles.bullet, { backgroundColor: authColors.primary }]} />
                            <Text style={[styles.benefitText, { color: authColors.textMuted }]}>
                                {benefit}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: authColors.textMuted }]}>
                        {t('mobile.auth.privacyNote')}
                    </Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

function createStyles() {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            flex: 1,
            paddingHorizontal: 24,
            justifyContent: 'center',
        },
        header: {
            marginBottom: 28,
        },
        brand: {
            fontSize: 14,
            fontWeight: '600',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 12,
        },
        title: {
            fontSize: 30,
            fontWeight: '700',
            marginBottom: 10,
        },
        subtitle: {
            fontSize: 15,
            lineHeight: 22,
        },
        form: {
            width: '100%',
        },
        label: {
            fontSize: 14,
            marginBottom: 8,
        },
        input: {
            height: 50,
            borderRadius: 12,
            paddingHorizontal: 16,
            fontSize: 16,
            borderWidth: 1,
            marginBottom: 16,
        },
        message: {
            borderRadius: 12,
            borderWidth: 1,
            padding: 12,
            marginBottom: 12,
        },
        messageText: {
            fontSize: 13,
            lineHeight: 18,
        },
        success: {
            borderRadius: 16,
            borderWidth: 1,
            padding: 14,
            marginBottom: 16,
            gap: 6,
        },
        successTitle: {
            fontSize: 14,
            fontWeight: '600',
        },
        successText: {
            fontSize: 13,
            lineHeight: 18,
        },
        successHint: {
            fontSize: 12,
            lineHeight: 16,
        },
        button: {
            height: 50,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        buttonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '600',
        },
        benefits: {
            marginTop: 12,
            gap: 10,
        },
        benefitsTitle: {
            fontSize: 14,
            fontWeight: '600',
        },
        benefitRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        bullet: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        benefitText: {
            fontSize: 13,
            lineHeight: 18,
            flex: 1,
        },
        footer: {
            marginTop: 24,
        },
        footerText: {
            fontSize: 12,
            lineHeight: 16,
        },
    });
}
