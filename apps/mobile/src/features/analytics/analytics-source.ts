export function selectAnalyticsSource(
  remoteEnabled: boolean,
  userId: string | null,
): 'local' | 'remote' {
  return remoteEnabled && userId ? 'remote' : 'local';
}
