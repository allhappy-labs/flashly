const SPLASH_PLUGIN_NAME = 'expo-splash-screen';
const appMode = process.env.EXPO_PUBLIC_APP_MODE === 'hosted' ? 'hosted' : 'local';
const BRAND_SPLASH = {
  image: './assets/splash-logo-mark.png',
  imageWidth: 220,
  resizeMode: 'contain',
  backgroundColor: '#062A2E',
  dark: {
    image: './assets/splash-logo-mark.png',
    backgroundColor: '#062A2E',
  },
};

const isSplashPlugin = (plugin) => {
  if (typeof plugin === 'string') {
    return plugin === SPLASH_PLUGIN_NAME;
  }

  if (Array.isArray(plugin)) {
    return plugin[0] === SPLASH_PLUGIN_NAME;
  }

  return false;
};

export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []).filter((plugin) => !isSplashPlugin(plugin)),
    [SPLASH_PLUGIN_NAME, BRAND_SPLASH],
  ],
  extra: {
    ...config.extra,
    appMode,
    apiUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001',
    frontendUrl: process.env.EXPO_PUBLIC_FRONTEND_URL || 'http://localhost:3000/',
  },
});
