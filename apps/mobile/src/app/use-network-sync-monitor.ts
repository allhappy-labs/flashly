import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getBackgroundSync } from '../services/sync/background-sync';
import { logger } from '../utils/logger';

export function useNetworkSyncMonitor(initialized: boolean): void {
  useEffect(() => {
    if (!initialized) {
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected ?? true;
      logger.debug('[Network] Connection state changed:', isOnline ? 'online' : 'offline');

      const backgroundSync = getBackgroundSync();
      backgroundSync.setOnlineStatus(isOnline);
    });

    void NetInfo.fetch().then((state) => {
      const isOnline = state.isConnected ?? true;
      logger.debug('[Network] Initial connection state:', isOnline ? 'online' : 'offline');

      const backgroundSync = getBackgroundSync();
      backgroundSync.setOnlineStatus(isOnline);
    });

    return () => {
      unsubscribe();
    };
  }, [initialized]);
}

