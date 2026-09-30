import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const toasterStyle = {
    '--normal-bg': 'var(--popover)', '--normal-border': 'var(--border)', '--normal-text': 'var(--popover-foreground)',
} as React.CSSProperties;

const Toaster = (props: Readonly<ToasterProps>) => {
    const { theme = 'system' } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps['theme']}
            className="toaster group"
            style={toasterStyle}
            {...props}
        />
    );
};

export { Toaster };
