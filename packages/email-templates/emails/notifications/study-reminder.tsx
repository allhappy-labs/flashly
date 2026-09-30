import { Link, Section, Text } from '@react-email/components';
import { BrandedLayout } from '../../components/base/branded-layout.js';
import { ActionButton } from '../../components/shared/action-button.js';
import { StatsCard } from '../../components/shared/stats-card.js';

export interface StudyReminderEmailProps {
  appName?: string;
  logoUrl?: string;
  userName?: string;
  daysSinceLastStudy: number;
  dueCardsCount: number;
  recommendedDeckName?: string;
  studyUrl: string;
  preferencesUrl?: string;
}

export function StudyReminderEmail(
  props: Readonly<StudyReminderEmailProps>,
) {
  const appName = props.appName ?? 'Flashly';
  const userName = props.userName ? ` ${props.userName}` : '';
  const daysSinceLastStudy = props.daysSinceLastStudy;

  // Contextual messaging based on inactivity
  const getHeaderMessage = () => {
    if (daysSinceLastStudy >= 14)
      return `It's been ${daysSinceLastStudy} days since your last study session`;
    if (daysSinceLastStudy >= 7)
      return `${daysSinceLastStudy} days since your last study session`;
    return "Time for a quick study session?";
  };

  const getEncouragement = () => {
    if (daysSinceLastStudy >= 14)
      return "Don't worry, getting back on track is easy! Even a short session today can help you regain momentum.";
    if (daysSinceLastStudy >= 7)
      return "A week has flown by! Let's jump back in and keep your knowledge fresh.";
    return "Consistency is key to effective learning. Let's tackle those due cards!";
  };

  const headerMessage = getHeaderMessage();
  const encouragement = getEncouragement();

  return (
    <BrandedLayout
      appName={appName}
      footer={`Keep up the great work with ${appName}. Adjust your notification preferences anytime.`}
      logoUrl={props.logoUrl}
      preview={`${headerMessage} - ${props.dueCardsCount} cards waiting`}
      title={headerMessage}
    >
      <Text className="text-text text-[16px] leading-[25px] m-0 mb-5">
        {userName ? `Hi${userName},` : 'Hi there,'} {encouragement}
      </Text>

      {/* Stats Snapshot */}
      <Section className="mb-6">
        <StatsCard label="Cards Due for Review" value={props.dueCardsCount} />
      </Section>

      {/* Recommended Deck */}
      {props.recommendedDeckName && (
        <Section className="bg-surface-muted border border-border rounded-lg p-4 mb-5">
          <Text className="text-text-muted text-[13px] uppercase tracking-[0.4px] m-0 mb-1">
            Recommended Deck
          </Text>
          <Text className="text-text-strong font-semibold text-[16px] leading-[1.3] m-0">
            {props.recommendedDeckName}
          </Text>
        </Section>
      )}

      {/* Encouragement Message */}
      <Text className="text-text text-[15px] leading-[23px] m-0 mb-5">
        {daysSinceLastStudy >= 14
          ? "Ready to jump back in? Just 5-10 minutes of focused study can make a big difference in retaining what you've learned."
          : "Studying today will help strengthen your memory and keep your progress moving forward."}
      </Text>

      {/* Primary CTA */}
      <Section className="text-center my-[28px_0_24px]">
        <ActionButton href={props.studyUrl}>Start Studying</ActionButton>
      </Section>

      {/* Preferences Link */}
      {props.preferencesUrl && (
        <Section className="text-center mt-4">
          <Text className="text-text-muted text-[13px] m-0">
            Too many reminders?{' '}
            <Link
              href={props.preferencesUrl}
              className="text-text-muted underline"
            >
              Adjust your preferences
            </Link>
          </Text>
        </Section>
      )}
    </BrandedLayout>
  );
}
