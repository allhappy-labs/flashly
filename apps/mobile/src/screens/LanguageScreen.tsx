import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../constants';
import type { DeckStackParamList } from '../navigation/types';
import { useStore } from '../store/useStore';
import { usePalette } from '../theme';

type Props = NativeStackScreenProps<DeckStackParamList, 'Language'>;

export default function LanguageScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);
  const colors = usePalette();

  React.useEffect(() => {
    navigation.setOptions({ title: t('settings.language'), headerBackTitle: t('common.back') });
  }, [navigation, t]);

  const handleSelect = async (code: string) => {
    await setLanguage(code);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {supportedLanguages.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={() => handleSelect(lang.code)}
        >
          <Text style={[styles.label, { color: colors.text }]}>{t(lang.labelKey)}</Text>
          {language === lang.code ? <Text style={[styles.selected, { color: colors.primary }]}>●</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 16 },
  selected: { color: '#111827' },
});
