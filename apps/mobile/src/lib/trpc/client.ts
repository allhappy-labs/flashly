import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@flashly/api/trpc';

export const trpc = createTRPCContext<AppRouter>();

interface MobileTrpcClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
  getAuthCookie?: () => Promise<string | null>;
}

let mobileTrpcClient: ReturnType<typeof createTRPCClient<AppRouter>> | null = null;

export function createMobileTrpcClient(config: MobileTrpcClientConfig) {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        headers: async () => {
          const token = await config.getAuthToken?.();
          const cookie = await config.getAuthCookie?.();
          const headers: Record<string, string> = {};

          if (token) {
            headers.authorization = `Bearer ${token}`;
          }

          if (cookie) {
            headers.cookie = cookie;
          }

          return headers;
        },
        maxURLLength: 2048,
        url: `${baseUrl}/trpc`,
      }),
    ],
  });
}

export function setMobileTrpcClient(client: ReturnType<typeof createTRPCClient<AppRouter>>) {
  mobileTrpcClient = client;
}

export function getMobileTrpcClient() {
  return mobileTrpcClient;
}
