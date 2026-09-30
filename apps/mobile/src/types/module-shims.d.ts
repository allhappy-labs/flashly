declare module '@expo/vector-icons/Ionicons' {
    import type { ComponentType } from 'react';
    import type { TextProps } from 'react-native';

    type IoniconName = string | number | symbol;

    export interface IoniconsProps extends TextProps {
        name: IoniconName;
        size?: number;
        color?: string;
    }

    const Ionicons: ComponentType<IoniconsProps> & {
        glyphMap: Record<string, number>;
    };
    export default Ionicons;
}

declare module 'expo-constants' {
    const Constants: {
        expoConfig?: {
            scheme?: string;
            extra?: {
                appMode?: string;
                apiUrl?: string;
                frontendUrl?: string;
            };
        };
    };
    export default Constants;
}

declare module 'expo-modules-core' {
    export type EventSubscription = {
        remove: () => void;
    };
}
