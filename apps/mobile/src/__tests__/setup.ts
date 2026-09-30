/**
 * Vitest setup file for mobile app tests
 */

import { vi } from 'vitest';

// Mock React Native modules
global.console = {
  ...console,
  // Suppress console logs during tests unless explicitly debugging
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  getAllKeys: vi.fn(),
  multiGet: vi.fn(),
  multiSet: vi.fn(),
  multiRemove: vi.fn(),
}));

// Mock React Native modules that might not be available in test environment
vi.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({
  default: {
    API: {
      createComponent: vi.fn(),
      createAnimatedComponent: vi.fn(),
    },
  },
}));
