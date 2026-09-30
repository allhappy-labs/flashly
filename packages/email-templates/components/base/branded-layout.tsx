import {
  Body,
  Container,
  Hr,
  Img,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { EmailWrapper } from './email-wrapper.js';

export interface BrandedLayoutProps {
  appName?: string;
  children: ReactNode;
  footer: string;
  logoUrl?: string;
  preview: string;
  title: string;
}

export function BrandedLayout(props: Readonly<BrandedLayoutProps>) {
  const appName = props.appName ?? 'Flashly';

  return (
    <EmailWrapper preview={props.preview}>
      <Body className="bg-surface font-body mx-0 px-[12px] py-[30px] pb-[36px]">
        <Container className="mx-auto max-w-[560px]">
          {/* Header */}
          <Section className="text-center pb-[18px]">
            {props.logoUrl ? (
              <Img
                alt={`${appName} logo`}
                src={props.logoUrl}
                className="block mx-auto h-10"
                height="40"
                width="152"
              />
            ) : (
              <Text className="font-heading font-bold text-[24px] leading-[1.1] text-text-strong m-0 mt-[2px]">
                {appName}
              </Text>
            )}
          </Section>

          {/* Card */}
          <Section className="bg-white border border-border rounded-[18px] overflow-hidden">
            <div className="bg-primary h-[6px]" />
            <Section className="p-[28px_26px_24px]">
              <Text className="font-heading font-bold text-[28px] leading-[1.2] text-text-strong m-0 mb-5">
                {props.title}
              </Text>
              <Section>{props.children}</Section>
              <Hr className="border-border my-[22px] mb-[18px]" />
              <Text className="text-text-muted text-[12px] leading-[18px] m-0">
                {props.footer}
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </EmailWrapper>
  );
}
