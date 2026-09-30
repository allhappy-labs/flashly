# Email Templates

React Email templates for transactional emails with Tailwind CSS styling, live preview, and easy customization.

## Tech Stack

- **Framework**: React Email
- **Styling**: Tailwind CSS with `@react-email/tailwind` (uses `pixelBasedPreset` for email client compatibility)
- **Branding**: `@flashly/branding` package for design tokens
- **Build Tool**: TypeScript
- **Testing**: Vitest
- **Components**: `@react-email/components` v1.0.8

## Key Features

- **Tailwind CSS Integration**: Modern utility-first styling with pixel-based units (99% email client compatibility)
- **Shared Components**: Reusable components (`ActionButton`, `FieldDisplay`, `StatsCard`, etc.)
- **Branded Layout**: Consistent design system with Flashly branding
- **Type-Safe**: Full TypeScript support for all template props
- **Email Client Compatible**: Tested styling for Gmail, Outlook, Apple Mail, and more

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm package manager

### Installation

```bash
pnpm install
```

### Development

Start the React Email preview server:

```bash
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002) to preview templates.

### Build

```bash
pnpm build        # Export templates and compile TypeScript
pnpm typecheck    # Type check only
pnpm test         # Run tests
```

## Available Templates

### Authentication Templates (`emails/auth/`)

- **Magic Link** (`magic-link.tsx`): Passwordless authentication
- **Welcome** (`welcome.tsx`): New user onboarding with email verification

### Notification Templates (`emails/notifications/`)

- **Weekly Summary** (`weekly-summary.tsx`): Weekly study stats and progress
- **Deck Shared** (`deck-shared.tsx`): Social deck sharing notifications
- **Study Reminder** (`study-reminder.tsx`): Contextual study reminders based on inactivity

### Contact Templates

- **Contact Form** (`contact-form.tsx`): Website contact form submissions

## Shared Components

Located in `components/shared/`:

- **ActionButton**: CTA buttons with variants (`primary`, `secondary`, `success`)
- **FieldDisplay**: Form field display with label and value
- **InfoCard**: Card component for highlighting information
- **StatsCard**: Display statistics with value, label, and optional unit
- **UrlDisplay**: Styled URL display with link

## Base Components

Located in `components/base/`:

- **EmailWrapper**: Tailwind context wrapper with `pixelBasedPreset`
- **BrandedLayout**: Consistent layout with header, card, and footer

## Usage Example

```typescript
import { renderMagicLinkEmail } from '@flashly/email-templates/src/templates';

const html = await renderMagicLinkEmail({
  appName: 'Flashly',
  logoUrl: 'https://example.com/logo.png',
  magicLink: 'https://app.example.com/auth/verify?token=abc123',
});

// Send via your email service
```

## Props Reference

### MagicLinkEmailProps

```typescript
interface MagicLinkEmailProps {
  appName?: string;
  logoUrl?: string;
  magicLink: string;
}
```

### WelcomeEmailProps

```typescript
interface WelcomeEmailProps {
  appName?: string;
  logoUrl?: string;
  userName?: string;
  verificationLink: string;
  expiryTime?: string;
  helpUrl?: string;
}
```

### WeeklySummaryEmailProps

```typescript
interface WeeklySummaryEmailProps {
  appName?: string;
  logoUrl?: string;
  userName?: string;
  weekStart: string;
  weekEnd: string;
  stats: {
    decksStudied: number;
    cardsReviewed: number;
    studyStreak: number;
    accuracyRate?: number;
  };
  topDecks: Array<{
    name: string;
    cardsStudied: number;
    deckUrl: string;
  }>;
  dashboardUrl: string;
  unsubscribeUrl: string;
}
```

### DeckSharedEmailProps

```typescript
interface DeckSharedEmailProps {
  appName?: string;
  logoUrl?: string;
  recipientName: string;
  senderName: string;
  senderAvatarUrl?: string;
  deckName: string;
  deckDescription?: string;
  cardCount: number;
  deckUrl: string;
  shareMessage?: string;
}
```

### StudyReminderEmailProps

```typescript
interface StudyReminderEmailProps {
  appName?: string;
  logoUrl?: string;
  userName?: string;
  daysSinceLastStudy: number;
  dueCardsCount: number;
  recommendedDeckName?: string;
  studyUrl: string;
  preferencesUrl?: string;
}
```

### ContactFormEmailProps

```typescript
interface ContactFormEmailProps {
  companyName?: string;
  email: string;
  logoUrl?: string;
  message: string;
  name: string;
  subject: string;
}
```

## Design Tokens

The package uses `@flashly/branding` for design tokens:

- **Colors**: `primary`, `accent`, `success`, `surface`, `surfaceMuted`, `border`, `text`, `textMuted`, `textStrong`
- **Fonts**: `primary` (Poppins), `secondary` (Space Grotesk)

## Email Client Compatibility

Styling uses Tailwind CSS with `pixelBasedPreset`, which converts `rem` units to pixels. This ensures compatibility with:

- Gmail (web + mobile)
- Outlook (web + desktop)
- Apple Mail
- Yahoo Mail
- And 99% of other email clients

## Migration from v1

See [MIGRATION.md](./MIGRATION.md) for migration guide from the inline CSS version.

## Testing

Tests verify that templates render correctly with expected content:

```bash
pnpm test
```

## License

MIT License
