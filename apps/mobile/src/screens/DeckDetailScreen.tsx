import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { listCards, swapDeckCardSides } from "../db/deckRepositorySafe";
import { exportDeck } from "../services/exportService";
import type { DeckStackParamList } from "../navigation/types";
import { useStore } from "../store/useStore";
import type { Card, DeckWithStats, DeckVisibility } from "../types/models";
import { usePalette } from "../theme";
import MarkdownText from "../components/MarkdownText";
import IconSelect from "../components/IconSelect";
import { DECK_ACCENTS, DEFAULT_DECK_ACCENT_KEY } from "../constants";
import { logger } from "../utils/logger";
import { DeckDetailMenu, FadeScrollRow } from "./deck-detail/DeckDetailChrome";
import { filterDeckCards, listDeckCategories, listDeckTags } from "./deck-detail/deck-detail-filters";

type Props = NativeStackScreenProps<DeckStackParamList, "DeckDetail">;

export default function DeckDetailScreen({ navigation, route }: Props) {
  const { deckId } = route.params;
  const { t } = useTranslation();
  const [deck, setDeck] = useState<DeckWithStats | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingAccentKey, setEditingAccentKey] = useState(DEFAULT_DECK_ACCENT_KEY);
  const [swapSides, setSwapSides] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [visibility, setVisibility] = useState<DeckVisibility>('private');
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const swapKey = useMemo(() => `flashly.swapSides.${deckId}`, [deckId]);

  const refreshDeckById = useStore((state) => state.refreshDeckById);
  const saveDeckDetails = useStore((state) => state.saveDeckDetails);
  const removeDeck = useStore((state) => state.removeDeck);
  const removeCardFromStore = useStore((state) => state.removeCard);
  const setDeckVisibility = useStore((state) => state.setDeckVisibility);

  const applyDeckSnapshot = useCallback((nextDeck: DeckWithStats) => {
    setDeck(nextDeck);
    setEditingName(nextDeck.name);
    setEditingDescription(nextDeck.description ?? "");
    setEditingAccentKey(nextDeck.accentKey ?? DEFAULT_DECK_ACCENT_KEY);
    setVisibility(nextDeck.visibility ?? "private");
  }, []);

  const syncDeckFromStore = useCallback(() => {
    const foundDeck = useStore.getState().decks.find((candidate) => candidate.id === deckId);
    if (!foundDeck) {
      return null;
    }
    applyDeckSnapshot(foundDeck);
    return foundDeck;
  }, [applyDeckSnapshot, deckId]);

  const loadCardsOnly = useCallback(async () => {
    const result = await listCards(deckId);
    if (result.isErr()) {
      logger.error('Failed to load cards:', result.error.message);
      setCards([]);
      return;
    }
    setCards(result.value);
  }, [deckId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let foundDeck = syncDeckFromStore();
      if (!foundDeck) {
        await refreshDeckById(deckId);
        foundDeck = syncDeckFromStore();
      }
      await loadCardsOnly();
    } finally {
      setLoading(false);
    }
  }, [deckId, loadCardsOnly, refreshDeckById, syncDeckFromStore]);

  useEffect(() => {
    loadData();
  }, [deckId, loadData]);


  useEffect(() => {
    let active = true;
    const loadSwapState = async () => {
      const stored = await AsyncStorage.getItem(swapKey);
      if (!active) return;
      setSwapSides(stored === "true");
    };
    loadSwapState();
    return () => {
      active = false;
    };
  }, [swapKey]);

  useFocusEffect(
    useCallback(() => {
      if (!deck) return;
      void (async () => {
        await refreshDeckById(deckId);
        syncDeckFromStore();
        await loadCardsOnly();
      })();
    }, [deck, deckId, loadCardsOnly, refreshDeckById, syncDeckFromStore]),
  );

  const categories = useMemo(
    () => listDeckCategories(cards),
    [cards],
  );

  const tags = useMemo(
    () => listDeckTags(cards),
    [cards],
  );

  const filteredCards = useMemo(
    () => filterDeckCards(cards, categoryFilter, tagFilters),
    [cards, categoryFilter, tagFilters],
  );

  const handleSaveDeck = async () => {
    if (!deck) return;
    await saveDeckDetails(deck.id, {
      name: editingName,
      description: editingDescription,
      accentKey: editingAccentKey,
    });
    syncDeckFromStore();
  };

  const handleAccentPick = async (accentKey: string) => {
    if (accentKey === editingAccentKey) return;
    setEditingAccentKey(accentKey);
    if (!deck) return;
    await saveDeckDetails(deck.id, { accentKey });
    syncDeckFromStore();
  };

  const accentOptions = useMemo(
    () =>
      DECK_ACCENTS.map((accent) => ({
        value: accent.key,
        label: t(accent.labelKey, { defaultValue: accent.key }),
        icon: accent.icon,
        iconColor: accent.color,
        iconBackground: accent.background,
      })),
    [t],
  );

  const handleDeleteDeck = () => {
    Alert.alert(t("deck.deleteDeck"), t("deck.confirmDelete"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await removeDeck(deckId);
          navigation.reset({ index: 0, routes: [{ name: "DeckList" }] });
        },
      },
    ]);
  };

  const handleDeleteCard = useCallback((cardId: string) => {
    Alert.alert(t("card.deleteConfirm"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await removeCardFromStore(cardId, deckId);
          } catch (error) {
            const message = error instanceof Error ? error.message : t("common.error");
            logger.error('Failed to delete card:', error);
            Alert.alert(t("common.error"), message);
            return;
          }
          await loadCardsOnly();
          syncDeckFromStore();
        },
      },
    ]);
  }, [deckId, loadCardsOnly, removeCardFromStore, syncDeckFromStore, t]);

  const handleExport = async () => {
    const getErrorMessage = (error: unknown): string => {
      if (error instanceof Error) {
        return error.message;
      }
      return String(error);
    };

    if (!deck) return;
    try {
      await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
      await exportDeck(
        { ...deck, cardCount: cards.length },
        cards,
        deck.materialType ?? undefined,
        deck.deckType ?? undefined,
        deck.locale ?? undefined
      );
    } catch (error) {
      if (getErrorMessage(error) === "SharingUnavailable") {
        Alert.alert(t("export.unavailable"));
      } else {
        Alert.alert(t("common.error"), getErrorMessage(error));
      }
    }
  };

  const handleSwapSides = (nextValue: boolean) => {
    if (swapLoading) return;
    Alert.alert(t("deck.swapSides"), t("deck.swapConfirm"), [
      {
        text: t("common.cancel"),
        style: "cancel",
        onPress: () => setSwapSides(!nextValue),
      },
      {
        text: t("common.confirm"),
        onPress: async () => {
          setSwapLoading(true);
          try {
            const result = await swapDeckCardSides(deckId);
            if (result.isErr()) {
              Alert.alert(t("common.error"), result.error.message);
              setSwapSides(!nextValue);
              return;
            }
            setSwapSides(nextValue);
            await AsyncStorage.setItem(swapKey, String(nextValue));
            await loadCardsOnly();
          } finally {
            setSwapLoading(false);
          }
        },
      },
    ]);
  };

  const handleVisibilityChange = useCallback((nextValue: DeckVisibility) => {
    const getErrorMessage = (error: unknown): string => {
      if (error instanceof Error) {
        return error.message;
      }
      return t("deck.visibilityUpdateFailed");
    };

    if (visibilityLoading) return;

    const isPublic = nextValue === 'public';
    Alert.alert(
      isPublic ? t("deck.visibilityConfirmPublicTitle") : t("deck.visibilityConfirmPrivateTitle"),
      isPublic
        ? t("deck.visibilityConfirmPublicBody")
        : t("deck.visibilityConfirmPrivateBody"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("common.confirm"),
          onPress: async () => {
            setVisibilityLoading(true);
            try {
              await setDeckVisibility(deckId, nextValue);
              syncDeckFromStore();

              Alert.alert(
                t("deck.visibilitySuccessTitle"),
                isPublic ? t("deck.visibilityUpdatedPublic") : t("deck.visibilityUpdatedPrivate"),
              );
            } catch (error) {
              Alert.alert(
                t("common.error"),
                getErrorMessage(error),
              );
            } finally {
              setVisibilityLoading(false);
            }
          },
        },
      ]
    );
  }, [deckId, setDeckVisibility, syncDeckFromStore, t, visibilityLoading]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <DeckDetailMenu
          color={colors.text}
          insets={insets}
          labels={{
            import: t("deck.import"),
            export: t("deck.export"),
            delete: t("deck.deleteDeck"),
          }}
          onImport={() => navigation.navigate("Import", { deckId })}
          onExport={handleExport}
          onDelete={handleDeleteDeck}
        />
      ),
    });
  }, [colors.text, deckId, handleDeleteDeck, handleExport, insets, navigation, t]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={styles.centered}>
        <Text>{t("deckList.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredCards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => navigation.navigate("CardEdit", { deckId, cardId: item.id })}
            onLongPress={() => handleDeleteCard(item.id)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardFrontWrap}>
                <MarkdownText
                  value={item.front}
                  color={colors.text}
                  mutedColor={colors.muted}
                  accentColor={colors.accent}
                  textAlign="left"
                  fontSize={17}
                />
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
            <View style={styles.cardBody}>
              {item.pos ? <Text style={[styles.cardPos, { color: colors.muted }]}>{item.pos}</Text> : null}
              <MarkdownText
                value={item.back}
                color={colors.muted}
                mutedColor={colors.muted}
                accentColor={colors.accent}
                textAlign="left"
                fontSize={13}
              />
              {item.example ? (
                <Text style={[styles.cardExample, { color: colors.muted }]}>"{item.example}"</Text>
              ) : null}
            </View>
            {(item.category || item.tags?.length) ? (
              <FadeScrollRow backgroundColor={colors.card} contentStyle={styles.cardMetaRow}>
                {item.category ? (
                  <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.badgeText, { color: colors.text }]}>{item.category}</Text>
                  </View>
                ) : null}
                {item.tags?.length
                  ? item.tags.map((tag) => (
                      <View key={tag} style={[styles.tagChip, { borderColor: colors.border }]}>
                        <Text style={[styles.tagText, { color: colors.muted }]}>#{tag}</Text>
                      </View>
                    ))
                  : null}
              </FadeScrollRow>
            ) : null}
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.section}>
              <TextInput
                value={editingName}
                onChangeText={setEditingName}
                onBlur={handleSaveDeck}
                placeholder={t("deck.deckName")}
                placeholderTextColor={colors.muted}
                style={[styles.titleInput, { color: colors.text }]}
              />
              <TextInput
                value={editingDescription}
                onChangeText={setEditingDescription}
                onBlur={handleSaveDeck}
                placeholder={t("deck.descriptionPlaceholder")}
                placeholderTextColor={colors.muted}
                style={[styles.description, { color: colors.text }]}
                multiline
              />
              <View style={styles.visibilityRow}>
                <View style={styles.visibilityInfo}>
                  <Ionicons
                    name={visibility === 'public' ? 'globe' : 'lock-closed'}
                    size={18}
                    color={colors.muted}
                  />
                  <Text style={[styles.visibilityLabel, { color: colors.text }]}>
                    {visibility === "public" ? t("deck.visibilityPublic") : t("deck.visibilityPrivate")}
                  </Text>
                </View>
                <Switch
                  value={visibility === 'public'}
                  onValueChange={(value) => handleVisibilityChange(value ? 'public' : 'private')}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={visibility === 'public' ? '#fff' : '#f8fafc'}
                  disabled={visibilityLoading}
                />
              </View>
              <View style={styles.actionRow}>
                <View style={styles.swapRow}>
                  <Text style={[styles.swapLabel, { color: colors.text }]}>{t("deck.swapSides")}</Text>
                  <Switch
                    value={swapSides}
                    onValueChange={(value) => {
                      setSwapSides(value);
                      handleSwapSides(value);
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={swapSides ? "#fff" : "#f8fafc"}
                    disabled={swapLoading}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate("CardEdit", { deckId })}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.primaryText}>{t("deck.addCard")}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.accentSection}>
                <IconSelect
                  label={t("deck.accentLabel", { defaultValue: "Deck type" })}
                  options={accentOptions}
                  value={editingAccentKey}
                  onChange={handleAccentPick}
                />
              </View>
            </View>

            <View style={styles.filtersSection}>
              <View style={styles.filtersHeader}>
                <Text style={[styles.filtersTitle, { color: colors.muted }]}>
                  {`${t("deck.cards")} (${cards.length})`}
                </Text>
                {(categoryFilter || tagFilters.length > 0) ? (
                  <TouchableOpacity
                    onPress={() => {
                      setCategoryFilter(null);
                      setTagFilters([]);
                    }}
                  >
                    <Text style={[styles.clearFiltersText, { color: colors.primary }]}>
                      {t("deck.clearFilters")}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t("card.category")}</Text>
                <FadeScrollRow backgroundColor={colors.background} contentStyle={styles.chipRow}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      !categoryFilter && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setCategoryFilter(null)}
                  >
                    <Text style={[styles.chipText, !categoryFilter ? styles.chipTextActive : { color: colors.text }]}>
                      {t("common.all")}
                    </Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.card },
                        categoryFilter === cat && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setCategoryFilter((prev) => (prev === cat ? null : cat))}
                    >
                      <Text
                        style={[styles.chipText, categoryFilter === cat ? styles.chipTextActive : { color: colors.text }]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </FadeScrollRow>
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t("card.tags")}</Text>
                {tags.length ? (
                  <FadeScrollRow backgroundColor={colors.background} contentStyle={styles.chipRow}>
                    {tags.map((tag) => {
                      const active = tagFilters.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.chip,
                            { borderColor: colors.border, backgroundColor: colors.card },
                            active && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() =>
                            setTagFilters((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))
                          }
                        >
                          <Text style={[styles.chipText, active ? styles.chipTextActive : { color: colors.text }]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </FadeScrollRow>
                ) : (
                  <Text style={[styles.emptyTags, { color: colors.muted }]}>{t("deck.noTags")}</Text>
                )}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{t("study.empty")}</Text>}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: 20 },
  titleInput: {
    fontSize: 28,
    fontWeight: "700",
    paddingVertical: 2,
    marginBottom: 6,
  },
  description: {
    borderRadius: 12,
    paddingVertical: 8,
    minHeight: 60,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginBottom: 12,
  },
  visibilityInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  visibilityLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  accentSection: { marginTop: 16, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  swapLabel: { fontSize: 14, fontWeight: "600" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  filtersSection: { gap: 12, marginBottom: 12 },
  filtersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filtersTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  clearFiltersText: { fontSize: 12, fontWeight: "700" },
  filterGroup: { gap: 8 },
  chipRow: { flexDirection: "row", gap: 8, paddingRight: 32 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  emptyTags: { fontSize: 12 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardBody: { gap: 4, marginTop: 6 },
  cardFrontWrap: { flex: 1 },
  cardPos: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  cardExample: { fontStyle: "italic", fontSize: 12 },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgeText: { fontWeight: "700", fontSize: 11 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingRight: 32 },
  tagChip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: { fontWeight: "600", fontSize: 11 },
  empty: { textAlign: "center", color: "#888", marginTop: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16 },
});
