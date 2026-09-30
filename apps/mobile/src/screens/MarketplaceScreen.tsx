/**
 * MarketplaceScreen - Browse community decks with discovery sections and filters
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
    FLASHCARD_MATERIAL_TYPE_ICON_KEYS,
    FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS,
    ROMANIZATION_PREFERENCES,
} from '@flashly/shared';
import { usePalette } from '../theme';
import type {
    MarketplaceDeck,
    MarketplaceTrendingDeck,
    MarketplaceQuery,
    MarketplaceSearchSuggestion,
} from '../services/marketplace/marketplace-types';
import { getMarketplaceService } from '../services/marketplace/marketplace-service';
import type { HostedDeckStackParamList } from '../navigation/types';
import { MATERIAL_ICON_KEY_TO_IONICON } from '../utils/material-icons';
import { getDeckAccent, isFlashcardMaterialType } from '../services/marketplace/marketplace-ui-utils';
import ScrollableChips from '../components/ScrollableChips';
import { useMarketplaceDiscovery } from '../hooks/useMarketplaceDiscovery';
import { useStore } from '../store/useStore';
import { getLocaleFlagEmoji } from '../utils/locale-flag';
import { applyMarketplaceCloneToLocalLibrary } from '../services/marketplace/clone-to-library';
import { ALL_FILTER, SORT_PRESETS, useMarketplaceFilters } from './marketplace/useMarketplaceFilters';

const MARKETPLACE_LANGUAGE_FILTERS: ReadonlyArray<Readonly<{ code: string; labelKey: string }>> = [
    { code: 'eng', labelKey: 'languages.english' },
    { code: 'deu', labelKey: 'languages.german' },
    { code: 'ukr', labelKey: 'languages.ukrainian' },
    { code: 'spa', labelKey: 'languages.spanish' },
    { code: 'fra', labelKey: 'languages.french' },
];

export default function MarketplaceScreen() {
    const { t } = useTranslation();
    const palette = usePalette();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NativeStackNavigationProp<HostedDeckStackParamList>>();
    const currentUserId = useStore((state) => state.userId);
    const refreshDeckById = useStore((state) => state.refreshDeckById);

    const {
        selectedMaterialType,
        setSelectedMaterialType,
        selectedDeckType,
        setSelectedDeckType,
        selectedLocale,
        setSelectedLocale,
        selectedLevel,
        setSelectedLevel,
        selectedSkill,
        setSelectedSkill,
        selectedRegionalVariant,
        setSelectedRegionalVariant,
        selectedHasAudio,
        setSelectedHasAudio,
        selectedScript,
        setSelectedScript,
        selectedRomanization,
        setSelectedRomanization,
        selectedLicenseCode,
        setSelectedLicenseCode,
        sortPreset,
        setSortPreset,
        searchQuery,
        setSearchQuery,
        debouncedSearchQuery,
        isHydrated,
        filtersModalVisible,
        setFiltersModalVisible,
        materialTabs,
        activeSort,
        deckTypeOptions,
        activeFilterCount,
    } = useMarketplaceFilters((key) => t(key));

    const [suggestions, setSuggestions] = useState<MarketplaceSearchSuggestion[]>([]);

    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [addingDeckId, setAddingDeckId] = useState<string | null>(null);
    const [addedDeckIds, setAddedDeckIds] = useState<Set<string>>(new Set());

    const suggestionsRequestId = useRef(0);
    const hasHydratedDiscoveryLoad = useRef(false);

    const styles = useMemo(createStyles, []);
    const buildQuery = useCallback((pageValue: number): MarketplaceQuery => {
        return {
            materialType: selectedMaterialType || undefined,
            deckType: selectedDeckType || undefined,
            locale: selectedLocale || undefined,
            level: selectedLevel || undefined,
            skill: selectedSkill || undefined,
            regionalVariant: selectedRegionalVariant || undefined,
            hasAudio: selectedHasAudio === null ? undefined : selectedHasAudio,
            script: selectedScript || undefined,
            romanization: selectedRomanization || undefined,
            licenseCode: selectedLicenseCode || undefined,
            search: debouncedSearchQuery || undefined,
            page: pageValue,
            limit: 20,
            sortBy: activeSort.sortBy,
            sortOrder: activeSort.sortOrder,
        };
    }, [
        activeSort.sortBy,
        activeSort.sortOrder,
        debouncedSearchQuery,
        selectedDeckType,
        selectedHasAudio,
        selectedLevel,
        selectedLicenseCode,
        selectedLocale,
        selectedMaterialType,
        selectedRegionalVariant,
        selectedRomanization,
        selectedScript,
        selectedSkill,
    ]);
    const discoveryOptions = useMemo(() => ({
        buildQuery,
        serviceUnavailableMessage: t('marketplace.serviceUnavailable'),
        loadErrorMessage: t('marketplace.loadError'),
    }), [buildQuery, t]);
    const {
        decks,
        featuredDecks,
        trendingDecks,
        isLoading,
        isRefreshing,
        isLoadingMore,
        hasMore,
        errorMessage,
        refresh: refreshDiscovery,
        loadMore: loadMoreDiscovery,
        runDiscovery,
    } = useMarketplaceDiscovery(discoveryOptions);

    const loadSuggestions = useCallback(async (query: string) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            suggestionsRequestId.current += 1;
            setSuggestions([]);
            setIsLoadingSuggestions(false);
            return;
        }

        const requestId = suggestionsRequestId.current + 1;
        suggestionsRequestId.current = requestId;
        const isLatestRequest = () => requestId === suggestionsRequestId.current;
        setIsLoadingSuggestions(true);

        try {
            const marketplaceService = getMarketplaceService();
            if (!marketplaceService) {
                if (!isLatestRequest()) return;
                setSuggestions([]);
                return;
            }

            const result = await marketplaceService.getSearchSuggestions(trimmed, 6);
            if (!isLatestRequest()) return;
            result.match(
                (items) => setSuggestions(items),
                () => setSuggestions([])
            );
        } finally {
            if (isLatestRequest()) {
                setIsLoadingSuggestions(false);
            }
        }
    }, []);

    const handleDeckPress = useCallback((deckId: string) => {
        navigation.navigate('MarketplaceDetail', { deckId });
    }, [navigation]);

    const handleAddDeck = useCallback(async (deck: MarketplaceDeck) => {
        if (addingDeckId === deck.id || addedDeckIds.has(deck.id)) {
            return;
        }

        if ((currentUserId && deck.userId === currentUserId) || deck.isAdded) {
            setAddedDeckIds((previous) => {
                const next = new Set(previous);
                next.add(deck.id);
                return next;
            });
            return;
        }

        const marketplaceService = getMarketplaceService();
        if (!marketplaceService) {
            Alert.alert(t('common.error'), t('marketplace.serviceUnavailable'));
            return;
        }

        setAddingDeckId(deck.id);
        const result = await marketplaceService.cloneDeck(deck.id);

        if (result.isOk()) {
            await applyMarketplaceCloneToLocalLibrary(result.value, refreshDeckById);
            setAddedDeckIds((previous) => {
                const next = new Set(previous);
                next.add(deck.id);
                return next;
            });
        } else {
            Alert.alert(t('common.error'), result.error.message || t('marketplace.cloneErrorBody'));
        }

        setAddingDeckId((current) => (current === deck.id ? null : current));
    }, [addedDeckIds, addingDeckId, currentUserId, refreshDeckById, t]);

    const handleLoadMore = useCallback(() => {
        if (isLoading || isLoadingMore || isRefreshing || !hasMore) return;
        void loadMoreDiscovery();
    }, [hasMore, isLoading, isLoadingMore, isRefreshing, loadMoreDiscovery]);

    const handleRefresh = useCallback(() => {
        void refreshDiscovery();
    }, [refreshDiscovery]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!isHydrated) return;
            void loadSuggestions(searchQuery);
        }, 220);
        return () => clearTimeout(timeout);
    }, [isHydrated, loadSuggestions, searchQuery]);

    useEffect(() => {
        if (!isHydrated) return;
        hasHydratedDiscoveryLoad.current = true;
        void runDiscovery(true);
    }, [
        debouncedSearchQuery,
        isHydrated,
        runDiscovery,
        selectedDeckType,
        selectedHasAudio,
        selectedLevel,
        selectedLicenseCode,
        selectedLocale,
        selectedMaterialType,
        selectedRegionalVariant,
        selectedRomanization,
        selectedScript,
        selectedSkill,
        sortPreset,
    ]);

    useFocusEffect(
        useCallback(() => {
            if (!isHydrated) return;
            if (!hasHydratedDiscoveryLoad.current) return;
            if (decks.length > 0) return;
            void refreshDiscovery();
        }, [decks.length, isHydrated, refreshDiscovery])
    );

    const allVisibleDecks = useMemo(() => {
        const byId = new Map<string, MarketplaceDeck>();
        for (const deck of featuredDecks) {
            byId.set(deck.id, deck);
        }
        for (const deck of decks) {
            byId.set(deck.id, deck);
        }
        return Array.from(byId.values());
    }, [decks, featuredDecks]);

    const levelOptions = useMemo(() => {
        return Array.from(
            new Set(
                allVisibleDecks
                    .map((deck) => deck.marketplaceMetadata?.level)
                    .filter((value): value is string => Boolean(value))
            )
        ).sort((left, right) => left.localeCompare(right));
    }, [allVisibleDecks]);

    const skillOptions = useMemo(() => {
        const skills = new Set<string>();
        for (const deck of allVisibleDecks) {
            const deckSkills = deck.marketplaceMetadata?.skills;
            if (!Array.isArray(deckSkills)) {
                continue;
            }
            for (const skillValue of deckSkills) {
                const normalized = skillValue.trim();
                if (normalized.length > 0) {
                    skills.add(normalized);
                }
            }
        }
        return Array.from(skills).sort((left, right) => left.localeCompare(right));
    }, [allVisibleDecks]);

    const regionalVariantOptions = useMemo(() => {
        return Array.from(
            new Set(
                allVisibleDecks
                    .map((deck) => deck.marketplaceMetadata?.regionalVariant)
                    .filter((value): value is string => Boolean(value))
            )
        ).sort((left, right) => left.localeCompare(right));
    }, [allVisibleDecks]);

    const scriptOptions = useMemo(() => {
        return Array.from(
            new Set(
                allVisibleDecks
                    .map((deck) => deck.marketplaceMetadata?.script)
                    .filter((value): value is string => Boolean(value))
            )
        ).sort((left, right) => left.localeCompare(right));
    }, [allVisibleDecks]);

    const licenseOptions = useMemo(() => {
        const byCode = new Map<string, string>();
        for (const deck of allVisibleDecks) {
            const license = deck.marketplaceMetadata?.license;
            if (!license?.code) {
                continue;
            }
            byCode.set(license.code, license.name || license.code);
        }
        return Array.from(byCode.entries())
            .sort((left, right) => left[1].localeCompare(right[1]));
    }, [allVisibleDecks]);

    const getMaterialTypeLabel = useCallback((materialType?: string | null) => {
        if (!materialType) {
            return null;
        }
        if (!isFlashcardMaterialType(materialType)) {
            return materialType;
        }
        return t(`web.flashcards.material.${FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS[materialType]}`);
    }, [t]);

    const renderMaterialTypeTab = (type: string) => {
        const isAllFilter = type === ALL_FILTER;
        const isSelected = isAllFilter ? selectedMaterialType === null : selectedMaterialType === type;
        const materialType = isFlashcardMaterialType(type) ? type : null;
        const label = isAllFilter || !materialType
            ? t('common.all')
            : t(`web.flashcards.material.${FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS[materialType]}`);
        const iconName = isAllFilter || !materialType
            ? 'apps-outline'
            : MATERIAL_ICON_KEY_TO_IONICON[FLASHCARD_MATERIAL_TYPE_ICON_KEYS[materialType]];

        return (
            <TouchableOpacity
                key={type}
                style={[
                    styles.materialTab,
                    {
                        backgroundColor: isSelected ? palette.primary : palette.card,
                        borderColor: palette.border,
                    },
                ]}
                onPress={() => setSelectedMaterialType(isAllFilter ? null : type)}
            >
                <Ionicons name={iconName} size={14} color={isSelected ? '#fff' : palette.muted} />
                <Text style={[styles.materialTabLabel, { color: isSelected ? '#fff' : palette.muted }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderDeckCard = useCallback((deck: MarketplaceDeck, compact: boolean) => {
        const materialTypeLabel = getMaterialTypeLabel(deck.materialType);
        const accent = getDeckAccent(deck.materialType);
        const localeFlag = deck.locale ? getLocaleFlagEmoji(deck.locale) : null;
        const isAddingDeck = addingDeckId === deck.id;
        const isOwnedDeck = Boolean(currentUserId && deck.userId === currentUserId);
        const isAddedDeck = isOwnedDeck || Boolean(deck.isAdded) || addedDeckIds.has(deck.id);
        const rawAuthorDisplayName = deck.user?.displayName
            || deck.user?.name?.trim()
            || deck.user?.username?.trim()
            || null;
        const authorDisplayName = rawAuthorDisplayName && rawAuthorDisplayName.length > 1 ? rawAuthorDisplayName : null;
        const addButtonLabel = isAddedDeck ? t('marketplace.alreadyCloned') : t('marketplace.addAction');

        return (
            <TouchableOpacity
                key={`${deck.id}-${compact ? 'compact' : 'full'}`}
                style={[
                    compact ? styles.compactDeckCard : styles.deckCard,
                    {
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                    },
                ]}
                onPress={() => handleDeckPress(deck.id)}
            >
                <View style={styles.deckCardTopRow}>
                    <View style={[styles.deckIconWrap, { backgroundColor: accent.background }]}>
                        <Ionicons name={accent.icon} size={16} color={accent.color} />
                    </View>
                    <View style={styles.deckCardBadges}>
                        {deck.isFeatured ? (
                            <View style={[styles.badge, { backgroundColor: palette.primary }]}>
                                <Ionicons name="star" size={11} color="#fff" />
                                <Text style={styles.badgeText}>{t('marketplace.featured')}</Text>
                            </View>
                        ) : null}
                        {localeFlag ? (
                            <View style={[styles.badgeOutline, { borderColor: palette.border }]}>
                                <Text style={[styles.badgeOutlineText, { color: palette.muted }]}>{localeFlag}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <Text style={[styles.deckName, { color: palette.text }]} numberOfLines={2}>
                    {deck.name}
                </Text>
                {deck.description ? (
                    <Text style={[styles.deckDescription, { color: palette.muted }]} numberOfLines={compact ? 2 : 3}>
                        {deck.description}
                    </Text>
                ) : null}

                {compact ? (
                    <View style={styles.compactInfoRow}>
                        {materialTypeLabel ? (
                            <View style={[styles.chip, styles.compactInfoChip, { backgroundColor: palette.secondary, borderColor: palette.border }]}>
                                <Text style={[styles.chipText, { color: palette.muted }]}>
                                    {materialTypeLabel}
                                </Text>
                            </View>
                        ) : null}
                        {authorDisplayName ? (
                            <View style={[styles.compactInfoChip, { backgroundColor: palette.secondary, borderColor: palette.border }]}>
                                <Ionicons name="person-outline" size={11} color={palette.muted} />
                                <Text style={[styles.compactInfoChipText, { color: palette.muted }]} numberOfLines={1}>
                                    {authorDisplayName}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <View style={[styles.deckMetaRow, compact && styles.deckMetaRowCompact]}>
                    <View
                        style={[
                            styles.metaItem,
                            compact && styles.compactMetaItem,
                            compact && { backgroundColor: palette.secondary, borderColor: palette.border },
                        ]}
                    >
                        <Ionicons name="layers-outline" size={14} color={palette.muted} />
                        <Text style={[styles.metaText, compact && styles.metaTextCompact, { color: palette.muted }]}>
                            {t('deckList.cardCount', { count: deck.cardCount })}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.metaItem,
                            compact && styles.compactMetaItem,
                            compact && { backgroundColor: palette.secondary, borderColor: palette.border },
                        ]}
                    >
                        <Ionicons name="download-outline" size={14} color={palette.muted} />
                        <Text style={[styles.metaText, compact && styles.metaTextCompact, { color: palette.muted }]}>{deck.downloadCount}</Text>
                    </View>
                    <View
                        style={[
                            styles.metaItem,
                            compact && styles.compactMetaItem,
                            compact && { backgroundColor: palette.secondary, borderColor: palette.border },
                        ]}
                    >
                        <Ionicons name="eye-outline" size={14} color={palette.muted} />
                        <Text style={[styles.metaText, compact && styles.metaTextCompact, { color: palette.muted }]}>{deck.viewCount}</Text>
                    </View>
                </View>

                <View style={[styles.deckFooterRow, compact && styles.deckFooterRowCompact]}>
                    {!compact ? (
                        <View style={styles.deckFooterMeta}>
                            {materialTypeLabel ? (
                                <View style={[styles.chip, { backgroundColor: palette.secondary }]}>
                                    <Text style={[styles.chipText, { color: palette.muted }]}>
                                        {materialTypeLabel}
                                    </Text>
                                </View>
                            ) : null}
                            {authorDisplayName ? (
                                <Text style={[styles.authorLabel, { color: palette.muted }]} numberOfLines={1}>
                                    {authorDisplayName}
                                </Text>
                            ) : null}
                        </View>
                    ) : null}
                    <Pressable
                        style={[
                            styles.addDeckButton,
                            compact && styles.addDeckButtonCompact,
                            {
                                backgroundColor: isAddedDeck ? palette.secondary : palette.primary,
                                borderColor: isAddedDeck ? palette.border : palette.primary,
                            },
                        ]}
                        disabled={isAddingDeck || isAddedDeck}
                        onPress={(event) => {
                            event.stopPropagation();
                            void handleAddDeck(deck);
                        }}
                    >
                        {isAddingDeck ? (
                            <ActivityIndicator size="small" color={isAddedDeck ? palette.text : '#fff'} />
                        ) : (
                            <Ionicons
                                name={isAddedDeck ? 'checkmark-circle-outline' : 'add-outline'}
                                size={16}
                                color={isAddedDeck ? palette.text : '#fff'}
                            />
                        )}
                        <Text
                            style={[
                                styles.addDeckButtonText,
                                compact && styles.addDeckButtonTextCompact,
                                { color: isAddedDeck ? palette.text : '#fff' },
                            ]}
                        >
                            {addButtonLabel}
                        </Text>
                    </Pressable>
                </View>
            </TouchableOpacity>
        );
    }, [addedDeckIds, addingDeckId, currentUserId, getMaterialTypeLabel, handleAddDeck, handleDeckPress, palette.border, palette.card, palette.muted, palette.primary, palette.secondary, palette.text, t]);

    const renderTrendingCard = useCallback((deck: MarketplaceTrendingDeck) => {
        return (
            <TouchableOpacity
                key={deck.id}
                style={[styles.trendingCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                onPress={() => handleDeckPress(deck.id)}
            >
                <View style={styles.trendingHeader}>
                    <Text style={[styles.trendingTitle, { color: palette.text }]} numberOfLines={2}>
                        {deck.name}
                    </Text>
                    <Ionicons name="trending-up-outline" size={16} color={palette.primary} />
                </View>
                {deck.description ? (
                    <Text style={[styles.trendingDescription, { color: palette.muted }]} numberOfLines={2}>
                        {deck.description}
                    </Text>
                ) : null}
                <View style={styles.trendingStats}>
                    <Text style={[styles.trendingStatText, { color: palette.muted }]}>
                        {t('deckList.cardCount', { count: deck.cardCount })}
                    </Text>
                    <Text style={[styles.trendingStatText, { color: palette.muted }]}>
                        {t('marketplace.downloadsValue', { count: deck.downloadCount })}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }, [handleDeckPress, palette.border, palette.card, palette.muted, palette.primary, palette.text, t]);

    const renderHeader = () => {
        const hasDiscoverySections = featuredDecks.length > 0 || trendingDecks.length > 0;

        return (
            <View style={hasDiscoverySections ? styles.listHeader : styles.listHeaderCompact}>
                {hasDiscoverySections ? (
                    <View style={styles.discoverySections}>
                        {featuredDecks.length > 0 ? (
                            <View style={styles.sectionBlock}>
                                <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('marketplace.featuredSection')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalSectionContent}>
                                    {featuredDecks.map((deck) => renderDeckCard(deck, true))}
                                </ScrollView>
                            </View>
                        ) : null}
                        {trendingDecks.length > 0 ? (
                            <View style={styles.sectionBlock}>
                                <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('marketplace.trendingSection')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalSectionContent}>
                                    {trendingDecks.map((deck) => renderTrendingCard(deck))}
                                </ScrollView>
                            </View>
                        ) : null}
                    </View>
                ) : null}
                <View style={styles.sectionHeadingRow}>
                    <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('marketplace.allDecksSection')}</Text>
                    {activeFilterCount > 0 ? (
                        <TouchableOpacity onPress={() => {
                            setSelectedMaterialType(null);
                            setSelectedDeckType(null);
                            setSelectedLocale(null);
                            setSelectedLevel(null);
                            setSelectedSkill(null);
                            setSelectedRegionalVariant(null);
                            setSelectedHasAudio(null);
                            setSelectedScript(null);
                            setSelectedRomanization(null);
                            setSelectedLicenseCode(null);
                        }}>
                            <Text style={[styles.clearText, { color: palette.primary }]}>{t('marketplace.clearFilters')}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: palette.background }]}>
            <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: palette.border }]}>
                <View style={styles.titleRow}>
                    <View style={styles.titleCopy}>
                        <Text style={[styles.title, { color: palette.text }]}>{t('marketplace.title')}</Text>
                        <Text style={[styles.subtitle, { color: palette.muted }]}>{t('marketplace.subtitle')}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.filterButton, { backgroundColor: palette.card, borderColor: palette.border }]}
                        onPress={() => setFiltersModalVisible(true)}
                    >
                        <Ionicons name="options-outline" size={18} color={palette.text} />
                        <Text style={[styles.filterButtonText, { color: palette.text }]}>
                            {activeFilterCount > 0
                                ? t('marketplace.filtersWithCount', { count: activeFilterCount })
                                : t('marketplace.filters')}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.searchBar, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Ionicons name="search" size={20} color={palette.muted} />
                    <TextInput
                        style={[styles.searchInput, { color: palette.text }]}
                        placeholder={t('marketplace.searchPlaceholder')}
                        placeholderTextColor={palette.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {isLoadingSuggestions ? <ActivityIndicator size="small" color={palette.primary} /> : null}
                </View>

                {suggestions.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsContent}>
                        {suggestions.map((suggestion) => (
                            <TouchableOpacity
                                key={`${suggestion.type}-${suggestion.id}`}
                                style={[styles.suggestionChip, { backgroundColor: palette.secondary, borderColor: palette.border }]}
                                onPress={() => {
                                    setSearchQuery(suggestion.name);
                                    setSuggestions([]);
                                }}
                            >
                                <Ionicons name={suggestion.type === 'category' ? 'pricetag-outline' : 'search-outline'} size={12} color={palette.muted} />
                                <Text style={[styles.suggestionText, { color: palette.text }]}>{suggestion.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : null}

            </View>

            <FlatList
                data={decks}
                renderItem={({ item }) => renderDeckCard(item, false)}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.35}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={palette.primary}
                    />
                }
                ListEmptyComponent={
                    isLoading ? (
                        <View style={styles.loadingState}>
                            <ActivityIndicator size="small" color={palette.primary} />
                            <Text style={[styles.loadingText, { color: palette.muted }]}>{t('common.loading')}</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name={errorMessage ? 'warning-outline' : 'cube-outline'} size={58} color={palette.muted} />
                            <Text style={[styles.emptyTitle, { color: palette.text }]}>
                                {errorMessage ? t('marketplace.loadErrorTitle') : t('marketplace.emptyTitle')}
                            </Text>
                            <Text style={[styles.emptyDescription, { color: palette.muted }]}>
                                {errorMessage ? errorMessage : t('marketplace.emptyDescription')}
                            </Text>
                            <TouchableOpacity
                                style={[styles.retryButton, { backgroundColor: palette.primary }]}
                                onPress={() => void refreshDiscovery()}
                            >
                                <Text style={styles.retryButtonText}>{t('marketplace.retry')}</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
                ListFooterComponent={
                    isLoadingMore ? (
                        <View style={styles.footerLoader}>
                            <ActivityIndicator size="small" color={palette.primary} />
                        </View>
                    ) : null
                }
            />

            <Modal visible={filtersModalVisible} transparent animationType="slide" onRequestClose={() => setFiltersModalVisible(false)}>
                <View style={styles.modalRoot}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setFiltersModalVisible(false)} />
                    <View style={[styles.modalSheet, { backgroundColor: palette.background, borderColor: palette.border }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: palette.text }]}>{t('marketplace.filtersTitle')}</Text>
                            <TouchableOpacity onPress={() => setFiltersModalVisible(false)}>
                                <Ionicons name="close-outline" size={24} color={palette.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollBody}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.sortFilter')}</Text>
                            <ScrollableChips
                                items={SORT_PRESETS}
                                keyExtractor={(item) => item.id}
                                renderItem={(preset) => {
                                    const selected = preset.id === sortPreset;
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.sortChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSortPreset(preset.id)}
                                        >
                                            <Ionicons name={preset.icon} size={14} color={selected ? '#fff' : palette.muted} />
                                            <Text style={[styles.sortChipLabel, { color: selected ? '#fff' : palette.muted }]}>
                                                {t(preset.labelKey)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                                backgroundColor={palette.background}
                                containerStyle={styles.modalScrollableStrip}
                                contentContainerStyle={styles.modalScrollableContent}
                            />

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.materialFilter')}</Text>
                            <ScrollableChips
                                items={materialTabs}
                                keyExtractor={(item) => item}
                                renderItem={(item) => renderMaterialTypeTab(item)}
                                backgroundColor={palette.background}
                                containerStyle={styles.modalScrollableStrip}
                                contentContainerStyle={styles.modalScrollableContent}
                            />

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.deckTypeFilter')}</Text>
                            <View style={styles.modalChips}>
                                {deckTypeOptions.map((option) => {
                                    const selected = selectedDeckType === option.value;
                                    return (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedDeckType(selected ? null : option.value)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.languageFilter')}</Text>
                            <View style={styles.modalChips}>
                                {MARKETPLACE_LANGUAGE_FILTERS.map((language) => {
                                    const selected = selectedLocale === language.code;
                                    return (
                                        <TouchableOpacity
                                            key={language.code}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedLocale(selected ? null : language.code)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {t(language.labelKey)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.levelFilter')}</Text>
                            <View style={styles.modalChips}>
                                {levelOptions.map((option) => {
                                    const selected = selectedLevel === option;
                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedLevel(selected ? null : option)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {option}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.skillFilter')}</Text>
                            <View style={styles.modalChips}>
                                {skillOptions.map((option) => {
                                    const selected = selectedSkill === option;
                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedSkill(selected ? null : option)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {option}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.regionalVariantFilter')}</Text>
                            <View style={styles.modalChips}>
                                {regionalVariantOptions.map((option) => {
                                    const selected = selectedRegionalVariant === option;
                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedRegionalVariant(selected ? null : option)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {option}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.audioFilter')}</Text>
                            <View style={styles.modalChips}>
                                {[true, false].map((option) => {
                                    const selected = selectedHasAudio === option;
                                    const label = option ? t('marketplace.audioAvailable') : t('marketplace.audioUnavailable');
                                    return (
                                        <TouchableOpacity
                                            key={String(option)}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedHasAudio(selected ? null : option)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.scriptFilter')}</Text>
                            <View style={styles.modalChips}>
                                {scriptOptions.map((option) => {
                                    const selected = selectedScript === option;
                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedScript(selected ? null : option)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {option}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.romanizationFilter')}</Text>
                            <View style={styles.modalChips}>
                                {ROMANIZATION_PREFERENCES.map((option) => {
                                    const selected = selectedRomanization === option;
                                    return (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedRomanization(selected ? null : option)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {t(`marketplace.romanization.${option}`)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('marketplace.licenseFilter')}</Text>
                            <View style={styles.modalChips}>
                                {licenseOptions.map(([code, name]) => {
                                    const selected = selectedLicenseCode === code;
                                    return (
                                        <TouchableOpacity
                                            key={code}
                                            style={[
                                                styles.modalChip,
                                                {
                                                    backgroundColor: selected ? palette.primary : palette.card,
                                                    borderColor: palette.border,
                                                },
                                            ]}
                                            onPress={() => setSelectedLicenseCode(selected ? null : code)}
                                        >
                                            <Text style={[styles.modalChipText, { color: selected ? '#fff' : palette.text }]}>
                                                {name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.secondaryAction, { borderColor: palette.border, backgroundColor: palette.card }]}
                                    onPress={() => {
                                        setSelectedMaterialType(null);
                                        setSelectedDeckType(null);
                                        setSelectedLocale(null);
                                        setSelectedLevel(null);
                                        setSelectedSkill(null);
                                        setSelectedRegionalVariant(null);
                                        setSelectedHasAudio(null);
                                        setSelectedScript(null);
                                        setSelectedRomanization(null);
                                        setSelectedLicenseCode(null);
                                        setSortPreset('newest');
                                        setFiltersModalVisible(false);
                                    }}
                                >
                                    <Text style={[styles.secondaryActionText, { color: palette.text }]}>{t('marketplace.clearFilters')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.primaryAction, { backgroundColor: palette.primary }]}
                                    onPress={() => setFiltersModalVisible(false)}
                                >
                                    <Text style={styles.primaryActionText}>{t('marketplace.applyFilters')}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function createStyles() {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            paddingHorizontal: 16,
            paddingBottom: 14,
            borderBottomWidth: 1,
        },
        titleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
        },
        titleCopy: {
            flex: 1,
            gap: 3,
        },
        title: {
            fontSize: 30,
            fontWeight: '800',
            letterSpacing: -0.5,
        },
        subtitle: {
            fontSize: 13,
            fontWeight: '500',
        },
        filterButton: {
            minHeight: 38,
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        filterButtonText: {
            fontSize: 13,
            fontWeight: '700',
        },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderRadius: 14,
            minHeight: 46,
            paddingHorizontal: 12,
            gap: 8,
        },
        searchInput: {
            flex: 1,
            fontSize: 15,
        },
        suggestionsContent: {
            gap: 8,
            paddingTop: 10,
            paddingBottom: 4,
            paddingRight: 6,
        },
        suggestionChip: {
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        suggestionText: {
            fontSize: 12,
            fontWeight: '600',
        },
        sortChip: {
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        sortChipLabel: {
            fontSize: 12,
            fontWeight: '700',
        },
        materialTab: {
            borderWidth: 1,
            borderRadius: 999,
            minHeight: 34,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        materialTabLabel: {
            fontSize: 12,
            fontWeight: '700',
        },
        list: {
            paddingHorizontal: 16,
            paddingTop: 14,
            gap: 12,
            flexGrow: 1,
        },
        listHeader: {
            gap: 18,
            marginBottom: 12,
        },
        listHeaderCompact: {
            marginBottom: 12,
        },
        discoverySections: {
            gap: 16,
        },
        sectionBlock: {
            gap: 10,
        },
        sectionTitle: {
            fontSize: 19,
            fontWeight: '800',
            letterSpacing: -0.2,
        },
        sectionHeadingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        clearText: {
            fontSize: 13,
            fontWeight: '700',
        },
        horizontalSectionContent: {
            gap: 10,
            paddingRight: 6,
        },
        deckCard: {
            borderRadius: 16,
            borderWidth: 1,
            padding: 14,
            gap: 10,
        },
        compactDeckCard: {
            width: 272,
            minHeight: 190,
            borderRadius: 18,
            borderWidth: 1,
            padding: 16,
            gap: 10,
        },
        deckCardTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
        },
        deckIconWrap: {
            width: 30,
            height: 30,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        deckCardBadges: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        badge: {
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        badgeText: {
            color: '#fff',
            fontSize: 10,
            fontWeight: '800',
        },
        badgeOutline: {
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 4,
        },
        badgeOutlineText: {
            fontSize: 10,
            fontWeight: '700',
        },
        deckName: {
            fontSize: 17,
            fontWeight: '800',
            lineHeight: 21,
        },
        deckDescription: {
            fontSize: 13,
            lineHeight: 19,
        },
        compactInfoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            minHeight: 24,
        },
        compactInfoChip: {
            maxWidth: '72%',
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 8,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        compactInfoChipText: {
            fontSize: 11,
            fontWeight: '600',
        },
        deckMetaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
        },
        deckMetaRowCompact: {
            gap: 8,
        },
        metaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        compactMetaItem: {
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 4,
        },
        metaText: {
            fontSize: 12,
            fontWeight: '600',
        },
        metaTextCompact: {
            fontSize: 11,
        },
        deckFooterRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
        },
        deckFooterRowCompact: {
            marginTop: 'auto',
            justifyContent: 'flex-end',
        },
        deckFooterMeta: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
        },
        chip: {
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 4,
            maxWidth: '70%',
        },
        chipText: {
            fontSize: 11,
            fontWeight: '700',
        },
        authorLabel: {
            fontSize: 11,
            fontWeight: '600',
            flex: 1,
            textAlign: 'right',
        },
        addDeckButton: {
            minHeight: 30,
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 5,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
        },
        addDeckButtonCompact: {
            minHeight: 34,
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 5,
        },
        addDeckButtonText: {
            fontSize: 11,
            fontWeight: '700',
        },
        addDeckButtonTextCompact: {
            fontSize: 12,
        },
        trendingCard: {
            width: 230,
            borderRadius: 16,
            borderWidth: 1,
            padding: 14,
            gap: 8,
        },
        trendingHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
        },
        trendingTitle: {
            flex: 1,
            fontSize: 15,
            fontWeight: '700',
        },
        trendingDescription: {
            fontSize: 12,
            lineHeight: 17,
        },
        trendingStats: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        trendingStatText: {
            fontSize: 11,
            fontWeight: '600',
        },
        loadingState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            gap: 12,
        },
        loadingText: {
            fontSize: 13,
            fontWeight: '600',
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            paddingHorizontal: 18,
            gap: 10,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '800',
            textAlign: 'center',
        },
        emptyDescription: {
            fontSize: 13,
            lineHeight: 19,
            textAlign: 'center',
        },
        retryButton: {
            marginTop: 4,
            borderRadius: 12,
            minHeight: 42,
            paddingHorizontal: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        retryButtonText: {
            color: '#fff',
            fontSize: 14,
            fontWeight: '800',
        },
        footerLoader: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
        },
        modalRoot: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        modalBackdrop: {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
        },
        modalSheet: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderBottomWidth: 0,
            maxHeight: '88%',
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 24,
            gap: 12,
        },
        modalScroll: {
            flex: 1,
        },
        modalScrollBody: {
            gap: 12,
            paddingBottom: 8,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 2,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: '800',
        },
        modalLabel: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.3,
            textTransform: 'uppercase',
        },
        modalScrollableStrip: {
            minHeight: 42,
        },
        modalScrollableContent: {
            gap: 8,
            paddingRight: 8,
        },
        modalChips: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        modalChip: {
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        modalChipText: {
            fontSize: 12,
            fontWeight: '700',
        },
        modalActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
        },
        secondaryAction: {
            flex: 1,
            minHeight: 46,
            borderRadius: 12,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        secondaryActionText: {
            fontSize: 14,
            fontWeight: '700',
        },
        primaryAction: {
            flex: 1,
            minHeight: 46,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        primaryActionText: {
            color: '#fff',
            fontSize: 14,
            fontWeight: '800',
        },
    });
}
