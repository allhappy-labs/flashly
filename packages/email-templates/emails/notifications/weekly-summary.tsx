import { Hr, Link, Section, Text } from '@react-email/components';
import { BrandedLayout } from '../../components/base/branded-layout.js';
import { ActionButton } from '../../components/shared/action-button.js';
import { StatsCard } from '../../components/shared/stats-card.js';

export interface WeeklySummaryEmailProps {
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

export function WeeklySummaryEmail(
  props: Readonly<WeeklySummaryEmailProps>,
) {
  const appName = props.appName ?? 'Flashly';
  const userName = props.userName ? `Hi ${props.userName},` : 'Hi there,';

  return (
    <BrandedLayout
      appName={appName}
      footer={`You received this email because you use ${appName}. To stop receiving weekly summaries, you can unsubscribe below.`}
      logoUrl={props.logoUrl}
      preview={`Your weekly summary for ${props.weekStart} - ${props.weekEnd}`}
      title="Your Weekly Summary"
    >
      <Text className="text-text text-[16px] leading-[25px] m-0 mb-5">
        {userName} Here's how you did this week ({props.weekStart} -{' '}
        {props.weekEnd}):
      </Text>

      {/* Stats Grid - 2x2 */}
      <Section className="mb-6">
        <Section className="grid grid-cols-2 gap-4">
          <StatsCard
            label="Decks Studied"
            value={props.stats.decksStudied}
          />
          <StatsCard
            label="Cards Reviewed"
            value={props.stats.cardsReviewed}
          />
          <StatsCard label="Study Streak" value={props.stats.studyStreak} />
          {props.stats.accuracyRate !== undefined ? (
            <StatsCard
              label="Accuracy Rate"
              unit="%"
              value={props.stats.accuracyRate}
            />
          ) : (
            <StatsCard label="Keep Going!" value="🔥" />
          )}
        </Section>
      </Section>

      {/* Top Decks */}
      {props.topDecks.length > 0 && (
        <>
          <Text className="text-text-strong font-semibold text-[18px] leading-[1.3] m-0 mt-6 mb-4">
            Your Top Decks
          </Text>
          {props.topDecks.map((deck) => (
            <Section
              key={deck.deckUrl}
              className="bg-surface-muted border border-border rounded-lg p-4 mb-3"
            >
              <Section className="flex justify-between items-center">
                <Text className="text-text-strong font-semibold text-[16px] leading-[1.3] m-0">
                  {deck.name}
                </Text>
                <Text className="text-text-muted text-[13px] uppercase tracking-[0.4px] m-0">
                  {deck.cardsStudied} cards
                </Text>
              </Section>
            </Section>
          ))}
        </>
      )}

      <Hr className="border-border my-6" />

      {/* Encouragement Message */}
      <Text className="text-text text-[15px] leading-[23px] m-0 mb-5">
        {props.stats.studyStreak >= 7
          ? `Amazing work! You've maintained a ${props.stats.studyStreak}-day study streak. Consistency is key to mastering new material!`
          : props.stats.decksStudied >= 3
            ? `Great job studying ${props.stats.decksStudied} different decks this week! Variety helps keep learning engaging.`
            : `Every study session counts. Keep up the good work and watch your progress grow!`}
      </Text>

      <Section className="text-center my-[28px_0_24px]">
        <ActionButton href={props.dashboardUrl}>View Dashboard</ActionButton>
      </Section>

      {/* Unsubscribe Link */}
      <Section className="text-center mt-4">
        <Link
          href={props.unsubscribeUrl}
          className="text-text-muted text-[12px] underline"
        >
          Unsubscribe from weekly summaries
        </Link>
      </Section>
    </BrandedLayout>
  );
}
