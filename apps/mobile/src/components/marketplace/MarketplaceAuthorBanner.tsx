import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
    name: string;
    username?: string | null;
    avatarUrl?: string | null;
    label: string;
    borderColor: string;
    cardColor: string;
    avatarColor: string;
    textColor: string;
    mutedColor: string;
};

export function MarketplaceAuthorBanner(props: Readonly<Props>) {
    const initial = props.name.charAt(0).toUpperCase() || '?';
    const showUsername = Boolean(props.username && props.username.trim());

    return (
        <View style={[styles.container, { borderColor: props.borderColor, backgroundColor: props.cardColor }]}>
            <View style={[styles.avatar, { backgroundColor: props.avatarColor }]}>
                {props.avatarUrl ? (
                    <Image source={{ uri: props.avatarUrl }} style={styles.avatarImage} />
                ) : (
                    <Text style={styles.avatarText}>{initial}</Text>
                )}
            </View>
            <View style={styles.copy}>
                <Text style={[styles.label, { color: props.mutedColor }]}>{props.label}</Text>
                <Text style={[styles.name, { color: props.textColor }]} numberOfLines={1}>
                    {props.name}
                </Text>
                {showUsername ? (
                    <Text style={[styles.username, { color: props.mutedColor }]} numberOfLines={1}>
                        @{props.username}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 40,
        height: 40,
    },
    avatarText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    copy: {
        flex: 1,
        gap: 1,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
    },
    username: {
        fontSize: 12,
        fontWeight: '500',
    },
});
