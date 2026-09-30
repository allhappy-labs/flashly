import { Section, Text } from '@react-email/components';
import { BrandedLayout } from '../../components/base/branded-layout.js';
import { ActionButton } from '../../components/shared/action-button.js';
import { UrlDisplay } from '../../components/shared/url-display.js';

export interface MagicLinkEmailProps {
  appName?: string;
  logoUrl?: string;
  magicLink: string;
}

export function MagicLinkEmail(props: Readonly<MagicLinkEmailProps>) {
  const appName = props.appName ?? 'Flashly';
  const previewBrandName = props.logoUrl ? appName : 'Flashly';

  return (
    <BrandedLayout
      appName={appName}
      footer="This link expires in 15 minutes. If you didn't request this sign-in email, you can safely ignore it."
      logoUrl={props.logoUrl}
      preview={`Sign in to your ${previewBrandName} account`}
      title="Sign in to your account"
    >
      <Text className="text-text text-[16px] leading-[25px] m-0 mb-[18px]">
        Use this secure link to access your {appName} account.
      </Text>
      <Section className="text-center my-[28px_0_24px]">
        <ActionButton href={props.magicLink}>Sign in</ActionButton>
      </Section>
      <Text className="text-text-muted text-[13px] leading-[20px] m-0 mb-2">
        If the button does not work, copy and paste this URL into your browser:
      </Text>
      <UrlDisplay url={props.magicLink} />
    </BrandedLayout>
  );
}
