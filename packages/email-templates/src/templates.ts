import { render } from '@react-email/components';
import {
  MagicLinkEmail,
  type MagicLinkEmailProps,
} from '../emails/auth/magic-link.js';
import {
  WelcomeEmail,
  type WelcomeEmailProps,
} from '../emails/auth/welcome.js';
import {
  ContactFormEmail,
  type ContactFormEmailProps,
} from '../emails/contact-form.js';
import {
  DeckSharedEmail,
  type DeckSharedEmailProps,
} from '../emails/notifications/deck-shared.js';
import {
  StudyReminderEmail,
  type StudyReminderEmailProps,
} from '../emails/notifications/study-reminder.js';
import {
  WeeklySummaryEmail,
  type WeeklySummaryEmailProps,
} from '../emails/notifications/weekly-summary.js';

// Auth Templates
export async function renderMagicLinkEmail(
  props: MagicLinkEmailProps,
): Promise<string> {
  return render(MagicLinkEmail(props));
}

export async function renderWelcomeEmail(
  props: WelcomeEmailProps,
): Promise<string> {
  return render(WelcomeEmail(props));
}

// Contact Template
export async function renderContactFormEmail(
  props: ContactFormEmailProps,
): Promise<string> {
  return render(ContactFormEmail(props));
}

// Notification Templates
export async function renderWeeklySummaryEmail(
  props: WeeklySummaryEmailProps,
): Promise<string> {
  return render(WeeklySummaryEmail(props));
}

export async function renderDeckSharedEmail(
  props: DeckSharedEmailProps,
): Promise<string> {
  return render(DeckSharedEmail(props));
}

export async function renderStudyReminderEmail(
  props: StudyReminderEmailProps,
): Promise<string> {
  return render(StudyReminderEmail(props));
}

// Export all types
export type {
  MagicLinkEmailProps,
  WelcomeEmailProps,
  ContactFormEmailProps,
  WeeklySummaryEmailProps,
  DeckSharedEmailProps,
  StudyReminderEmailProps,
};
