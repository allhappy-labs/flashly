/**
 * MarketplaceDetailScreen - View and add a public deck
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
    ELEVENLABS_V3_LANGUAGES,
    FLASHCARD_FORMATS,
    FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS,
    ROMANIZATION_PREFERENCES,
    type FlashcardFormat,
    type RomanizationPreference,
} from '@flashly/shared';
import { usePalette } from '../theme';
import type { HostedDeckStackParamList } from '../navigation/types';
import { getMarketplaceService } from '../services/marketplace/marketplace-service';
import { getDeckAccent, isFlashcardMaterialType } from '../services/marketplace/marketplace-ui-utils';
import { useMarketplaceDeckDetails } from '../hooks/useMarketplaceDeckDetails';
import { MarketplaceDetailHeader } from '../components/marketplace/MarketplaceDetailHeader';
import { MarketplaceAuthorBanner } from '../components/marketplace/MarketplaceAuthorBanner';
import { useStore } from '../store/useStore';
import { getLocaleFlagEmoji } from '../utils/locale-flag';
import { applyMarketplaceCloneToLocalLibrary } from '../services/marketplace/clone-to-library';

const FLASHCARD_FORMAT_LABEL_KEYS: Record<FlashcardFormat, string> = {
    QA: 'web.flashcards.format.qaLabel',
    Cloze: 'web.flashcards.format.clozeLabel',
    Definition: 'web.flashcards.format.definitionLabel',
};

const MARKETPLACE_LANGUAGE_LABEL_KEYS: Readonly<Record<string, string>> = {
    eng: 'languages.english',
    deu: 'languages.german',
    ukr: 'languages.ukrainian',
    spa: 'languages.spanish',
    fra: 'languages.french',
};

function isFlashcardFormat(value: string): value is FlashcardFormat {
    return FLASHCARD_FORMATS.some((format) => format === value);
}

function isRomanizationPreference(value: string): value is RomanizationPreference {
    return ROMANIZATION_PREFERENCES.some((preference) => preference === value);
}

export default function MarketplaceDetailScreen() {
    const { t } = useTranslation();
    const palette = usePalette();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NativeStackNavigationProp<HostedDeckStackParamList>>();
    const route = useRoute<RouteProp<HostedDeckStackParamList, 'MarketplaceDetail'>>();
    const currentUserId = useStore((state) => state.userId);
    const refreshDeckById = useStore((state) => state.refreshDeckById);

    const { deckId } = route.params;
    const [isCloning, setIsCloning] = useState(false);
    const [hasCloned, setHasCloned] = useState(false);

    const styles = useMemo(createStyles, []);
    const {
        deck,
        previewCards,
        similarDecks,
        isLoading,
        loadError,
        reload,
    } = useMarketplaceDeckDetails({
        deckId,
        serviceUnavailableMessage: t('marketplace.serviceUnavailable'),
        loadDetailsErrorMessage: t('marketplace.loadDetailsError'),
    });

    const getMaterialTypeLabel = useCallback((materialType?: string | null) => {
        if (!materialType) {
            return null;
        }
        if (!isFlashcardMaterialType(materialType)) {
            return materialType;
        }
        return t(`web.flashcards.material.${FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS[materialType]}`);
    }, [t]);

    const handleClone = useCallback(async () => {
        const isAlreadyAdded = Boolean(
            hasCloned
            || deck?.isAdded
            || (currentUserId && deck?.userId === currentUserId)
        );

        if (!deck || isAlreadyAdded) return;
        setIsCloning(true);
        const marketplaceService = getMarketplaceService();
        if (!marketplaceService) {
            setIsCloning(false);
            Alert.alert(t('common.error'), t('marketplace.serviceUnavailable'));
            return;
        }

        const result = await marketplaceService.cloneDeck(deckId);
        if (result.isOk()) {
            await applyMarketplaceCloneToLocalLibrary(result.value, refreshDeckById);
            setHasCloned(true);
            Alert.alert(t('marketplace.cloneSuccessTitle'), t('marketplace.cloneStaySuccessBody'));
        } else {
            Alert.alert(t('common.error'), result.error.message || t('marketplace.cloneErrorBody'));
        }
        setIsCloning(false);
    }, [currentUserId, deck, deckId, hasCloned, refreshDeckById, t]);

    useFocusEffect(
        useCallback(() => {
            setHasCloned(false);
            void reload();
        }, [reload])
    );

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: palette.background }]}>
                <ActivityIndicator size="large" color={palette.primary} />
            </View>
        );
    }

    if (!deck) {
        return (
            <View style={[styles.errorContainer, { backgroundColor: palette.background }]}>
                <Ionicons name="alert-circle-outline" size={64} color={palette.muted} />
                <Text style={[styles.errorTitle, { color: palette.text }]}>{t('marketplace.deckNotFound')}</Text>
                <Text style={[styles.errorBody, { color: palette.muted }]}>
                    {loadError || t('marketplace.loadDetailsError')}
                </Text>
                <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: palette.primary }]}
                    onPress={() => void reload()}
                >
                    <Text style={styles.retryButtonText}>{t('marketplace.retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const accent = getDeckAccent(deck.materialType);
    const materialTypeLabel = getMaterialTypeLabel(deck.materialType);
    const deckTypeLabel = deck.deckType && isFlashcardFormat(deck.deckType)
        ? t(FLASHCARD_FORMAT_LABEL_KEYS[deck.deckType])
        : deck.deckType;
    const localeLabel = deck.locale
        ? (() => {
            const localizedKey = MARKETPLACE_LANGUAGE_LABEL_KEYS[deck.locale];
            if (localizedKey) {
                return t(localizedKey);
            }

            const marketplaceLanguage = ELEVENLABS_V3_LANGUAGES.find((entry) => entry.code === deck.locale);
            if (marketplaceLanguage) {
                return marketplaceLanguage.name;
            }

            return deck.locale.toUpperCase();
        })()
        : null;
    const localeFlag = deck.locale ? getLocaleFlagEmoji(deck.locale) : null;
    const localeChipLabel = localeFlag && localeLabel
        ? `${localeFlag} ${localeLabel}`
        : (localeFlag ?? localeLabel);
    const authorName = deck.user?.displayName
        || deck.user?.name?.trim()
        || deck.user?.username?.trim()
        || t('marketplace.anonymousAuthor');
    const rawAuthorUsername = deck.user?.username?.trim() || null;
    const fallbackAuthorHandle = deck.userId?.slice(0, 8) || null;
    const authorUsername = rawAuthorUsername && rawAuthorUsername !== authorName
        ? rawAuthorUsername
        : (authorName === t('marketplace.anonymousAuthor') ? fallbackAuthorHandle : null);
    const authorAvatarUrl = deck.user?.image ?? null;
    const isAddedDeck = Boolean(
        hasCloned
        || deck.isAdded
        || (currentUserId && deck.userId === currentUserId)
    );
    const metadataTags = (() => {
        const tags: string[] = [];
        const metadata = deck.marketplaceMetadata;
        if (!metadata) {
            return tags;
        }

        if (metadata.level) {
            tags.push(metadata.level);
        }

        if (Array.isArray(metadata.skills)) {
            for (const skill of metadata.skills) {
                const normalizedSkill = skill.trim();
                if (normalizedSkill.length > 0) {
                    tags.push(normalizedSkill);
                }
            }
        }

        if (metadata.regionalVariant) {
            tags.push(metadata.regionalVariant);
        }

        if (metadata.script) {
            tags.push(metadata.script);
        }

        if (metadata.romanization && isRomanizationPreference(metadata.romanization)) {
            tags.push(t(`marketplace.romanization.${metadata.romanization}`));
        }

        const licenseLabel = metadata.license?.name || metadata.license?.code || null;
        if (licenseLabel) {
            tags.push(licenseLabel);
        }

        return Array.from(new Set(tags));
    })();
    const hasAudio = Array.isArray(deck.cards)
        ? deck.cards.some((card) => typeof card.audioUrl === 'string' && card.audioUrl.trim().length > 0)
        : false;
    const audioTagLabel = hasAudio ? t('marketplace.audioAvailable') : t('marketplace.audioUnavailable');

    return (
        <View style={[styles.container, { backgroundColor: palette.background }]}>
            <MarketplaceDetailHeader
                topInset={insets.top}
                onBack={() => navigation.goBack()}
                title={deck.name}
                borderColor={palette.border}
                backgroundColor={palette.background}
                textColor={palette.text}
            />

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
                <View style={[styles.hero, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <View style={[styles.heroAccentBar, { backgroundColor: palette.primary }]} />
                    <View style={styles.titleRow}>
                        <View style={[styles.heroIcon, { backgroundColor: accent.background }]}>
                            <Ionicons name={accent.icon} size={20} color={accent.color} />
                        </View>
                        <Text style={[styles.deckName, { color: palette.text }]} numberOfLines={1}>
                            {deck.name}
                        </Text>
                        {deck.isFeatured ? (
                            <View style={[styles.featuredBadge, { backgroundColor: palette.primary }]}>
                                <Ionicons name="star" size={14} color="#fff" />
                                <Text style={styles.featuredText}>{t('marketplace.featured')}</Text>
                            </View>
                        ) : null}
                    </View>
                    {deck.description ? (
                        <Text style={[styles.description, { color: palette.muted }]}>{deck.description}</Text>
                    ) : null}

                    <MarketplaceAuthorBanner
                        name={authorName}
                        username={authorUsername}
                        avatarUrl={authorAvatarUrl}
                        label={t('marketplace.createdBy')}
                        borderColor={palette.border}
                        cardColor={palette.secondary}
                        avatarColor={palette.primary}
                        textColor={palette.text}
                        mutedColor={palette.muted}
                    />

                    <View style={styles.tags}>
                        {materialTypeLabel ? (
                            <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
                                <Text style={[styles.tagText, { color: palette.text }]}>{materialTypeLabel}</Text>
                            </View>
                        ) : null}
                        {deckTypeLabel ? (
                            <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
                                <Text style={[styles.tagText, { color: palette.text }]}>{deckTypeLabel}</Text>
                            </View>
                        ) : null}
                        {localeChipLabel ? (
                            <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
                                <Text style={[styles.tagText, { color: palette.text }]}>{localeChipLabel}</Text>
                            </View>
                        ) : null}
                        <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
                            <Text style={[styles.tagText, { color: palette.text }]}>{audioTagLabel}</Text>
                        </View>
                        {metadataTags.map((tagLabel) => (
                            <View key={tagLabel} style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
                                <Text style={[styles.tagText, { color: palette.text }]}>{tagLabel}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.stats}>
                        <View style={[styles.stat, { backgroundColor: palette.secondary }]}>
                            <View style={styles.statHeader}>
                                <Ionicons name="layers-outline" size={14} color={palette.muted} />
                                <Text style={[styles.statLabel, { color: palette.muted }]}>{t('marketplace.cardsLabel')}</Text>
                            </View>
                            <Text style={[styles.statValue, { color: palette.text }]}>{deck.cardCount}</Text>
                        </View>
                        <View style={[styles.stat, { backgroundColor: palette.secondary }]}>
                            <View style={styles.statHeader}>
                                <Ionicons name="eye-outline" size={14} color={palette.muted} />
                                <Text style={[styles.statLabel, { color: palette.muted }]}>{t('marketplace.viewsLabel')}</Text>
                            </View>
                            <Text style={[styles.statValue, { color: palette.text }]}>{deck.viewCount}</Text>
                        </View>
                        <View style={[styles.stat, { backgroundColor: palette.secondary }]}>
                            <View style={styles.statHeader}>
                                <Ionicons name="download-outline" size={14} color={palette.muted} />
                                <Text style={[styles.statLabel, { color: palette.muted }]}>{t('marketplace.downloadsLabel')}</Text>
                            </View>
                            <Text style={[styles.statValue, { color: palette.text }]}>{deck.downloadCount}</Text>
                        </View>
                    </View>

                </View>

                {isAddedDeck ? (
                    <View style={[styles.successBanner, { backgroundColor: palette.secondary, borderColor: palette.border }]}>
                        <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                        <Text style={[styles.successText, { color: palette.text }]}>{t('marketplace.cloneStaySuccessBody')}</Text>
                    </View>
                ) : null}

                {previewCards.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: palette.text }]}>
                            {t('marketplace.cardPreview', { count: previewCards.length })}
                        </Text>
                        <View style={styles.previewCards}>
                            {previewCards.map((card) => (
                                <View key={card.id} style={[styles.previewCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                                    <Text style={[styles.previewFront, { color: palette.text }]} numberOfLines={3}>{card.front}</Text>
                                    <View style={[styles.previewDivider, { backgroundColor: palette.border }]} />
                                    <Text style={[styles.previewBack, { color: palette.muted }]} numberOfLines={3}>{card.back}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                {similarDecks.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('marketplace.similarDecks')}</Text>
                        <View style={styles.similarList}>
                            {similarDecks.map((similarDeck) => (
                                <TouchableOpacity
                                    key={similarDeck.id}
                                    style={[styles.similarCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                                    onPress={() => navigation.push('MarketplaceDetail', { deckId: similarDeck.id })}
                                >
                                    <Text style={[styles.similarName, { color: palette.text }]} numberOfLines={2}>
                                        {similarDeck.name}
                                    </Text>
                                    {similarDeck.description ? (
                                        <Text style={[styles.similarDescription, { color: palette.muted }]} numberOfLines={2}>
                                            {similarDeck.description}
                                        </Text>
                                    ) : null}
                                    <View style={styles.similarMeta}>
                                        <Text style={[styles.similarMetaText, { color: palette.muted }]}>
                                            {t('deckList.cardCount', { count: similarDeck.cardCount })}
                                        </Text>
                                        <Text style={[styles.similarMetaText, { color: palette.muted }]}>
                                            {t('marketplace.matchScore', { score: similarDeck.matchScore })}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : null}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom, borderTopColor: palette.border, backgroundColor: palette.background }]}>
                <TouchableOpacity
                    style={[
                        styles.cloneButton,
                        {
                            backgroundColor: isAddedDeck ? palette.secondary : palette.primary,
                            borderColor: isAddedDeck ? palette.border : palette.primary,
                            borderWidth: isAddedDeck ? 1 : 0,
                        },
                    ]}
                    onPress={handleClone}
                    disabled={isCloning || isAddedDeck}
                >
                    {isCloning ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name={isAddedDeck ? 'checkmark-circle-outline' : 'add-outline'} size={20} color={isAddedDeck ? palette.text : '#fff'} />
                            <Text style={[styles.cloneButtonText, { color: isAddedDeck ? palette.text : '#fff' }]}>
                                {isAddedDeck ? t('marketplace.alreadyCloned') : t('marketplace.addAction')}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

function createStyles() {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            gap: 10,
        },
        errorTitle: {
            fontSize: 20,
            fontWeight: '800',
        },
        errorBody: {
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
        },
        retryButton: {
            marginTop: 8,
            minHeight: 44,
            borderRadius: 12,
            paddingHorizontal: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        retryButtonText: {
            color: '#fff',
            fontWeight: '700',
            fontSize: 14,
        },
        content: {
            paddingHorizontal: 16,
            paddingTop: 8,
            gap: 16,
        },
        hero: {
            borderWidth: 1,
            borderRadius: 18,
            padding: 16,
            gap: 12,
            overflow: 'hidden',
        },
        heroAccentBar: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 3,
            opacity: 0.8,
        },
        titleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        heroIcon: {
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        featuredBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            gap: 5,
        },
        featuredText: {
            color: '#fff',
            fontSize: 11,
            fontWeight: '800',
        },
        deckName: {
            flex: 1,
            fontSize: 28,
            fontWeight: '800',
            lineHeight: 32,
            letterSpacing: -0.4,
        },
        description: {
            fontSize: 15,
            lineHeight: 22,
        },
        tags: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        tag: {
            borderWidth: 1,
            borderRadius: 999,
            minHeight: 40,
            paddingHorizontal: 16,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
        },
        tagText: {
            fontSize: 13,
            fontWeight: '700',
        },
        stats: {
            flexDirection: 'row',
            gap: 8,
        },
        stat: {
            flex: 1,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 10,
            gap: 7,
        },
        statHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        statValue: {
            fontSize: 22,
            fontWeight: '800',
        },
        statLabel: {
            fontSize: 11,
            fontWeight: '600',
        },
        successBanner: {
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        successText: {
            fontSize: 13,
            fontWeight: '600',
            flex: 1,
        },
        section: {
            gap: 10,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '800',
        },
        previewCards: {
            gap: 10,
        },
        previewCard: {
            borderWidth: 1,
            borderRadius: 14,
            padding: 14,
            gap: 8,
        },
        previewFront: {
            fontSize: 14,
            fontWeight: '700',
        },
        previewDivider: {
            height: 1,
        },
        previewBack: {
            fontSize: 13,
            lineHeight: 19,
        },
        similarList: {
            gap: 10,
        },
        similarCard: {
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            gap: 7,
        },
        similarName: {
            fontSize: 15,
            fontWeight: '700',
        },
        similarDescription: {
            fontSize: 12,
            lineHeight: 17,
        },
        similarMeta: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        similarMetaText: {
            fontSize: 11,
            fontWeight: '600',
        },
        footer: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderTopWidth: 1,
            paddingHorizontal: 16,
            paddingTop: 12,
        },
        cloneButton: {
            minHeight: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        cloneButtonText: {
            fontSize: 15,
            fontWeight: '800',
        },
    });
}
