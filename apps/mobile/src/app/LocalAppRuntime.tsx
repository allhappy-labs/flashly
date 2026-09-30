import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import LocalAppNavigator from '../navigation/LocalAppNavigator';
import type { LocalRootStackParamList, LocalTabNavigation } from '../navigation/types';
import i18n, { initI18n, loadPreferredLanguage } from '../i18n';
import { useStore } from '../store/useStore';
import { getNavigationTheme, getPalette, useAppColorScheme } from '../theme';
import { logger } from '../utils/logger';
import { useLocalIncomingDeepLinks } from './use-local-incoming-deep-links';

export default function LocalAppRuntime() {
  const scheme = useAppColorScheme();
  const palette = getPalette(scheme);
  const initialize = useStore((state) => state.initialize);
  const initialized = useStore((state) => state.initialized);
  const language = useStore((state) => state.language);
  const [i18nReady, setI18nReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const navigationRef = useRef<NavigationContainerRef<LocalRootStackParamList> | null>(null);
  const navigationReadyRef = useRef(false);
  const pendingNavigationRef = useRef<LocalTabNavigation | null>(null);

  const runInitialization = useCallback(async () => {
    try {
      setInitError(null);
      setI18nReady(false);
      const preferredLanguage = await loadPreferredLanguage();
      await initI18n(preferredLanguage);
      setI18nReady(true);
      await initialize(preferredLanguage ?? undefined);
    } catch (error) {
      logger.error('App init failed', error);
      setInitError(error instanceof Error ? error : new Error('Unknown initialization error'));
      setI18nReady(true);
    }
  }, [initialize]);

  useEffect(() => {
    void runInitialization();
  }, [runInitialization]);

  useEffect(() => {
    if (i18nReady && language) {
      void i18n.changeLanguage(language);
    }
  }, [i18nReady, language]);

  const navigateOrQueue = useCallback((navigation: LocalTabNavigation) => {
    if (navigationReadyRef.current && navigationRef.current?.navigate) {
      navigationRef.current.navigate(navigation.name, navigation.params);
      return;
    }
    pendingNavigationRef.current = navigation;
  }, []);

  useLocalIncomingDeepLinks({ navigateOrQueue });

  const onLayoutRootView = useCallback(async () => {
    if ((initialized && i18nReady) || initError) {
      await SplashScreen.hideAsync();
    }
  }, [i18nReady, initError, initialized]);

  if ((!initialized || !i18nReady) && !initError) {
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

  return (
    <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider onLayout={onLayoutRootView}>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              navigationReadyRef.current = true;
              const pending = pendingNavigationRef.current;
              if (pending) {
                pendingNavigationRef.current = null;
                navigationRef.current?.navigate(pending.name, pending.params);
              }
            }}
            theme={getNavigationTheme(scheme === 'dark' ? 'dark' : 'light')}
          >
            <LocalAppNavigator />
          </NavigationContainer>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </I18nextProvider>
  );
}
