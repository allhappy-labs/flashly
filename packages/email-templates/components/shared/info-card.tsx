import { Section, Text } from '@react-email/components';

interface InfoCardProps {
  icon?: string;
  text: string;
  title?: string;
}

function createIconMarkup(icon: string): { __html: string } {
  return { __html: icon };
}

export function InfoCard({ icon, text, title }: Readonly<InfoCardProps>) {
  return (
    <Section className="bg-surface-muted border border-border rounded-lg p-4">
      {title && (
        <Text className="font-heading font-semibold text-[16px] leading-[1.3] text-text-strong m-0 mb-1">
          {title}
        </Text>
      )}
      {icon && (
        <Text className="text-[24px] m-0 mb-2" dangerouslySetInnerHTML={createIconMarkup(icon)} />
      )}
      <Text className="text-text text-[15px] leading-[23px] m-0">{text}</Text>
    </Section>
  );
}
