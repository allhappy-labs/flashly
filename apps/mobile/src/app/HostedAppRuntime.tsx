import { NavigationContainer, type NavigationContainerRef, type ParamListBase } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from '../navigation/AppNavigator';
import i18n, { initI18n, loadPreferredLanguage } from '../i18n';
import { useStore } from '../store/useStore';
import { getNavigationTheme, getPalette, useAppColorScheme } from '../theme';
import { initServices } from '../services/init';
import { setSessionToken } from '../services/auth/auth-client';
import { hydrateAuthStorage } from '../services/auth/auth-storage';
import { queryClient } from '../lib/react-query/query-client';
import { getMobileTrpcClient, trpc } from '../lib/trpc/client';
import { logger } from '../utils/logger';
import { AuthSessionBridge } from './auth-session-bridge';
import { useNetworkSyncMonitor } from './use-network-sync-monitor';
import { useIncomingDeepLinks } from './use-incoming-deep-links';

export default function HostedAppRuntime() {
  const scheme = useAppColorScheme();
  const palette = getPalette(scheme);
  const initialize = useStore((state) => state.initialize);
  const initialized = useStore((state) => state.initialized);
  const language = useStore((state) => state.language);
  const setUserId = useStore((state) => state.setUserId);
  const setIntroSeen = useStore((state) => state.setIntroSeen);
  const [i18nReady, setI18nReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const [authStorageReady, setAuthStorageReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<ParamListBase> | null>(null);
  const navigationReadyRef = useRef(false);
  const pendingNavigationRef = useRef<{ name: string; params?: Record<string, unknown> } | null>(null);

  const runInitialization = useCallback(async () => {
    try {
      setInitError(null);
      setI18nReady(false);
      try {
        await hydrateAuthStorage();
        await initServices();
        const preferredLanguage = await loadPreferredLanguage();
        await initI18n(preferredLanguage);
        setI18nReady(true);
        await initialize(preferredLanguage ?? undefined);
      } catch (error) {
        logger.error('App init failed', error);
        setInitError(error instanceof Error ? error : new Error('Unknown initialization error'));
        setI18nReady(true);
      } finally {
        setAuthStorageReady(true);
      }
    } catch (error) {
      logger.error('Unexpected init wrapper error', error);
      setInitError(error instanceof Error ? error : new Error('Unknown initialization error'));
      setI18nReady(true);
      setAuthStorageReady(true);
    }
  }, [initialize]);

  useEffect(() => {
    void runInitialization();
  }, [runInitialization]);

  useNetworkSyncMonitor(initialized);

  useEffect(() => {
    if (i18nReady && language) {
      void i18n.changeLanguage(language);
    }
  }, [i18nReady, language]);

  const navigateOrQueue = useCallback((name: string, params?: Record<string, unknown>) => {
    if (navigationReadyRef.current && navigationRef.current?.navigate) {
      navigationRef.current.navigate(name, params);
      return;
    }
    pendingNavigationRef.current = { name, params };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!navigationReadyRef.current || !pendingNavigationRef.current) return;
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    navigationRef.current?.navigate(pending.name, pending.params);
  }, [isAuthenticated]);

  useIncomingDeepLinks({
    isAuthenticated,
    navigateOrQueue,
    setIntroSeen,
  });

  const onLayoutRootView = useCallback(async () => {
    if ((initialized && i18nReady) || initError) {
      await SplashScreen.hideAsync();
    }
  }, [i18nReady, initError, initialized]);

  const handleAuthStateChange = useCallback(
    (nextState: {
      isPending: boolean;
      isAuthenticated: boolean;
      userId: string | null;
      sessionToken: string | null;
    }) => {
      setIsAuthenticated(nextState.isAuthenticated);
      setUserId(nextState.userId);
      setSessionToken(nextState.sessionToken);
    },
    [setUserId],
  );

  if ((!authStorageReady || !initialized || !i18nReady) && !initError) {
    return null;
  }

  if (initError) {
    const errorMessage =
      initError.message && initError.message !== 'Unknown initialization error'
        ? initError.message
        : i18n.t('mobile.init.fallbackErrorBody');

    return (
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backgroundColor: palette.background,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: palette.text }}>
            {i18n.t('mobile.init.errorTitle')}
          </Text>
          <Text style={{ textAlign: 'center', color: palette.muted, marginBottom: 16 }}>
            {errorMessage}
          </Text>
          <Pressable
            onPress={runInitialization}
            style={({ pressed }) => ({
              backgroundColor: palette.primary,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{i18n.t('mobile.init.retry')}</Text>
          </Pressable>
        </View>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaProvider>
    );
  }

  const trpcClient = getMobileTrpcClient();
  if (!trpcClient) {
    return null;
  }

  return (
    <trpc.TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider onLayout={onLayoutRootView}>
              <AuthSessionBridge onStateChange={handleAuthStateChange} />
              <NavigationContainer
                ref={navigationRef}
                onReady={() => {
                  navigationReadyRef.current = true;
                  if (isAuthenticated && pendingNavigationRef.current) {
                    const pending = pendingNavigationRef.current;
                    pendingNavigationRef.current = null;
                    navigationRef.current?.navigate(pending.name, pending.params);
                  }
                }}
                theme={getNavigationTheme(scheme === 'dark' ? 'dark' : 'light')}
              >
                <AppNavigator />
              </NavigationContainer>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </I18nextProvider>
      </QueryClientProvider>
    </trpc.TRPCProvider>
  );
}
