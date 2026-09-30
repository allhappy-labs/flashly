import { useEffect } from 'react';
import { Linking } from 'react-native';
import { createLocalImportNavigation } from '../navigation/local-navigation-config';
import { isImportFileLink, resolveDeckDeepLink } from '../navigation/deep-links';
import type { LocalTabNavigation } from '../navigation/types';

type NavigateOrQueue = (navigation: LocalTabNavigation) => void;

type Options = Readonly<{
  navigateOrQueue: NavigateOrQueue;
}>;

export function useLocalIncomingDeepLinks(options: Options): void {
  const navigateOrQueue = options.navigateOrQueue;

  useEffect(() => {
    const handleIncomingURL = ({ url }: { url: string }) => {
      if (!url || url.includes('expo-development-client')) {
        return;
      }

      if (isImportFileLink(url)) {
        navigateOrQueue(createLocalImportNavigation(url));
        return;
      }

      const deckDeepLink = resolveDeckDeepLink(url);
      if (deckDeepLink) {
        navigateOrQueue({
          name: 'LocalTabs',
          params: {
            screen: 'DecksTab',
            params: 'params' in deckDeepLink
              ? { screen: deckDeepLink.screen, params: deckDeepLink.params }
              : { screen: deckDeepLink.screen },
          },
        });
      }
    };

    const subscription = Linking.addEventListener('url', handleIncomingURL);
    void Linking.getInitialURL().then((url) => {
      if (url) {
        handleIncomingURL({ url });
      }
    });

    return () => subscription.remove();
  }, [navigateOrQueue]);
}
