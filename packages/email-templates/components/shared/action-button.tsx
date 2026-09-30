import { Button } from '@react-email/components';

interface ActionButtonProps {
  children: React.ReactNode;
  href: string;
  variant?: 'primary' | 'secondary' | 'success';
}

export function ActionButton({
  children,
  href,
  variant = 'primary',
}: Readonly<ActionButtonProps>) {
  const variants = {
    primary: 'bg-primary text-white',
    secondary: 'bg-surface-muted text-text-strong border border-border',
    success: 'bg-success text-white',
  };

  return (
    <Button
      href={href}
      className={`rounded-[10px] font-bold text-[16px] text-center py-[14px] px-[28px] ${variants[variant]}`}
    >
      {children}
    </Button>
  );
}
