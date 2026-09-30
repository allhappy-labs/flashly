import { Text } from '@react-email/components';
import { BrandedLayout } from '../components/base/branded-layout.js';
import { FieldDisplay } from '../components/shared/field-display.js';

export interface ContactFormEmailProps {
  companyName?: string;
  email: string;
  logoUrl?: string;
  message: string;
  name: string;
  subject: string;
}

export function ContactFormEmail(props: Readonly<ContactFormEmailProps>) {
  const companyName = props.companyName ?? 'Flashly';

  return (
    <BrandedLayout
      appName={companyName}
      footer={`This message came from the ${companyName} website contact form. Reply directly to this email to respond to ${props.name}.`}
      logoUrl={props.logoUrl}
      preview={`New contact form submission from ${props.name}`}
      title="New contact form submission"
    >
      <Text className="text-text text-[16px] leading-[25px] m-0 mb-5">
        A new message was submitted through your website contact form.
      </Text>

      <FieldDisplay label="From" value={props.name} />
      <FieldDisplay label="Email" value={props.email} />
      <FieldDisplay label="Subject" value={props.subject} />
      <FieldDisplay label="Message" multiline value={props.message} />
    </BrandedLayout>
  );
}
