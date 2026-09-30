import { useEffect } from 'react';
import { Linking } from 'react-native';
import { APP_CAPABILITIES } from '../config/app-mode';
import { isAuthDeepLink, isImportFileLink, parseAuthDeepLink, resolveDeckDeepLink } from '../navigation/deep-links';
import { logger } from '../utils/logger';

type NavigateOrQueue = (name: string, params?: Record<string, unknown>) => void;

type Options = Readonly<{
  isAuthenticated: boolean;
  navigateOrQueue: NavigateOrQueue;
  setIntroSeen: (seen: boolean) => Promise<void>;
}>;

export function useIncomingDeepLinks(options: Options): void {
  const isAuthenticated = options.isAuthenticated;
  const navigateOrQueue = options.navigateOrQueue;
  const setIntroSeen = options.setIntroSeen;

  useEffect(() => {
    const handleIncomingURL = ({ url }: { url: string }) => {
      if (!url) {
        return;
      }

      if (url.includes('expo-development-client')) {
        return;
      }

      if (isImportFileLink(url)) {
        navigateOrQueue('DecksTab', {
          screen: 'Import',
          params: { fileUri: url },
        });
        return;
      }

      if (APP_CAPABILITIES.authentication && isAuthDeepLink(url)) {
        const authLink = parseAuthDeepLink(url);
        const token = authLink?.token ?? null;
        const ott = authLink?.ott ?? null;
        const error = authLink?.error ?? null;
        const errorDescription = authLink?.errorDescription ?? null;

        if (token || ott) {
          logger.debug('[DeepLink] Received auth token', {
            hasMagicLinkToken: Boolean(token),
            hasOneTimeToken: Boolean(ott),
          });
          void setIntroSeen(true);
          if (isAuthenticated) {
            return;
          }
          navigateOrQueue('Auth', {
            token,
            ott: ott ?? undefined,
            magicLinkAttempted: true,
            magicLinkNonce: Date.now(),
          });
        } else if (error || errorDescription) {
          logger.debug('[DeepLink] Received auth error', { error, errorDescription });
          void setIntroSeen(true);
          if (isAuthenticated) {
            return;
          }
          navigateOrQueue('Auth', {
            error: error ?? undefined,
            errorDescription: errorDescription ?? undefined,
            magicLinkAttempted: true,
            magicLinkNonce: Date.now(),
          });
        } else {
          logger.debug('[DeepLink] Auth deep link without params');
          void setIntroSeen(true);
          if (isAuthenticated) {
            return;
          }
          navigateOrQueue('Auth', {
            magicLinkAttempted: true,
            magicLinkNonce: Date.now(),
          });
        }
        return;
      }

      const deckDeepLink = resolveDeckDeepLink(url);
      if (deckDeepLink) {
        navigateOrQueue(
          'DecksTab',
          'params' in deckDeepLink
            ? { screen: deckDeepLink.screen, params: deckDeepLink.params }
            : { screen: deckDeepLink.screen }
        );
      }
    };

    const subscription = Linking.addEventListener('url', handleIncomingURL);
    void Linking.getInitialURL().then((url) => {
      if (url) {
        handleIncomingURL({ url });
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, navigateOrQueue, setIntroSeen]);
}
