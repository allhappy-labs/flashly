import { Link, Text } from '@react-email/components';

interface UrlDisplayProps {
  label?: string;
  url: string;
}

export function UrlDisplay({ label, url }: Readonly<UrlDisplayProps>) {
  return (
    <Text className="bg-surface-muted border border-border border-l-[4px] border-l-primary rounded-lg text-primary text-[14px] leading-[22px] p-3 m-0 break-all">
      {label && <span className="font-semibold">{label}: </span>}
      <Link href={url} className="text-primary underline">
        {url}
      </Link>
    </Text>
  );
}
