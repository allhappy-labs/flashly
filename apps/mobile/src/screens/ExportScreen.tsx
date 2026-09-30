import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import type { DeckStackParamList } from "../navigation/types";
import { usePalette } from "../theme";
import type { DeckWithStats } from "../types/models";
import { listCards, listDecks } from "../db/deckRepositorySafe";
import { exportDeck } from "../services/exportService";

type Props = NativeStackScreenProps<DeckStackParamList, "Export">;

export default function ExportScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: t("export.title"), headerBackTitle: t("common.back") });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadDecks = async () => {
        setIsLoadingDecks(true);
        const result = await listDecks();
        if (cancelled) {
          return;
        }

        if (result.isErr()) {
          Alert.alert(t("common.error"), result.error.message);
          setIsLoadingDecks(false);
          return;
        }

        setDecks(result.value);
        setIsLoadingDecks(false);
      };

      void loadDecks();

      return () => {
        cancelled = true;
      };
    }, [t]),
  );

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  };

  const handleExport = async (deck: DeckWithStats) => {
    if (exportingId) return;
    setExportingId(deck.id);
    try {
      const result = await listCards(deck.id);
      if (result.isErr()) {
        Alert.alert(t("common.error"), result.error.message);
        return;
      }
      const cards = result.value;
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
    } finally {
      setExportingId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{t("export.subtitle")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isLoadingDecks ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={[styles.loadingText, { color: colors.muted }]}>{t("common.loading")}</Text>
            </View>
          ) : null}
          {decks.length ? (
            decks.map((deck, index) => (
              <View key={deck.id}>
                <TouchableOpacity style={styles.row} onPress={() => handleExport(deck)}>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{deck.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.muted }]}>
                      {t("export.cardCount", { count: deck.cardCount })}
                    </Text>
                  </View>
                  {exportingId === deck.id ? (
                    <ActivityIndicator />
                  ) : (
                    <Ionicons name="download-outline" size={20} color={colors.muted} />
                  )}
                </TouchableOpacity>
                {index < decks.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
              </View>
            ))
          ) : !isLoadingDecks ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>{t("deckList.empty")}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  subtitle: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, gap: 12 },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowMeta: { fontSize: 12, marginTop: 2 },
  divider: { height: 1 },
  loading: { padding: 16, alignItems: "center", gap: 8 },
  loadingText: { fontSize: 13 },
  empty: { padding: 16 },
  emptyText: { fontSize: 13 },
});
