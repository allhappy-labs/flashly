import { createAuthClient } from 'better-auth/client';
import { magicLinkClient, oneTimeTokenClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:3001',
    plugins: [magicLinkClient(), oneTimeTokenClient()],
});
