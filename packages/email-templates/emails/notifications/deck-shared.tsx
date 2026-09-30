import { Hr, Img, Link, Section, Text } from '@react-email/components';
import { BrandedLayout } from '../../components/base/branded-layout.js';
import { ActionButton } from '../../components/shared/action-button.js';
import { InfoCard } from '../../components/shared/info-card.js';

export interface DeckSharedEmailProps {
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

export function DeckSharedEmail(props: Readonly<DeckSharedEmailProps>) {
  const appName = props.appName ?? 'Flashly';

  return (
    <BrandedLayout
      appName={appName}
      footer={`This deck was shared with you on ${appName}. Start studying to master new material!`}
      logoUrl={props.logoUrl}
      preview={`${props.senderName} shared a deck with you`}
      title="Deck Shared With You"
    >
      {/* Social Header */}
      <Section className="text-center mb-6">
        {props.senderAvatarUrl ? (
          <Img
            src={props.senderAvatarUrl}
            alt={`${props.senderName}'s avatar`}
            className="rounded-full mx-auto mb-3"
            width="48"
            height="48"
          />
        ) : (
          <Text className="text-[40px] m-0 mb-3">👤</Text>
        )}
        <Text className="text-text text-[16px] leading-[25px] m-0">
          <span className="font-semibold text-text-strong">
            {props.senderName}
          </span>{' '}
          wants to share a flashcard deck with you!
        </Text>
      </Section>

      {/* Deck Details */}
      <InfoCard
        text={`${props.cardCount} flashcards ready for you to study and master.`}
        title={props.deckName}
      />

      {props.deckDescription && (
        <Text className="text-text-muted text-[15px] leading-[23px] m-0 mt-4">
          {props.deckDescription}
        </Text>
      )}

      {/* Personal Message */}
      {props.shareMessage && (
        <>
          <Text className="text-text-muted text-[13px] uppercase tracking-[0.4px] m-0 mt-6 mb-2">
            Message from {props.senderName}
          </Text>
          <Section className="bg-surface-muted border border-border rounded-lg p-4 mb-5">
            <Text className="text-text text-[15px] leading-[23px] m-0 italic">
              "{props.shareMessage}"
            </Text>
          </Section>
        </>
      )}

      <Hr className="border-border my-6" />

      {/* Primary CTA */}
      <Section className="text-center my-[28px_0_24px]">
        <ActionButton href={props.deckUrl}>View Deck</ActionButton>
      </Section>

      {/* Secondary CTA */}
      <Section className="text-center mt-4">
        <Text className="text-text text-[15px] leading-[23px] m-0">
          Start studying now and track your progress with{' '}
          <Link
            href={props.deckUrl}
            className="text-primary font-semibold underline"
          >
            {appName}
          </Link>
          .
        </Text>
      </Section>
    </BrandedLayout>
  );
}
