import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DeckStackParamList } from '../navigation/types';
import { APP_CAPABILITIES } from '../config/app-mode';
import { FRONTEND_APP_URL } from '../constants';
import { useStore } from '../store/useStore';
import { usePalette } from '../theme';

type Props = NativeStackScreenProps<DeckStackParamList, 'DeckCreate'>;

export default function DeckCreateScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const addDeck = useStore((state) => state.addDeck);
  const colors = usePalette();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: t('deckList.addDeck') });
  }, [navigation, t]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('deckList.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const deckId = await addDeck(name.trim(), description.trim());
      navigation.replace('DeckDetail', { deckId });
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWithAi = () => {
    void Linking.openURL(FRONTEND_APP_URL).catch(() => {
      Alert.alert(t('common.error'));
    });
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.muted }]}>{t('deckList.deckNamePlaceholder')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('deckList.deckNameExample')}
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
        />
      </View>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.muted }]}>{t('deck.descriptionPlaceholder')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('deck.descriptionExample')}
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            styles.textArea,
            { borderColor: colors.border, backgroundColor: colors.card, color: colors.text },
          ]}
          multiline
          textAlignVertical="top"
        />
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.primaryText}>{t('common.save')}</Text>
      </TouchableOpacity>

      {APP_CAPABILITIES.externalProductLinks ? (
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.muted }]}>{t('common.or')}</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('Import', {})}
      >
        <Text style={[styles.secondaryText, { color: colors.text }]}>{t('deck.import')}</Text>
      </TouchableOpacity>

      {APP_CAPABILITIES.externalProductLinks ? (
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={handleGenerateWithAi}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>{t("deck.generate")}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 16 },
  section: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 120 },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryText: { fontWeight: '700' },
});
