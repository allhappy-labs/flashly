export function isRemoteMediaUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri.trim());
}

export function usableMediaUri(
  uri: string | null | undefined,
  allowRemote: boolean,
): string | null {
  const trimmed = uri?.trim() ?? '';
  if (!trimmed) return null;
  if (!allowRemote && isRemoteMediaUri(trimmed)) return null;
  return trimmed;
}
