import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@flashly/api/trpc';

export const trpc = createTRPCContext<AppRouter>();

interface FrontendTrpcClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
}

let frontendTrpcClient: ReturnType<typeof createTRPCClient<AppRouter>> | null = null;

export function createFrontendTrpcClient(config: FrontendTrpcClientConfig) {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        fetch(input: URL | RequestInfo, init?: RequestInit) {
          return fetch(input, {
            ...init,
            credentials: 'include',
          });
        },
        headers: async () => {
          const token = await config.getAuthToken?.();
          if (!token) {
            return {};
          }

          return {
            authorization: `Bearer ${token}`,
          };
        },
        maxURLLength: 2048,
        url: `${baseUrl}/trpc`,
      }),
    ],
  });
}

export function setFrontendTrpcClient(client: ReturnType<typeof createTRPCClient<AppRouter>>) {
  frontendTrpcClient = client;
}

export function getFrontendTrpcClient() {
  return frontendTrpcClient;
}
