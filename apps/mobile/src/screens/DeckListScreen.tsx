import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useStore } from "../store/useStore";
import { useSyncStore } from "../store/sync-store";
import type { DeckWithStats } from "../types/models";
import { formatRelative } from "../utils/format";
import type { DeckStackParamList } from "../navigation/types";
import { usePalette } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DECK_ACCENTS, DEFAULT_DECK_ACCENT_KEY } from "../constants";
import type { SyncLedgerChange } from "../services/sync/sync-types";
import { toRecord } from "../utils/records";

type Props = NativeStackScreenProps<DeckStackParamList, "DeckList">;

function getStringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function getDeckIdFromSyncChange(change: SyncLedgerChange): string | null {
  if (change.entityType === "deck") {
    return change.entityId;
  }

  if (change.entityType !== "card") {
    return null;
  }

  const data = toRecord(change.data);
  if (!data) {
    return null;
  }

  return getStringValue(data, "deckId");
}

export default function DeckListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const decks = useStore((state) => state.decks);
  const refreshDecks = useStore((state) => state.refreshDecks);
  const refreshDeckById = useStore((state) => state.refreshDeckById);
  const userId = useStore((state) => state.userId);
  const startSync = useSyncStore((state) => state.startSync);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const [sortBy, setSortBy] = useState<"studied" | "created">("studied");

  const runSyncAndRefreshIfNeeded = useCallback(async () => {
    if (!userId || isSyncing) {
      return;
    }
    await startSync(userId);
    const lastResult = useSyncStore.getState().lastSyncResult;
    if (!lastResult) {
      return;
    }

    const changes = lastResult.changes ?? [];
    if (!changes.length) {
      return;
    }

    const deletedDeckIds = new Set<string>();
    const deckIdsToRefresh = new Set<string>();
    for (const change of changes) {
      if (change.entityType === "deck" && change.operation === "delete") {
        deletedDeckIds.add(change.entityId);
        continue;
      }

      const deckId = getDeckIdFromSyncChange(change);
      if (deckId) {
        deckIdsToRefresh.add(deckId);
      }
    }

    if (deletedDeckIds.size > 0) {
      useStore.setState((state) => ({
        decks: state.decks.filter((deck) => !deletedDeckIds.has(deck.id)),
      }));
    }

    const ids = Array.from(deckIdsToRefresh).filter((deckId) => !deletedDeckIds.has(deckId));
    if (!ids.length) {
      return;
    }
    await Promise.all(ids.map((deckId) => refreshDeckById(deckId)));
  }, [isSyncing, refreshDeckById, startSync, userId]);

  useFocusEffect(
    useCallback(() => {
      void runSyncAndRefreshIfNeeded();

      const interval = setInterval(() => {
        void runSyncAndRefreshIfNeeded();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }, [runSyncAndRefreshIfNeeded]),
  );

  const sortedDecks = useMemo(() => {
    const sorted = [...decks];
    if (sortBy === "created") {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      return sorted;
    }
    sorted.sort((a, b) => {
      const aDate = a.lastStudiedAt ?? 0;
      const bDate = b.lastStudiedAt ?? 0;
      if (aDate === bDate) return b.createdAt - a.createdAt;
      return bDate - aDate;
    });
    return sorted;
  }, [decks, sortBy]);

  const renderItem = ({ item }: { item: DeckWithStats }) => {
    const accent = getDeckAccent(item.accentKey ?? DEFAULT_DECK_ACCENT_KEY, item.name);
    const lastStudied = item.lastStudiedAt
      ? formatRelative(item.lastStudiedAt)
      : t("deck.new");

    return (
      <TouchableOpacity
        style={[styles.deck, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigation.navigate("DeckOverview", { deckId: item.id })}
      >
        <View style={[styles.deckIcon, { backgroundColor: accent.background }]}>
          <Ionicons name={accent.icon} size={20} color={accent.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.deckTitle, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.deckMetaRow}>
            <Text style={[styles.deckMeta, { color: colors.muted }]}>
              {t("deckList.cardCount", { count: item.cardCount })}
            </Text>
            <View style={[styles.metaDot, { backgroundColor: colors.border }]} />
            <Text style={[styles.deckMeta, { color: colors.muted }]}>{lastStudied}</Text>
          </View>
        </View>
        {item.dueCount > 0 ? (
          <View style={styles.dueWrap}>
            <View style={[styles.dueBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.dueCount}>{item.dueCount}</Text>
            </View>
            <Text style={[styles.dueLabel, { color: colors.primary }]}>
              {t("deckList.dueShort")}
            </Text>
          </View>
        ) : (
          <View style={[styles.doneBadge, { backgroundColor: colors.secondary }]}>
            <Ionicons name="checkmark" size={16} color={colors.accent} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("deckList.title")}</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate("DeckCreate")}
            accessibilityLabel={t("deckList.addDeck")}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.content}>
        <View style={[styles.controls, { backgroundColor: colors.secondary }]}>
          <View style={styles.sortButtons}>
            <TouchableOpacity
              style={[
                styles.sortButton,
                {
                  backgroundColor: sortBy === "studied" ? colors.card : "transparent",
                },
              ]}
              onPress={() => setSortBy("studied")}
            >
              <Text style={[styles.sortButtonText, { color: sortBy === "studied" ? colors.text : colors.muted }]}>
                {t("deckList.sortByStudy")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortButton,
                {
                  backgroundColor: sortBy === "created" ? colors.card : "transparent",
                },
              ]}
              onPress={() => setSortBy("created")}
            >
              <Text style={[styles.sortButtonText, { color: sortBy === "created" ? colors.text : colors.muted }]}>
                {t("deckList.sortByCreated")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={sortedDecks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refreshDecks} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{t("deckList.empty")}</Text>}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

function getDeckAccent(accentKey: string, name: string) {
  const match = DECK_ACCENTS.find((accent) => accent.key === accentKey);
  if (match) return match;
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % DECK_ACCENTS.length;
  return DECK_ACCENTS[index];
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    flex: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  sortButtons: { flexDirection: "row", flex: 1, gap: 8 },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  sortButtonText: { fontWeight: "600", fontSize: 13 },
  deck: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deckIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deckTitle: { fontSize: 16, fontWeight: "700" },
  deckMetaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 },
  deckMeta: { fontSize: 12 },
  metaDot: { width: 4, height: 4, borderRadius: 2 },
  dueWrap: { alignItems: "center", gap: 4, minWidth: 44 },
  dueBadge: {
    minWidth: 30,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  dueCount: { color: "#fff", fontWeight: "700", fontSize: 12 },
  dueLabel: { fontSize: 10, fontWeight: "600" },
  doneBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { textAlign: "center", marginTop: 40 },
});
