import type { Theme } from '@react-navigation/native';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Appearance } from 'react-native';
import { useEffect, useState } from 'react';
import { brandTheme } from '@flashly/branding';

export type Palette = {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primarySoft: string;
  secondary: string;
  danger: string;
  accent: string;
};

export function getPalette(scheme: 'light' | 'dark' = 'light'): Palette {
  if (scheme === 'dark') {
    const colors = brandTheme.dark.colors;
    return {
      background: colors.background,
      card: colors.surface,
      text: colors.textStrong,
      muted: colors.textMuted,
      border: colors.border,
      primary: colors.primary,
      primarySoft: colors.primarySoft,
      secondary: colors.surface,
      danger: '#f87171',
      accent: colors.accent,
    };
  }
  const colors = brandTheme.light.colors;
  return {
    background: colors.background,
    card: colors.surface,
    text: colors.textStrong,
    muted: colors.textMuted,
    border: colors.border,
    primary: colors.primary,
    primarySoft: colors.primarySoft,
    secondary: colors.surface,
    danger: '#ef4444',
    accent: colors.accent,
  };
}

export function useAppColorScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  return scheme;
}

export function usePalette(): Palette {
  const scheme = useAppColorScheme();
  return getPalette(scheme);
}

export function getNavigationTheme(scheme: 'light' | 'dark' = 'light'): Theme {
  const palette = getPalette(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      border: palette.border,
      primary: palette.primary,
    },
  };
}
