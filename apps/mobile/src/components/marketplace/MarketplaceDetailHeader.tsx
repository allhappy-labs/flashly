import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
    title: string;
    topInset: number;
    onBack: () => void;
    borderColor: string;
    backgroundColor: string;
    textColor: string;
};

export function MarketplaceDetailHeader(props: Readonly<Props>) {
    return (
        <View style={[styles.header, { paddingTop: props.topInset, borderBottomColor: props.borderColor, backgroundColor: props.backgroundColor }]}>
            <TouchableOpacity
                accessibilityRole="button"
                style={[styles.backButton, { borderColor: props.borderColor }]}
                onPress={props.onBack}
            >
                <Ionicons name="chevron-back" size={18} color={props.textColor} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={[styles.title, { color: props.textColor }]}>
                {props.title}
            </Text>
            <View style={styles.trailingSpacer} />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
    },
    trailingSpacer: {
        width: 36,
        height: 36,
    },
});
