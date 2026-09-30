/**
 * Hook for tracking unsaved changes and warning before navigation
 */

import { useEffect, useState } from 'react';

/**
 * Compare two objects deeply for changes
 */
function hasChanges<T>(original: T | null, current: Partial<T>): boolean {
  if (!original || !current) return false;

  return Object.keys(current).some((key) => {
    const currentValue = current[key as keyof T];
    const originalValue = original[key as keyof T];

    // Handle nested objects and different types
    if (typeof currentValue === 'object' && currentValue !== null) {
      return JSON.stringify(currentValue) !== JSON.stringify(originalValue);
    }

    return currentValue !== originalValue;
  });
}

/**
 * Track unsaved changes and warn before navigation
 */
export function useUnsavedChanges<T extends object>(
  initialData: T | null,
  currentData: Partial<T>,
  options?: {
    onBeforeUnload?: boolean;
    onNavigation?: boolean;
  }
) {
  const [isDirty, setIsDirty] = useState(false);

  // Check for changes
  useEffect(() => {
    const changed = hasChanges(initialData, currentData);
    setIsDirty(changed);
  }, [initialData, currentData]);

  // Warn before unload (browser tab close/refresh)
  useEffect(() => {
    if (!options?.onBeforeUnload) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, options?.onBeforeUnload]);

  // Warn before navigation (optional - you can implement blocking navigation)
  // Note: TanStack Router doesn't have built-in navigation blocking like React Router

  return {
    hasChanges: isDirty,
    setIsDirty,
  };
}
