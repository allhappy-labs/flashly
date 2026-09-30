import { Head, Html, Preview, Tailwind, pixelBasedPreset } from '@react-email/components';
import { brand } from '@flashly/branding';

interface EmailWrapperProps {
  children: React.ReactNode;
  preview: string;
}

const EMAIL_TAILWIND_CONFIG = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        primary: brand.colors.primary,
        accent: brand.colors.accent,
        success: brand.colors.success,
        surface: brand.colors.surface,
        'surface-muted': brand.colors.surfaceMuted,
        border: brand.colors.border,
        text: brand.colors.text,
        'text-muted': brand.colors.textMuted,
        'text-strong': brand.colors.textStrong,
        white: '#FFFFFF',
      },
      fontFamily: {
        body: [brand.fonts.primary, 'sans-serif'],
        heading: [brand.fonts.secondary, 'sans-serif'],
      },
    },
  },
};

export function EmailWrapper({ children, preview }: EmailWrapperProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind
        config={EMAIL_TAILWIND_CONFIG}
      >
        {children}
      </Tailwind>
    </Html>
  );
}
