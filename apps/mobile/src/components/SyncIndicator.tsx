/**
 * SyncIndicator - Visual component showing sync status
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSyncStore, selectIsSyncing, selectHasPendingSync } from '../store/sync-store';
import { usePalette } from '../theme';

interface SyncIndicatorProps {
    size?: number;
    onPress?: () => void;
}

export default function SyncIndicator({ size = 20, onPress }: SyncIndicatorProps) {
    const palette = usePalette();
    const isSyncing = useSyncStore(selectIsSyncing);
    const hasPendingSync = useSyncStore(selectHasPendingSync);

    const Wrapper = onPress ? TouchableOpacity : View;
    const wrapperProps = onPress ? { onPress } : {};

    let iconName: keyof typeof Ionicons.glyphMap = 'cloud-outline';
    let color = palette.muted;

    if (isSyncing) {
        iconName = 'sync';
        color = palette.primary;
    } else if (hasPendingSync) {
        iconName = 'cloud-upload-outline';
        color = palette.danger;
    }

    return (
        <Wrapper {...wrapperProps}>
            <View style={styles.container}>
                <Ionicons name={iconName} size={size} color={color} />
                {hasPendingSync && !isSyncing && (
                    <View style={[styles.badge, { backgroundColor: palette.danger }]} />
                )}
            </View>
        </Wrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
