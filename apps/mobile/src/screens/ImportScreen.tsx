import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import type { DeckStackParamList } from '../navigation/types';
import {
  deleteImportCacheDirectory,
  ImportError,
  ImportErrorCode,
  normalizeIncomingFlashlyUri,
  pickImportFile,
  readPreparedImportFile,
  readPreparedImportWithOwnership,
  resolveMediaForCards,
  type PickedFile,
} from '../services/importService';
import { deleteStoredMediaFiles } from '../services/deckMedia';
import { APP_CAPABILITIES } from '../config/app-mode';
import { useStore } from '../store/useStore';
import type { ParsedCard } from '../types/models';
import { usePalette } from '../theme';
import MarkdownText from '../components/MarkdownText';
import { logger } from '../utils/logger';

type Props = NativeStackScreenProps<DeckStackParamList, 'Import'>;

function importErrorMessageKey(error: unknown): string {
  if (!(error instanceof ImportError)) return 'import.errors.unexpected';
  switch (error.code) {
    case ImportErrorCode.MissingFileAsset:
      return 'import.errors.missingFileAsset';
    case ImportErrorCode.UnsupportedFileType:
      return 'import.errors.unsupportedFileType';
    case ImportErrorCode.ArchiveTooLarge:
      return 'import.errors.archiveTooLarge';
    case ImportErrorCode.TooManyEntries:
      return 'import.errors.tooManyEntries';
    case ImportErrorCode.InvalidEntryMetadata:
    case ImportErrorCode.ArchiveExpandedTooLarge:
    case ImportErrorCode.EntryTooLarge:
      return 'import.errors.unsafeArchive';
    case ImportErrorCode.CoreDataTooLarge:
      return 'import.errors.coreDataTooLarge';
    case ImportErrorCode.MissingConfig:
      return 'import.errors.missingConfig';
    case ImportErrorCode.InvalidConfig:
    case ImportErrorCode.UnsupportedVersion:
      return 'import.errors.invalidConfig';
    case ImportErrorCode.MissingCardData:
      return 'import.errors.missingCardData';
    case ImportErrorCode.InvalidCardData:
      return 'import.errors.invalidCardData';
    case ImportErrorCode.NoCards:
      return 'import.noCards';
    case ImportErrorCode.InvalidArchive:
      return 'import.errors.invalidArchive';
  }
}

export default function ImportScreen({ route, navigation }: Props) {
  const { deckId, deckName: incomingName } = route.params ?? {};
  const { t } = useTranslation();
  const [deckName, setDeckName] = useState(incomingName || '');
  const [preview, setPreview] = useState<ParsedCard[]>([]);
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [zipImages, setZipImages] = useState<Record<string, string> | null>(null);
  const [zipAudio, setZipAudio] = useState<Record<string, string> | null>(null);
  const [zipCacheDir, setZipCacheDir] = useState<string | null>(null);
  const [importedDescription, setImportedDescription] = useState<string | null>(null);
  const [destination, setDestination] = useState<'new' | 'existing'>(deckId ? 'existing' : 'new');
  const [deckPickerOpen, setDeckPickerOpen] = useState(false);
  const [pendingDeckId, setPendingDeckId] = useState<string | undefined>(deckId);
  const mountedRef = useRef(false);
  const pickerInFlightRef = useRef(false);
  const decks = useStore((state) => state.decks);
  const [targetDeckId, setTargetDeckId] = useState<string | undefined>(deckId);
  const colors = usePalette();

  const addDeck = useStore((state) => state.addDeck);
  const removeDeck = useStore((state) => state.removeDeck);
  const bulkAddCards = useStore((state) => state.bulkAddCards);

  useEffect(() => {
    navigation.setOptions({ title: t('import.title') });
  }, [navigation, t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (destination !== 'existing') return;
    if (targetDeckId) return;
    if (deckId) {
      setTargetDeckId(deckId);
      return;
    }
    if (decks.length) {
      setTargetDeckId(decks[0].id);
    }
  }, [destination, targetDeckId, deckId, decks]);

  useEffect(() => () => {
    try {
      deleteImportCacheDirectory(zipCacheDir);
    } catch (error) {
      logger.error('Abandoned import cache cleanup failed:', error);
    }
  }, [zipCacheDir]);

  // Auto-import from fileUri (when opening .flashly file from file manager)
  useEffect(() => {
    const fileUri = route.params?.fileUri;
    if (!fileUri) return;
    const normalizedUri = normalizeIncomingFlashlyUri(fileUri);
    if (!normalizedUri) {
      Alert.alert(t('common.error'), t('import.errors.unsupportedFileType'));
      return;
    }

    const performAutoImport = async () => {
      let cacheDirUri: string | undefined;
      let createdDeckId: string | undefined;
      let storedMediaUris: string[] = [];
      try {
        setImporting(true);

        // Convert fileUri to PickedFile format
        const pickedFile: PickedFile = {
          uri: normalizedUri,
          name: normalizedUri.split('/').pop() || 'import.flashly',
          mimeType: 'application/zip',
          lastModified: 0,
          isZip: true,
        };

        // Read and parse the file
        const prepared = await readPreparedImportFile(pickedFile);
        const payload = prepared.payload;
        cacheDirUri = payload.cacheDirUri;
        const cards = prepared.cards;

        // Create new deck
        const deckName = payload.config.deck.name || t('import.defaultDeckName');
        const deckDescription = payload.config.deck.description ?? '';
        const newDeckId = await addDeck(deckName, deckDescription);
        createdDeckId = newDeckId;

        // Resolve media and import cards
        const { cards: cardsWithMedia, missingImages, missingAudio, storedMediaUris: storedUris } = await resolveMediaForCards(
          cards,
          payload.images ?? null,
          payload.audio ?? null,
          newDeckId,
          deckName,
          APP_CAPABILITIES.remoteMedia,
        );
        storedMediaUris = storedUris;

        await bulkAddCards(newDeckId, cardsWithMedia);

        // Show result and navigate to deck
        if (missingImages || missingAudio) {
          Alert.alert(
            t('import.imported', { count: cards.length }),
            t('import.missingMediaWarning', { images: missingImages, audio: missingAudio }),
          );
        } else {
          Alert.alert(t('import.imported', { count: cards.length }));
        }

        // Navigate to deck overview
        navigation.reset({
          index: 1,
          routes: [
            { name: 'DeckList' },
            { name: 'DeckOverview', params: { deckId: newDeckId } },
          ],
        });
      } catch (error) {
        deleteStoredMediaFiles(storedMediaUris);
        if (createdDeckId) {
          try {
            await removeDeck(createdDeckId);
          } catch (cleanupError) {
            logger.error('Auto-import deck cleanup failed:', cleanupError);
          }
        }
        logger.error('Auto-import failed:', error);
        Alert.alert(t('common.error'), t(importErrorMessageKey(error)));
      } finally {
        try {
          deleteImportCacheDirectory(cacheDirUri);
        } catch (cleanupError) {
          logger.error('Auto-import cache cleanup failed:', cleanupError);
        }
        setImporting(false);
      }
    };

    performAutoImport();
  }, [route.params?.fileUri]);

  const handlePickFile = async () => {
    if (pickerInFlightRef.current) return;
    pickerInFlightRef.current = true;
    try {
      const picked = await pickImportFile();
      if (!picked || !mountedRef.current) return;
      await readPreparedImportWithOwnership(
        () => readPreparedImportFile(picked),
        () => mountedRef.current,
        (prepared) => {
          const payload = prepared.payload;
          try {
            deleteImportCacheDirectory(zipCacheDir);
          } catch (cleanupError) {
            logger.error('Previous import cache cleanup failed:', cleanupError);
          }
          setFileName(payload.name ?? null);
          setZipImages(payload.images ?? null);
          setZipAudio(payload.audio ?? null);
          setZipCacheDir(payload.cacheDirUri ?? null);
          setImportedDescription(payload.config.deck.description ?? null);
          if (!deckId) {
            setDeckName(payload.config.deck.name);
          }
          setParsedCards(prepared.cards);
          setPreview(prepared.cards.slice(0, 1));
        },
      );
    } catch (error) {
      if (mountedRef.current) {
        Alert.alert(t('common.error'), t(importErrorMessageKey(error)));
      }
    } finally {
      pickerInFlightRef.current = false;
    }
  };

  const handleClearSource = () => {
    try {
      deleteImportCacheDirectory(zipCacheDir);
    } catch (error) {
      logger.error('Import cache cleanup failed:', error);
    }
    setFileName(null);
    setZipImages(null);
    setZipAudio(null);
    setZipCacheDir(null);
    setImportedDescription(null);
    setParsedCards([]);
    setPreview([]);
  };

  const handleDestinationChange = (next: 'new' | 'existing') => {
    if (next === destination) return;
    setDestination(next);
    if (next === 'new') {
      setTargetDeckId(undefined);
      return;
    }
    if (!targetDeckId && decks.length) {
      setTargetDeckId(decks[0].id);
    }
  };

  const selectedDeck = decks.find((deck) => deck.id === targetDeckId);
  const targetName =
    destination === 'existing'
      ? selectedDeck?.name
      : deckName || t('import.defaultDeckName');

  const handleImport = async () => {
    if (!parsedCards.length) {
      Alert.alert(t('import.noCards'));
      return;
    }
    setImporting(true);
    let createdDeckId: string | undefined;
    let storedMediaUris: string[] = [];
    try {
      const deckTarget = targetDeckId ?? await addDeck(
        deckName || t('import.defaultDeckName'),
        importedDescription ?? '',
      );
      if (!targetDeckId) createdDeckId = deckTarget;
      const targetDeckName =
        decks.find((entry) => entry.id === deckTarget)?.name ?? (deckName || t('import.defaultDeckName'));

      // Use reusable media resolution function
      const { cards: cardsToImport, missingImages, missingAudio, storedMediaUris: storedUris } = await resolveMediaForCards(
        parsedCards,
        zipImages,
        zipAudio,
        deckTarget,
        targetDeckName,
        APP_CAPABILITIES.remoteMedia,
      );
      storedMediaUris = storedUris;

      await bulkAddCards(deckTarget, cardsToImport);
      if (missingImages || missingAudio) {
        Alert.alert(
          t('import.imported', { count: parsedCards.length }),
          t('import.missingMediaWarning', { images: missingImages, audio: missingAudio }),
        );
      } else {
        Alert.alert(t('import.imported', { count: parsedCards.length }));
      }
      navigation.reset({
        index: 1,
        routes: [
          { name: 'DeckList' },
          { name: 'DeckOverview', params: { deckId: deckTarget } },
        ],
      });
    } catch (error) {
      deleteStoredMediaFiles(storedMediaUris);
      if (createdDeckId) {
        try {
          await removeDeck(createdDeckId);
        } catch (cleanupError) {
          logger.error('Import deck cleanup failed:', cleanupError);
        }
      }
      Alert.alert(t('common.error'), t(importErrorMessageKey(error)));
    } finally {
      setImporting(false);
      try {
        deleteImportCacheDirectory(zipCacheDir);
      } catch (cleanupError) {
        logger.error('Import cache cleanup failed:', cleanupError);
      }
      setZipCacheDir(null);
    }
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.container, styles.scrollContent]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>{t('import.deckDestination')}</Text>
        <View style={[styles.segmentedControl, { backgroundColor: colors.secondary }]}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              { backgroundColor: destination === 'new' ? colors.card : 'transparent' },
            ]}
            onPress={() => handleDestinationChange('new')}
          >
            <Text
              style={[
                styles.segmentButtonText,
                { color: destination === 'new' ? colors.text : colors.muted },
              ]}
            >
              {t('import.newDeck')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              { backgroundColor: destination === 'existing' ? colors.card : 'transparent' },
            ]}
            onPress={() => handleDestinationChange('existing')}
            disabled={!decks.length}
          >
            <Text
              style={[
                styles.segmentButtonText,
                { color: destination === 'existing' ? colors.text : colors.muted },
              ]}
            >
              {t('import.existingDeck')}
            </Text>
          </TouchableOpacity>
        </View>
        {destination === 'new' ? (
          <View style={styles.section}>
            <Text style={[styles.subLabel, { color: colors.muted }]}>{t('import.deckName')}</Text>
            <TextInput
              value={deckName}
              onChangeText={setDeckName}
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
              placeholder={t('import.deckName')}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.selectorButton,
              { borderColor: colors.border, backgroundColor: colors.card },
              !decks.length && styles.selectorButtonDisabled,
            ]}
            onPress={() => {
              if (!decks.length) return;
              setPendingDeckId(targetDeckId ?? decks[0].id);
              setDeckPickerOpen(true);
            }}
            disabled={!decks.length}
          >
            <Text style={[styles.selectorText, { color: colors.text }]}>
              {selectedDeck?.name ?? t('import.selectDeck')}
            </Text>
            <Text style={[styles.selectorHint, { color: colors.muted }]}>▾</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={handleClearSource}>
            <Text style={[styles.clearText, { color: colors.primary }]}>{t('import.clear')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.uploadButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}
          onPress={handlePickFile}
        >
          <Text style={[styles.uploadText, { color: colors.text }]}>{t('import.uploadFile')}</Text>
        </TouchableOpacity>
        {fileName ? <Text style={[styles.fileName, { color: colors.muted }]}>{fileName}</Text> : null}
      </View>

      {preview.length ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>{t('import.preview')}</Text>
          {preview.map((card, idx) => (
            <View
              key={`${card.front}-${idx}`}
              style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <MarkdownText
                value={card.front}
                color={colors.text}
                mutedColor={colors.muted}
                accentColor={colors.accent}
                textAlign="left"
                fontSize={16}
              />
              <MarkdownText
                value={card.back}
                color={colors.muted}
                mutedColor={colors.muted}
                accentColor={colors.accent}
                textAlign="left"
                fontSize={14}
              />
              {card.pos ? <Text style={[styles.previewMeta, { color: colors.muted }]}>{card.pos}</Text> : null}
              {card.example ? <Text style={[styles.previewExample, { color: colors.muted }]}>"{card.example}"</Text> : null}
              <View style={styles.previewTagRow}>
                {card.category ? <Text style={[styles.previewTag, { color: colors.text }]}>{card.category}</Text> : null}
                {(card.tags ?? []).map((tag) => (
                  <Text key={tag} style={[styles.previewTag, { color: colors.text }]}>{tag}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: colors.muted }]}>
          {t('import.readySummary', { count: parsedCards.length })}
        </Text>
        <Text style={[styles.summaryText, styles.summaryTextRight, { color: colors.muted }]}>
          {t('import.targetSummary', { target: targetName ?? t('import.defaultDeckName') })}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary }, importing && { opacity: 0.7 }]}
        onPress={handleImport}
        disabled={importing}
      >
        <Text style={styles.primaryText}>{importing ? '...' : t('deck.import')}</Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={deckPickerOpen}
        animationType="fade"
        onRequestClose={() => setDeckPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDeckPickerOpen(false)}
        >
          <View style={[styles.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                {t('import.selectExistingDeck')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (pendingDeckId) setTargetDeckId(pendingDeckId);
                  setDeckPickerOpen(false);
                }}
              >
                <Text style={[styles.pickerAction, { color: colors.primary }]}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={pendingDeckId}
              onValueChange={(value) => setPendingDeckId(String(value))}
              style={Platform.OS === 'ios' ? styles.picker : undefined}
            >
              {decks.map((deck) => (
                <Picker.Item key={deck.id} label={deck.name} value={deck.id} />
              ))}
            </Picker>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, gap: 16 },
  scrollContent: { paddingBottom: 32, flexGrow: 1 },
  section: { gap: 8 },
  label: { fontWeight: '700', fontSize: 16 },
  subLabel: { fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 120, maxHeight: 120, textAlignVertical: 'top' },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { fontWeight: '600' },
  previewCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  fileName: { marginTop: 6, fontStyle: 'italic' },
  previewMeta: { fontSize: 12, marginTop: 4 },
  previewExample: { fontStyle: 'italic', marginTop: 2 },
  previewTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  previewTag: { fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  summaryText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  summaryTextRight: { textAlign: 'right' },
  segmentedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 4,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentButtonText: { fontWeight: '600', fontSize: 13 },
  selectorButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorButtonDisabled: { opacity: 0.6 },
  selectorText: { fontSize: 14, fontWeight: '600' },
  selectorHint: { fontSize: 16, fontWeight: '600' },
  optionRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  textAreaWrap: { position: 'relative' },
  textAreaTag: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  textAreaTagText: { fontSize: 11, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  uploadButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  uploadText: { fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pickerTitle: { fontSize: 16, fontWeight: '700' },
  pickerAction: { fontSize: 15, fontWeight: '600' },
  picker: { height: 180 },
});
