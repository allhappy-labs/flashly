import { Section, Text } from '@react-email/components';

interface StatsCardProps {
  label: string;
  unit?: string;
  value: string | number;
}

export function StatsCard({ label, unit, value }: Readonly<StatsCardProps>) {
  return (
    <Section className="bg-surface-muted rounded-lg p-4 text-center">
      <Text className="text-[32px] font-bold text-text-strong mb-1 m-0">
        {value}
        {unit && <span className="text-[16px] text-text-muted ml-1">{unit}</span>}
      </Text>
      <Text className="text-[13px] text-text-muted uppercase tracking-[0.4px] m-0">
        {label}
      </Text>
    </Section>
  );
}
