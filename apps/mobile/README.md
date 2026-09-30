# Flashly mobile

## App modes

The Expo app is local-first by default.

```bash
# Local mode: no Flashly server features
pnpm --filter @flashly/mobile start

# Hosted mode: auth, sync, marketplace, and remote analytics
EXPO_PUBLIC_APP_MODE=hosted pnpm --filter @flashly/mobile start
```

Only the exact value `hosted` enables hosted features. API and frontend URL
variables are used by the Expo app only in hosted mode.
