import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { clearLocalDatabase } from "../db/database";
import { signOutSession, authClient, setSessionToken } from "../services/auth/auth-client";
import { clearAuthStorage } from "../services/auth/auth-storage";
import { clearAllDeckMedia } from "../services/deckMedia";
import type { HostedDeckStackParamList } from "../navigation/types";
import { useSyncStore } from "../store/sync-store";
import { useStore } from "../store/useStore";
import { usePalette } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logger } from "../utils/logger";

type Props = NativeStackScreenProps<HostedDeckStackParamList, "AccountHome">;

export default function AccountScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const sessionQuery = authClient.useSession();
  const sessionData = sessionQuery.data ?? null;
  const setUserId = useStore((state) => state.setUserId);
  const clearDecks = useStore((state) => state.clearDecks);
  const stopSync = useSyncStore((state) => state.stopSync);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userName = sessionData?.user?.name ?? "";
  const userEmail = sessionData?.user?.email ?? t("dashboard.notAvailable");

  const avatarLabel = useMemo(() => {
    const source = userName.trim() || userEmail.trim();
    const first = source.charAt(0).toUpperCase();
    return first || "?";
  }, [userEmail, userName]);

  const performLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await signOutSession();
      await clearAuthStorage();
      setSessionToken(null);
      setUserId(null);
      stopSync();

      await clearLocalDatabase();
      clearAllDeckMedia();
      clearDecks();
    } catch (error) {
      logger.error("[Account] Logout failed", error);
      Alert.alert(t("mobile.account.logoutErrorTitle"), t("mobile.account.logoutErrorBody"));
    } finally {
      setIsLoggingOut(false);
    }
  }, [clearDecks, setUserId, stopSync, t]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      t("mobile.account.logoutConfirmTitle"),
      t("mobile.account.logoutConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("mobile.account.logoutConfirmAction"),
          style: "destructive",
          onPress: () => {
            void performLogout();
          },
        },
      ],
      { cancelable: true },
    );
  }, [performLogout, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("account.title")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{avatarLabel}</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{t("account.subtitle")}</Text>

          <View style={styles.metaGroup}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.muted }]}>{t("web.auth.emailLabel")}</Text>
              <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate("Export")}
          activeOpacity={0.8}
        >
          <Ionicons name="download-outline" size={18} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>{t("settings.exportData")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: isLoggingOut ? 0.7 : 1 },
          ]}
          onPress={handleLogout}
          disabled={isLoggingOut}
          activeOpacity={0.8}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          )}
          <Text style={[styles.logoutText, { color: colors.danger }]}>
            {isLoggingOut ? t("common.loading") : t("settings.logOut")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  content: { padding: 16, gap: 16 },
  accountCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, textAlign: "center" },
  metaGroup: { width: "100%", marginTop: 8, gap: 10 },
  metaRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLabel: { fontSize: 13, fontWeight: "600" },
  metaValue: { fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  actionButton: {
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionText: { fontSize: 15, fontWeight: "700" },
  logoutButton: {
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },
});
