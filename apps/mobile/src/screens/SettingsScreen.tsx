import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DeckStackParamList } from '../navigation/types';
import { APP_CAPABILITIES } from '../config/app-mode';
import { usePalette } from '../theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supportedLanguages } from '../constants';
import { useStore } from '../store/useStore';
import { version as appVersion } from '../../package.json';
import { getFsrsParameters } from '../services/fsrsScheduler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<DeckStackParamList, 'SettingsHome'>;

export default function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const language = useStore((state) => state.language);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useStore((state) => state.setHapticsEnabled);
  const dailyGoal = useStore((state) => state.dailyGoal);
  const fsrsParams = useStore((state) => state.fsrsParams);

  const languageLabel = useMemo(() => {
    const found = supportedLanguages.find((entry) => entry.code === language);
    return found ? t(found.labelKey) : t('languages.english');
  }, [language, t]);

  const fsrsPresetLabel = useMemo(() => {
    const defaults = getFsrsParameters();
    const presets = {
      gentle: { request_retention: 0.92, maximum_interval: 180, enable_short_term: true, enable_fuzz: true },
      balanced: { request_retention: 0.9, maximum_interval: 365, enable_short_term: true, enable_fuzz: true },
      fast: { request_retention: 0.85, maximum_interval: 730, enable_short_term: false, enable_fuzz: true },
    };
    const retention = fsrsParams.request_retention ?? defaults.request_retention;
    const maxInterval = fsrsParams.maximum_interval ?? defaults.maximum_interval;
    const shortTerm = fsrsParams.enable_short_term ?? defaults.enable_short_term;
    const fuzz = fsrsParams.enable_fuzz ?? defaults.enable_fuzz;
    const matches = (preset: typeof presets.gentle) =>
      Math.abs(preset.request_retention - retention) < 0.005 &&
      Math.abs(preset.maximum_interval - maxInterval) < 1 &&
      preset.enable_short_term === shortTerm &&
      preset.enable_fuzz === fuzz;
    if (matches(presets.gentle)) return t('fsrs.preset.gentle.label');
    if (matches(presets.balanced)) return t('fsrs.preset.balanced.label');
    if (matches(presets.fast)) return t('fsrs.preset.fast.label');
    return t('fsrs.preset.custom.label');
  }, [fsrsParams, t]);

  const handleHelpCenter = async () => {
    await Linking.openURL('https://getflashly.com/help');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t('settings.sections.preferences')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              label={t('settings.language')}
              icon="globe-outline"
              iconColor="#ffffff"
              iconBg="#2f6bff"
              value={languageLabel}
              onPress={() => navigation.navigate('Language')}
              showDivider
              colors={colors}
            />
            <View style={styles.hidden}>
              <SettingsRow
                label={t('settings.notifications')}
                icon="notifications-outline"
                iconColor="#ffffff"
                iconBg="#eb4c42"
                showDivider
                colors={colors}
              />
            </View>
            <SettingsRow
              label={t('settings.haptics')}
              icon="pulse-outline"
              iconColor="#ffffff"
              iconBg="#6b7280"
              colors={colors}
              rightElement={
                <Switch
                  value={hapticsEnabled}
                  onValueChange={setHapticsEnabled}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#ffffff"
                />
              }
              showChevron={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t('settings.sections.studyAlgorithm')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              label={t('settings.fsrsSettings')}
              icon="options-outline"
              iconColor="#ffffff"
              iconBg="#6366f1"
              value={fsrsPresetLabel}
              onPress={() => navigation.navigate('FsrsSettings')}
              showDivider
              colors={colors}
            />
            <SettingsRow
              label={t("settings.timeGrading")}
              icon="timer-outline"
              iconColor="#ffffff"
              iconBg="#f97316"
              value={t("settings.timeGradingDefault")}
              onPress={() => navigation.navigate("TimeGradingSettings")}
              showDivider
              colors={colors}
            />
            <SettingsRow
              label={t('settings.dailyGoal')}
              icon="flag-outline"
              iconColor="#ffffff"
              iconBg="#14b8a6"
              value={t('settings.dailyGoalValue', { count: dailyGoal })}
              colors={colors}
              onPress={() => navigation.navigate('DailyGoal')}
            />
          </View>
          <Text style={[styles.footnote, { color: colors.muted }]}>{t('settings.fsrsFootnote')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>{t('settings.sections.support')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {APP_CAPABILITIES.externalProductLinks ? (
              <SettingsRow
                label={t('settings.helpCenter')}
                icon="help-circle-outline"
                iconColor="#ffffff"
                iconBg="#8b5cf6"
                colors={colors}
                showDivider
                rightIcon="open-outline"
                onPress={handleHelpCenter}
              />
            ) : null}
            <SettingsRow
              label={t('settings.about')}
              icon="information-circle-outline"
              iconColor="#ffffff"
              iconBg="#ec4899"
              colors={colors}
              onPress={() => navigation.navigate('About')}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={[styles.footerIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.footerText, { color: colors.muted }]}>
            {t('settings.versionLabel', { version: appVersion })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

type SettingsRowProps = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  value?: string;
  onPress?: () => void;
  showDivider?: boolean;
  showChevron?: boolean;
  rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
  rightElement?: React.ReactNode;
  colors: ReturnType<typeof usePalette>;
};

function SettingsRow({
  label,
  icon,
  iconColor,
  iconBg,
  value,
  onPress,
  showDivider = false,
  showChevron = true,
  rightIcon,
  rightElement,
  colors,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }, showDivider ? styles.rowDivider : null]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconBadge, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.valueText, { color: colors.muted }]}>{value}</Text> : null}
        {rightElement ?? null}
        {showChevron ? <Ionicons name={rightIcon ?? 'chevron-forward'} size={16} color={colors.muted} /> : null}
      </View>
    </TouchableOpacity>
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
    fontWeight: '700',
  },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDivider: { borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontSize: 15, fontWeight: '600', flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueText: { fontSize: 13 },
  footnote: { fontSize: 11, lineHeight: 16, marginLeft: 4 },
  footer: { alignItems: 'center', gap: 6, paddingTop: 8 },
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  footerText: { fontSize: 12, fontWeight: '600' },
  footerSubtext: { fontSize: 10 },
  hidden: { display: 'none' },
});
