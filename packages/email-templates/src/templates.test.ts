/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  renderMagicLinkEmail,
  renderWelcomeEmail,
  renderContactFormEmail,
  renderWeeklySummaryEmail,
  renderDeckSharedEmail,
  renderStudyReminderEmail,
} from './templates';

describe('Email Render Functions', () => {
  describe('renderMagicLinkEmail', () => {
    it('renders magic link email', async () => {
      const html = await renderMagicLinkEmail({
        magicLink: 'https://example.com/auth/verify?token=abc123',
      });
      expect(html).toContain('https://example.com/auth/verify?token=abc123');
      expect(html).toContain('Sign in to your account');
      expect(html).toContain('background-color:rgb(56,128,255)'); // Primary color
    });
  });

  describe('renderWelcomeEmail', () => {
    it('renders welcome email', async () => {
      const html = await renderWelcomeEmail({
        verificationLink: 'https://example.com/auth/verify?token=abc123',
        userName: 'Alice',
      });
      expect(html).toContain('Welcome to Flashly');
      expect(html).toContain('Alice');
      expect(html).toContain('Verify Email Address');
      expect(html).toContain('Smart Flashcard Creation');
    });
  });

  describe('renderContactFormEmail', () => {
    it('renders contact form email', async () => {
      const html = await renderContactFormEmail({
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
      });
      expect(html).toContain('John Doe');
      expect(html).toContain('john@example.com');
      expect(html).toContain('Test Subject');
      expect(html).toContain('Test message content');
      expect(html).toContain('New contact form submission');
    });
  });

  describe('renderWeeklySummaryEmail', () => {
    it('renders weekly summary email', async () => {
      const html = await renderWeeklySummaryEmail({
        weekStart: '2024-01-01',
        weekEnd: '2024-01-07',
        stats: {
          decksStudied: 5,
          cardsReviewed: 120,
          studyStreak: 7,
          accuracyRate: 85,
        },
        topDecks: [
          {
            name: 'JavaScript Basics',
            cardsStudied: 45,
            deckUrl: 'https://example.com/deck/1',
          },
        ],
        dashboardUrl: 'https://example.com/dashboard',
        unsubscribeUrl: 'https://example.com/unsubscribe',
      });
      expect(html).toContain('120');
      expect(html).toContain('JavaScript Basics');
      // The % is in a span element
      expect(html).toContain('>85<');
      expect(html).toContain('%');
    });
  });

  describe('renderDeckSharedEmail', () => {
    it('renders deck shared email', async () => {
      const html = await renderDeckSharedEmail({
        recipientName: 'Alice',
        senderName: 'Bob',
        deckName: 'Spanish Vocabulary',
        cardCount: 50,
        deckUrl: 'https://example.com/deck/1',
        shareMessage: 'Check out this deck!',
      });
      expect(html).toContain('Bob');
      expect(html).toContain('Spanish Vocabulary');
      expect(html).toContain('50');
      expect(html).toContain('Check out this deck!');
      expect(html).toContain('Deck Shared With You');
    });
  });

  describe('renderStudyReminderEmail', () => {
    it('renders study reminder email', async () => {
      const html = await renderStudyReminderEmail({
        daysSinceLastStudy: 5,
        dueCardsCount: 25,
        studyUrl: 'https://example.com/study',
        recommendedDeckName: 'Math Formulas',
      });
      expect(html).toContain('25');
      expect(html).toContain('Math Formulas');
      expect(html).toContain('Start Studying');
    });

    it('shows contextual message for 14+ days inactive', async () => {
      const html = await renderStudyReminderEmail({
        daysSinceLastStudy: 14,
        dueCardsCount: 50,
        studyUrl: 'https://example.com/study',
      });
      // The apostrophe gets HTML encoded
      expect(html).toContain('It&#x27;s been 14 days');
    });

    it('shows contextual message for 7-13 days inactive', async () => {
      const html = await renderStudyReminderEmail({
        daysSinceLastStudy: 7,
        dueCardsCount: 30,
        studyUrl: 'https://example.com/study',
      });
      expect(html).toContain('7 days since your last study session');
    });
  });
});
