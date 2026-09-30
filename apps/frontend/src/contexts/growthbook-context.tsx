import { GrowthBook, GrowthBookProvider } from '@growthbook/growthbook-react';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface GrowthBookContextProviderProps {
    children: ReactNode;
}

export function GrowthBookContextProvider({ children }: Readonly<GrowthBookContextProviderProps>) {
    const [growthBook, setGrowthBook] = useState<GrowthBook>();
    const { t } = useTranslation();

    const initGrowthBook = useCallback(async () => {
        try {
            const response = await fetch('/feature-flags.json');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const features = await response.json();

            const gb = new GrowthBook({
                features,
            });

            setGrowthBook(gb);
        } catch (error) {
            console.error('Failed to load feature flags:', error);
            toast.error(t('web.growthbook.loadFailed'));

            // Initialize with empty features as fallback
            const gb = new GrowthBook({
                features: {},
            });
            setGrowthBook(gb);
        }
    }, [t]);

    useEffect(() => {
        initGrowthBook();
    }, [initGrowthBook]);

    // Always render children even if GrowthBook isn't loaded yet
    // GrowthBook will use default values for feature flags
    if (!growthBook) {
        const fallbackGb = new GrowthBook({
            features: {},
        });
        return <GrowthBookProvider growthbook={fallbackGb}>{children}</GrowthBookProvider>;
    }

    return <GrowthBookProvider growthbook={growthBook}>{children}</GrowthBookProvider>;
}
