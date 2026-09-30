import { createMessage } from '@upyo/core';
import { PlunkTransport } from '@upyo/plunk';
import { z } from 'zod';
import type { ResultAsync } from 'neverthrow';
import { okAsync, errAsync } from 'neverthrow';
import { config } from '../config/app.ts';
import {
    renderContactFormEmail,
    renderMagicLinkEmail,
    renderWelcomeEmail,
    renderWeeklySummaryEmail,
    renderDeckSharedEmail,
    renderStudyReminderEmail,
    type WelcomeEmailProps,
    type WeeklySummaryEmailProps,
    type DeckSharedEmailProps,
    type StudyReminderEmailProps,
} from '@flashly/email-templates/src/templates';
import {
    ValidationError,
    ExternalServiceError,
    ConfigurationError,
    safeAsync,
    safeValidate,
} from '@flashly/shared';
import { sanitizeEmailSubject } from '../lib/utils/sanitization.ts';

// Email validation schema that matches the Plunk transport requirements
const EmailSchema = z.custom<`${string}@${string}`>(
    (val): val is `${string}@${string}` => {
        return (
            typeof val === 'string' && val.includes('@') && val.indexOf('@') > 0 && val.indexOf('@') < val.length - 1
        );
    },
    { message: 'Must be in format: text@text' },
);

let plunkClient: PlunkTransport | null = null;

type PlunkErrorDetails = {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
    status?: number;
    responseBody?: unknown;
    errorMessages?: string[];
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getStringProperty(value: unknown, key: string): string | undefined {
    if (!isObjectRecord(value)) {
        return undefined;
    }
    const prop = Reflect.get(value, key);
    return typeof prop === 'string' ? prop : undefined;
}

function getNumberProperty(value: unknown, key: string): number | undefined {
    if (!isObjectRecord(value)) {
        return undefined;
    }
    const prop = Reflect.get(value, key);
    return typeof prop === 'number' ? prop : undefined;
}

function getRecordProperty(value: unknown, key: string): Record<string, unknown> | undefined {
    if (!isObjectRecord(value)) {
        return undefined;
    }
    const prop = Reflect.get(value, key);
    return isObjectRecord(prop) ? prop : undefined;
}

function getStringArrayProperty(value: unknown, key: string): string[] | undefined {
    if (!isObjectRecord(value)) {
        return undefined;
    }
    const prop = Reflect.get(value, key);
    if (!Array.isArray(prop)) {
        return undefined;
    }

    return prop.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
}

function extractPlunkErrorDetails(error: unknown): PlunkErrorDetails {
    const response = getRecordProperty(error, 'response');

    return {
        name: getStringProperty(error, 'name'),
        message: getStringProperty(error, 'message'),
        stack: getStringProperty(error, 'stack'),
        code: getStringProperty(error, 'code'),
        status:
            getNumberProperty(response, 'status')
            ?? getNumberProperty(response, 'statusCode')
            ?? getNumberProperty(error, 'statusCode')
            ?? getNumberProperty(error, 'status'),
        responseBody: response ? Reflect.get(response, 'body') : undefined,
        errorMessages: getStringArrayProperty(error, 'errorMessages'),
    };
}

export function resetEmailClient() {
    plunkClient = null;
}

/**
 * Get or create Plunk client with Result type
 */
function getPlunkClient(): ResultAsync<PlunkTransport, ConfigurationError> {
    if (plunkClient) {
        return okAsync(plunkClient);
    }

    if (!config.MAIL_API_KEY) {
        return errAsync(
            new ConfigurationError('Email is not configured. Please set MAIL_API_KEY environment variable.', {
                context: { service: 'plunk' },
            })
        );
    }

    return safeAsync(
        (async () => {
            const client = new PlunkTransport({
                apiKey: config.MAIL_API_KEY,
                ...(config.PLUNK_BASE_URL ? { baseUrl: config.PLUNK_BASE_URL } : {}),
                ...(config.PLUNK_VALIDATE_SSL !== undefined ? { validateSsl: config.PLUNK_VALIDATE_SSL } : {}),
            });

            const httpClient = getRecordProperty(client, 'httpClient');
            const createPlunkError = httpClient ? Reflect.get(httpClient, 'createPlunkError') : undefined;

            if (httpClient && typeof createPlunkError === 'function') {
                Reflect.set(httpClient, 'createPlunkError', (message: string, statusCode?: number) => {
                    const error = new Error(message);
                    Reflect.set(error, 'statusCode', statusCode);
                    return error;
                });
            }

            plunkClient = client;
            return client;
        })(),
        (error) => new ConfigurationError('Failed to initialize Plunk client', { cause: error })
    );
}

export interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export type Logger = {
    error: (obj: unknown, msg?: string) => void;
    warn?: (obj: unknown, msg?: string) => void;
    info?: (obj: unknown, msg?: string) => void;
};

/**
 * Send email with neverthrow Result types
 */
export function sendEmail(
    options: EmailOptions,
    logger?: Logger
): ResultAsync<void, ValidationError | ConfigurationError | ExternalServiceError> {
    // Check configuration
    if (!config.MAIL_API_KEY || !config.MAIL_FROM_EMAIL) {
        const message = 'Plunk not configured - email not sent';
        if (logger?.warn) {
            logger.warn({ subject: options.subject, to: options.to }, message);
        } else {
            console.warn(message, options.subject, 'to', options.to);
        }
        // Return success for unconfigured email (don't break the app)
        return okAsync(undefined);
    }

    // Validate email addresses
    const fromEmailResult = safeValidate(EmailSchema, config.MAIL_FROM_EMAIL);
    const toEmailResult = safeValidate(EmailSchema, options.to);

    if (fromEmailResult.isErr()) {
        return errAsync(
            new ValidationError('Invalid from email address', {
                context: { email: config.MAIL_FROM_EMAIL, field: 'from' },
            })
        );
    }

    if (toEmailResult.isErr()) {
        return errAsync(
            new ValidationError('Invalid to email address', {
                context: { email: options.to, field: 'to' },
            })
        );
    }

    const fromEmail = fromEmailResult.value;
    const toEmail = toEmailResult.value;

    // Get transport client
    return getPlunkClient().andThen((transport) => {
        // Create message
        const content = options.html ? { html: options.html, text: options.text } : { text: options.text || '' };

        const message = createMessage({
            content,
            from: {
                address: fromEmail,
                name: config.MAIL_FROM_NAME || 'Flashly',
            },
            subject: options.subject,
            to: toEmail,
        });

        // Send email
        return safeAsync(transport.send(message), (error) => {
            const details = extractPlunkErrorDetails(error);

            if (logger) {
                logger.error(
                    {
                        err: {
                            message: details.message,
                            name: details.name,
                            code: details.code,
                            stack: details.stack,
                            errorMessages: details.errorMessages,
                        },
                        status: details.status,
                        responseBody: details.responseBody,
                        to: options.to,
                        from: config.MAIL_FROM_EMAIL,
                    },
                    'Plunk email send failed'
                );
            } else {
                console.error('Failed to send email via Plunk:', {
                    message: details.message,
                    status: details.status,
                    responseBody: details.responseBody,
                    to: options.to,
                    from: config.MAIL_FROM_EMAIL,
                });
            }

            return new ExternalServiceError(
                `Failed to send email: ${details.message || 'Unknown error'}`,
                'plunk',
                {
                    cause: error,
                    context: {
                        status: details.status,
                        responseBody: details.responseBody,
                        to: options.to,
                        from: config.MAIL_FROM_EMAIL,
                        errorMessages: details.errorMessages,
                    },
                }
            );
        }).andThen((receipt) => {
            if (!receipt.successful && 'errorMessages' in receipt) {
                const stringMessages = receipt.errorMessages.map((errorMessage) =>
                    typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)
                );

                return errAsync(
                    new ExternalServiceError(
                        `Email delivery failed: ${stringMessages.join(', ')}`,
                        'plunk',
                        {
                            context: {
                                to: options.to,
                                subject: options.subject,
                                errorMessages: stringMessages,
                            },
                        }
                    )
                );
            }

            return okAsync(undefined);
        });
    });
}

/**
 * Send magic link email with neverthrow Result types
 */
export function sendMagicLinkEmail(
    email: string,
    magicLink: string,
    logger?: Logger
): ResultAsync<void, ValidationError | ConfigurationError | ExternalServiceError> {
    const subject = 'Sign in to your account';
    const appName = config.MAIL_FROM_NAME || 'Flashly';
    const templateAppName = config.MAIL_LOGO_URL ? appName : 'Flashly';

    return safeAsync(
        (async () => renderMagicLinkEmail({ appName: templateAppName, logoUrl: config.MAIL_LOGO_URL, magicLink }))(),
        (error) => new ExternalServiceError('Failed to render magic link email template', 'email-template', { cause: error })
    ).andThen((html) => {
        const text = `Sign in to your ${templateAppName} account

Click the link below to sign in to your account:
${magicLink}

This link will expire in 15 minutes. If you didn't request this, you can safely ignore this email.`;

        return sendEmail(
            {
                html,
                subject,
                text,
                to: email,
            },
            logger
        );
    });
}

export interface ContactFormData {
    name: string;
    email: string;
    message: string;
}

/**
 * Send contact form email with neverthrow Result types
 */
export function sendContactFormEmail(
    contactData: ContactFormData,
    toEmail?: string,
    logger?: Logger
): ResultAsync<void, ValidationError | ConfigurationError | ExternalServiceError> {
    const recipient = toEmail || config.MAIL_FROM_EMAIL;
    const companyName = config.MAIL_FROM_NAME || 'Flashly';
    const templateCompanyName = config.MAIL_LOGO_URL ? companyName : 'Flashly';

    const sanitizedName = sanitizeEmailSubject(contactData.name);
    const subject = `New Contact Form Submission from ${sanitizedName}`;

    return safeAsync(
        (async () => renderContactFormEmail({
            ...contactData,
            logoUrl: config.MAIL_LOGO_URL,
            subject: 'General Inquiry', // Default subject for email template
            companyName: templateCompanyName,
        }))(),
        (error) => new ExternalServiceError('Failed to render contact form email template', 'email-template', { cause: error })
    ).andThen((html) => {
        const text = `New Contact Form Submission

From: ${contactData.name}
Email: ${contactData.email}

Message:
${contactData.message}

---
This message was sent through the ${templateCompanyName} website contact form.
Reply directly to this email to respond to ${contactData.name}.`;

        return sendEmail(
            {
                html,
                subject,
                text,
                to: recipient,
            },
            logger
        );
    });
}

/**
 * Send welcome email with neverthrow Result types
 */
export function sendWelcomeEmail(
    email: string,
    props: Omit<WelcomeEmailProps, 'appName' | 'logoUrl'>,
    logger?: Logger
): ResultAsync<void, ValidationError | ConfigurationError | ExternalServiceError> {
    const subject = 'Welcome to Flashly!';
    const appName = config.MAIL_FROM_NAME || 'Flashly';

    return safeAsync(
        (async () => renderWelcomeEmail({
            ...props,
            appName,
            logoUrl: config.MAIL_LOGO_URL,
        }))(),
        (error) => new ExternalServiceError('Failed to render welcome email template', 'email-template', { cause: error })
    ).andThen((html) => {
        const userName = props.userName ? ` ${props.userName}` : '';
        const text = `Welcome to Flashly${userName}!

Thank you for signing up. Please verify your email address by clicking the link below:
${props.verificationLink}

This link will expire in ${props.expiryTime || '15 minutes'}. If you didn't create an account, you can safely ignore this email.`;

        return sendEmail(
            {
                html,
                subject,
                text,
                to: email,
            },
            logger
        );
    });
}

/**
 * Send weekly summary email with neverthrow Result types
 */
export function sendWeeklySummaryEmail(
    email: string,
    props: Omit<WeeklySummaryEmailProps, 'appName' | 'logoUrl'>,
    logger?: Logger
): ResultAsync<void, ValidationError | ConfigurationError | ExternalServiceError> {
    const subject = 'Your Weekly Summary';
    const appName = config.MAIL_FROM_NAME || 'Flashly';

    return safeAsync(
        (async () => renderWeeklySummaryEmail({
            ...props,
            appName,
            logoUrl: config.MAIL_LOGO_URL,
        }))(),
        (error) => new ExternalServiceError('Failed to render weekly summary email template', 'email-template', { cause: error })
    ).andThen((html) => {
        const text = `Your Weekly Summary (${props.weekStart} - ${props.weekEnd})

Here's how you did this week:
- Decks studied: ${props.stats.decksStudied}
- Cards reviewed: ${props.stats.cardsReviewed}
- Study streak: ${props.stats.studyStreak} days
${props.stats.accuracyRate !== undefined ? `- Accuracy rate: ${props.stats.accuracyRate}%` : ''}

${props.topDecks.length > 0 ? 'Your top decks:\n' + props.topDecks.map(d => `- ${d.name} (${d.cardsStudied} cards)`).join('\n') : ''}

Keep up the great work!`;

        return sendEmail(
            {
                html,
                subject,
                text,
                to: email,
            },
            logger
        );
    });
}

/**
 * Send deck shared email with neverthrow Result types
 */
export function sendDeckSharedEmail(
    email: string,
    props: Omit<DeckSharedEmailProps, 'appName' | 'logoUrl'>,
    logger?: Logger
): ResultAsync<void, ValidationError | ConfigurationError | ExternalServiceError> {
    const subject = `${props.senderName} shared a deck with you`;
    const appName = config.MAIL_FROM_NAME || 'Flashly';

    return safeAsync(
        (async () => renderDeckSharedEmail({
            ...props,
            appName,
            logoUrl: config.MAIL_LOGO_URL,
        }))(),
        (error) => new ExternalServiceError('Failed to render deck shared email template', 'email-template', { cause: error })
    ).andThen((html) => {
        const text = `${props.senderName} wants to share a flashcard deck with you!

Deck: ${props.deckName}
Cards: ${props.cardCount}

${props.shareMessage ? `Message: ${props.shareMessage}\n` : ''}View the deck here:
${props.deckUrl}

This deck was shared with you on ${appName}.`;

        return sendEmail(
            {
                html,
                subject,
                text,
                to: email,
            },
            logger
        );
    });
}

/**
 * Send study reminder email with neverthrow Result types
 */
export function sendStudyReminderEmail(
    email: string,
    props: Omit<StudyReminderEmailProps, 'appName' | 'logoUrl'>,
    logger?: Logger
): ResultAsync<void, ValidationError | ConfigurationError | ExternalServiceError> {
    const subject = props.daysSinceLastStudy >= 14
        ? "Time to get back to studying?"
        : "Study reminder";
    const appName = config.MAIL_FROM_NAME || 'Flashly';

    return safeAsync(
        (async () => renderStudyReminderEmail({
            ...props,
            appName,
            logoUrl: config.MAIL_LOGO_URL,
        }))(),
        (error) => new ExternalServiceError('Failed to render study reminder email template', 'email-template', { cause: error })
    ).andThen((html) => {
        const userName = props.userName ? ` ${props.userName}` : '';
        const text = `Hi${userName},

It's been ${props.daysSinceLastStudy} days since your last study session.

You have ${props.dueCardsCount} cards due for review.
${props.recommendedDeckName ? `Recommended deck: ${props.recommendedDeckName}` : ''}

Start studying here:
${props.studyUrl}

Keep up the great work with ${appName}!`;

        return sendEmail(
            {
                html,
                subject,
                text,
                to: email,
            },
            logger
        );
    });
}
