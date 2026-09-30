import { Link, Section, Text } from '@react-email/components';
import { BrandedLayout } from '../../components/base/branded-layout.js';
import { ActionButton } from '../../components/shared/action-button.js';
import { InfoCard } from '../../components/shared/info-card.js';

export interface WelcomeEmailProps {
  appName?: string;
  logoUrl?: string;
  userName?: string;
  verificationLink: string;
  expiryTime?: string;
  helpUrl?: string;
}

export function WelcomeEmail(props: Readonly<WelcomeEmailProps>) {
  const appName = props.appName ?? 'Flashly';
  const previewBrandName = props.logoUrl ? appName : 'Flashly';
  const userName = props.userName ? ` ${props.userName}` : '';
  const expiryTime = props.expiryTime ?? '15 minutes';

  return (
    <BrandedLayout
      appName={appName}
      footer={`This link expires in ${expiryTime}. If you didn't create an account, you can safely ignore this email.`}
      logoUrl={props.logoUrl}
      preview={`Welcome to ${previewBrandName}!`}
      title={`Welcome to ${appName}${userName}!`}
    >
      <Text className="text-text text-[16px] leading-[25px] m-0 mb-5">
        We're thrilled to have you on board. Let's get your account set up and
        show you around.
      </Text>

      <Section className="text-center my-[28px_0_24px]">
        <ActionButton href={props.verificationLink}>
          Verify Email Address
        </ActionButton>
      </Section>

      <Text className="text-text-strong font-semibold text-[18px] leading-[1.3] m-0 mt-6 mb-4">
        What you can do with {appName}:
      </Text>

      <InfoCard
        icon="📚"
        text="Create powerful flashcard decks with AI assistance. Generate cards from any topic, document, or website URL."
        title="Smart Flashcard Creation"
      />
      <InfoCard
        icon="🎯"
        text="Study efficiently with our spaced repetition algorithm. Focus on the cards you need to learn most."
        title="Adaptive Study Sessions"
      />
      <InfoCard
        icon="📊"
        text="Track your progress with detailed analytics. See your retention rates, study streaks, and improvement over time."
        title="Progress Tracking"
      />

      {props.helpUrl && (
        <Section className="text-center mt-6">
          <Text className="text-text text-[15px] leading-[23px] m-0">
            Need help getting started? Check out our{' '}
            <Link
              href={props.helpUrl}
              className="text-primary font-semibold underline"
            >
              Help Center
            </Link>
            .
          </Text>
        </Section>
      )}
    </BrandedLayout>
  );
}
