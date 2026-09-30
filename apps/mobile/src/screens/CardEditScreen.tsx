import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { APP_CAPABILITIES } from '../config/app-mode';
import { listCards } from '../db/deckRepositorySafe';
import type { DeckStackParamList } from '../navigation/types';
import { useStore } from '../store/useStore';
import { usePalette } from '../theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { storeDeckAudio, storeDeckImage } from '../services/deckMedia';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalFileAvailability } from '../hooks/useLocalFileAvailability';
import { logger } from '../utils/logger';
import { usableMediaUri } from '../utils/media-policy';

type Props = NativeStackScreenProps<DeckStackParamList, 'CardEdit'>;

export default function CardEditScreen({ route, navigation }: Props) {
  const { deckId, cardId } = route.params;
  const { t } = useTranslation();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [category, setCategory] = useState('');
  const [pos, setPos] = useState('');
  const [example, setExample] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(!!cardId);
  const [processingImage, setProcessingImage] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const deckName = useStore((state) => state.decks.find((deck) => deck.id === deckId)?.name ?? 'deck');
  const saveCard = useStore((state) => state.saveCard);
  const removeCard = useStore((state) => state.removeCard);
  const colors = usePalette();
  const usableImageUrl = usableMediaUri(imageUrl, APP_CAPABILITIES.remoteMedia);
  const usableAudioUrl = usableMediaUri(audioUrl, APP_CAPABILITIES.remoteMedia);
  const imageAvailable = useLocalFileAvailability(usableImageUrl);

  useEffect(() => {
    navigation.setOptions({
      title: cardId ? t('card.edit') : t('card.add'),
      headerBackButtonMenuEnabled: false,
    });
  }, [cardId, navigation, t]);

  useEffect(() => {
    const loadCard = async () => {
      if (!cardId) return;
      const result = await listCards(deckId);
      if (result.isErr()) {
        logger.error('Failed to load cards:', result.error.message);
        setLoading(false);
        return;
      }
      const cards = result.value;
      const found = cards.find((c) => c.id === cardId);
      if (found) {
        const foundImageUrl = usableMediaUri(found.imageUrl, APP_CAPABILITIES.remoteMedia) ?? '';
        const foundAudioUrl = usableMediaUri(found.audioUrl, APP_CAPABILITIES.remoteMedia) ?? '';
        setFront(found.front);
        setBack(found.back);
        setCategory(found.category ?? '');
        setPos(found.pos ?? '');
        setExample(found.example ?? '');
        setTagsText((found.tags ?? []).join(', '));
        setImageUrl(foundImageUrl);
        setAudioUrl(foundAudioUrl);
        setInitialSnapshot(JSON.stringify({
          front: found.front ?? '',
          back: found.back ?? '',
          category: found.category ?? '',
          pos: found.pos ?? '',
          example: found.example ?? '',
          tagsText: (found.tags ?? []).join(', '),
          imageUrl: foundImageUrl,
          audioUrl: foundAudioUrl,
        }));
      }
      setLoading(false);
    };
    loadCard();
  }, [cardId, deckId]);

  useEffect(() => {
    if (cardId) return;
    setInitialSnapshot(JSON.stringify({
      front: '',
      back: '',
      category: '',
      pos: '',
      example: '',
      tagsText: '',
      imageUrl: '',
      audioUrl: '',
    }));
  }, [cardId]);

  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    const snapshot = JSON.stringify({
      front,
      back,
      category,
      pos,
      example,
      tagsText,
      imageUrl,
      audioUrl,
    });
    return snapshot !== initialSnapshot;
  }, [audioUrl, back, category, example, front, imageUrl, initialSnapshot, pos, tagsText]);

  usePreventRemove(isDirty && !processingImage && !processingAudio && !isSaving, ({ data }) => {
    Alert.alert(
      t('common.unsavedChanges', 'Discard changes?'),
      t('common.unsavedChangesBody', 'Your changes will be lost.'),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => {} },
        {
          text: t('common.discard', 'Discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  const parseTags = (value: string) =>
    value
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

  const handlePickImage = async () => {
    if (processingImage) return;
    setProcessingImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('common.error'), t('card.imagePermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const maxSize = 1080;
      let resize: { width?: number; height?: number } | null = null;
      if (asset.width && asset.height) {
        if (asset.width >= asset.height && asset.width > maxSize) {
          resize = { width: maxSize };
        } else if (asset.height > maxSize) {
          resize = { height: maxSize };
        }
      }

      const manipulated = await manipulateAsync(
        asset.uri,
        resize ? [{ resize }] : [],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      setImageUrl(manipulated.uri);
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
    } finally {
      setProcessingImage(false);
    }
  };

  const handlePickAudio = async () => {
    if (processingAudio) return;
    setProcessingAudio(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: ['audio/*'],
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setAudioUrl(asset.uri);
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
    } finally {
      setProcessingAudio(false);
    }
  };

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      Alert.alert(t('card.fillBoth'));
      return;
    }
    if (processingImage || processingAudio) return;
    setIsSaving(true);
    try {
      const rawImage = usableImageUrl ?? '';
      const rawAudio = usableAudioUrl ?? '';
      const [storedImage, storedAudio] = await Promise.all([
        rawImage
          ? storeDeckImage({ deckId, deckName, sourceUri: rawImage })
          : Promise.resolve(''),
        rawAudio
          ? storeDeckAudio({ deckId, deckName, sourceUri: rawAudio })
          : Promise.resolve(''),
      ]);
      await saveCard(deckId, {
        cardId,
        front: front.trim(),
        back: back.trim(),
        imageUrl: storedImage || null,
        audioUrl: storedAudio || null,
        category: category.trim() || null,
        pos: pos.trim() || null,
        example: example.trim() || null,
        tags: parseTags(tagsText),
      });
      setInitialSnapshot(JSON.stringify({
        front: front.trim(),
        back: back.trim(),
        category: category.trim() || '',
        pos: pos.trim() || '',
        example: example.trim() || '',
        tagsText,
        imageUrl: storedImage || '',
        audioUrl: storedAudio || '',
      }));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), String(error));
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!cardId) return;
    Alert.alert(t('card.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);
          await removeCard(cardId, deckId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.frontPlaceholder')}</Text>
          <TextInput
            placeholder={t('card.frontPlaceholder')}
            placeholderTextColor={colors.muted}
            value={front}
            onChangeText={setFront}
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
            multiline
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.backPlaceholder')}</Text>
          <TextInput
            placeholder={t('card.backPlaceholder')}
            placeholderTextColor={colors.muted}
            value={back}
            onChangeText={setBack}
            style={[
              styles.input,
              { minHeight: 140, borderColor: colors.border, backgroundColor: colors.card, color: colors.text },
            ]}
            multiline
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.imageLabel')}</Text>
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handlePickImage}
              disabled={processingImage}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>{t('card.imagePick')}</Text>
            </TouchableOpacity>
            {usableImageUrl ? (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => setImageUrl('')}
                disabled={processingImage}
              >
                <Text style={[styles.secondaryText, { color: colors.text }]}>{t('card.imageRemove')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {APP_CAPABILITIES.remoteMedia ? (
            <>
              <TextInput
                placeholder={t('card.imageUrlPlaceholder')}
                placeholderTextColor={colors.muted}
                value={imageUrl}
                onChangeText={setImageUrl}
                style={[styles.input, styles.inputSingle, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                onPress={() => Linking.openURL('https://unsplash.com/')}
                style={styles.unsplashLink}
              >
                <Text style={[styles.unsplashLinkText, { color: colors.primary }]}>
                  {t('card.imageUnsplash', 'Select an Image from Unsplash')}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
          <View style={[styles.imagePreview, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            {usableImageUrl && imageAvailable ? (
              <Image source={{ uri: usableImageUrl }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={28} color={colors.muted} />
                <Text style={[styles.imagePlaceholderText, { color: colors.muted }]}>
                  {t('card.imageEmpty')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.audioLabel')}</Text>
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handlePickAudio}
              disabled={processingAudio}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>{t('card.audioPick')}</Text>
            </TouchableOpacity>
            {usableAudioUrl ? (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => setAudioUrl('')}
                disabled={processingAudio}
              >
                <Text style={[styles.secondaryText, { color: colors.text }]}>{t('card.audioRemove')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {APP_CAPABILITIES.remoteMedia ? (
            <TextInput
              placeholder={t('card.audioUrlPlaceholder')}
              placeholderTextColor={colors.muted}
              value={audioUrl}
              onChangeText={setAudioUrl}
              style={[styles.input, styles.inputSingle, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          ) : null}
          <View style={[styles.audioPreview, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            {usableAudioUrl ? (
              <View style={styles.audioPlaceholder}>
                <Ionicons name="musical-notes-outline" size={22} color={colors.muted} />
                <Text style={[styles.imagePlaceholderText, { color: colors.muted }]}>
                  {t('card.audioAttached')}
                </Text>
              </View>
            ) : (
              <View style={styles.audioPlaceholder}>
                <Ionicons name="musical-note-outline" size={22} color={colors.muted} />
                <Text style={[styles.imagePlaceholderText, { color: colors.muted }]}>
                  {t('card.audioEmpty')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.category')}</Text>
          <TextInput
            placeholder={t('card.categoryPlaceholder')}
            placeholderTextColor={colors.muted}
            value={category}
            onChangeText={setCategory}
            style={[styles.input, styles.inputSingle, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.posLabel')}</Text>
          <TextInput
            placeholder={t('card.posPlaceholder')}
            placeholderTextColor={colors.muted}
            value={pos}
            onChangeText={setPos}
            style={[styles.input, styles.inputSingle, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.exampleLabel')}</Text>
          <TextInput
            placeholder={t('card.examplePlaceholder')}
            placeholderTextColor={colors.muted}
            value={example}
            onChangeText={setExample}
            style={[
              styles.input,
              { minHeight: 100, borderColor: colors.border, backgroundColor: colors.card, color: colors.text },
            ]}
            multiline
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('card.tags')}</Text>
          <TextInput
            placeholder={t('card.tagsPlaceholder')}
            placeholderTextColor={colors.muted}
            value={tagsText}
            onChangeText={setTagsText}
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary },
            (processingImage || processingAudio) && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={processingImage || processingAudio}
        >
          <Text style={styles.primaryText}>{t('common.save')}</Text>
        </TouchableOpacity>

        {cardId ? (
          <TouchableOpacity style={[styles.dangerButton, { backgroundColor: colors.danger }]} onPress={handleDelete}>
            <Text style={styles.primaryText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  form: { gap: 16 },
  section: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 100,
    fontSize: 16,
  },
  inputSingle: { minHeight: 52 },
  imageActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  unsplashLink: { paddingVertical: 8 },
  unsplashLinkText: { fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  secondaryText: { fontWeight: '600' },
  imagePreview: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', height: 160 },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderText: { fontSize: 12, fontWeight: '600' },
  audioPreview: { borderWidth: 1, borderRadius: 16, height: 90 },
  audioPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },
  dangerButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
  },
});
