export function getIntroSlideKeys(syncEnabled: boolean): string[] {
  const keys = ['language', 'create', 'recall'];
  return syncEnabled ? [...keys, 'sync'] : keys;
}
