import { Section, Text } from '@react-email/components';

interface FieldDisplayProps {
  label: string;
  multiline?: boolean;
  value: string;
}

export function FieldDisplay({
  label,
  multiline = false,
  value,
}: Readonly<FieldDisplayProps>) {
  return (
    <Section>
      <Text className="text-text-muted text-[13px] font-bold tracking-[0.4px] mt-4 mb-1.5 uppercase m-0">
        {label}
      </Text>
      <Text
        className={`bg-surface-muted border border-border border-l-[4px] border-l-primary rounded-lg text-text-strong text-[15px] leading-[22px] p-2.5 px-3 m-0 ${multiline ? 'min-h-[96px] py-3 px-3.5 whitespace-pre-wrap' : ''}`}
      >
        {value}
      </Text>
    </Section>
  );
}
