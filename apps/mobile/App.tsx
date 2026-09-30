import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { APP_MODE } from './src/config/app-mode';
import { loadAppRuntime } from './src/app/app-runtime-loader';

SplashScreen.preventAutoHideAsync().catch(() => null);

const AppRuntime = React.lazy(() =>
  loadAppRuntime(APP_MODE, {
    local: () => import('./src/app/LocalAppRuntime'),
    hosted: () => import('./src/app/HostedAppRuntime'),
  }),
);

export default function App() {
  return (
    <React.Suspense fallback={null}>
      <AppRuntime />
    </React.Suspense>
  );
}
