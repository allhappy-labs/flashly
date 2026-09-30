import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TFunction } from 'i18next';
import type { Palette } from '../../theme';

type Props = {
  colors: Palette;
  t: TFunction;
  totalCount: number;
  correctCount: number;
  startTime: number | null;
  onBackToDeck: () => void;
  onRestart: () => void;
};

export function LearnModeCompletionView({
  colors,
  t,
  totalCount,
  correctCount,
  startTime,
  onBackToDeck,
  onRestart,
}: Props) {
  const durationMs = startTime ? Date.now() - startTime : 0;
  const minutes = Math.max(1, Math.round(durationMs / 60000));
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <View style={[styles.centered, { backgroundColor: colors.background, paddingHorizontal: 20 }]}>
      <Text style={[styles.doneTitle, { color: colors.text }]}>
        {t('learn.completedTitle', { defaultValue: 'Session complete' })}
      </Text>
      <Text style={[styles.doneSubtitle, { color: colors.muted }]}>
        {t('learn.completedSubtitle', { defaultValue: 'Great work finishing your Learn session.' })}
      </Text>
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>
            {t('learn.summaryCards', { defaultValue: 'Cards completed' })}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{totalCount}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>
            {t('learn.summaryAccuracy', { defaultValue: 'Accuracy' })}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{accuracy}%</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>
            {t('learn.summaryTime', { defaultValue: 'Time spent' })}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{minutes}m</Text>
        </View>
      </View>
      <View style={styles.summaryRowSplit}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.secondary }]}
          onPress={onBackToDeck}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>
            {t('learn.backToDeck', { defaultValue: 'Back to deck' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={onRestart}>
          <Text style={styles.actionTextLight}>{t('learn.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 24, fontWeight: '800' },
  doneSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginTop: 16,
    gap: 10,
    width: '100%',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  summaryRowSplit: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  actionButton: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  actionText: { fontWeight: '700' },
  actionTextLight: { color: '#fff', fontWeight: '700' },
});
