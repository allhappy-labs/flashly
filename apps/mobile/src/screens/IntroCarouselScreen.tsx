import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { DeckStackParamList, HostedDeckStackParamList, LocalRootStackParamList } from '../navigation/types';
import { supportedLanguages } from '../constants';
import { APP_CAPABILITIES } from '../config/app-mode';
import { useStore } from '../store/useStore';
import { usePalette } from '../theme';
import { getIntroSlideKeys } from './intro-slide-keys';

type LocalIntroStackParamList = DeckStackParamList & LocalRootStackParamList;
type LocalIntroProps = NativeStackScreenProps<LocalIntroStackParamList, 'Intro'>;
type HostedIntroProps = NativeStackScreenProps<HostedDeckStackParamList, 'Intro'>;
type IntroCarouselContentProps = Readonly<{
  onComplete: () => Promise<void>;
}>;

export { getIntroSlideKeys } from './intro-slide-keys';

type Slide = {
  key: string;
  type: 'language' | 'benefit';
  titleKey: string;
  descriptionKey?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  accent?: string;
  personas?: Array<{
    audienceKey: string;
    benefitKey: string;
  }>;
};

const SCREEN_HORIZONTAL_PADDING = 20;

const SLIDE_KEYS = {
  language: {
    key: 'language',
    titleKey: 'mobile.intro.languageTitle',
    descriptionKey: 'mobile.intro.languageSubtitle',
  },
  create: {
    key: 'create',
    titleKey: 'mobile.intro.slides.create.title',
    descriptionKey: 'mobile.intro.slides.create.description',
    icon: 'sparkles-outline' as const,
  },
  recall: {
    key: 'recall',
    titleKey: 'mobile.intro.slides.recall.title',
    descriptionKey: 'mobile.intro.slides.recall.description',
    icon: 'timer-outline' as const,
  },
  sync: {
    key: 'sync',
    titleKey: 'mobile.intro.slides.sync.title',
    descriptionKey: 'mobile.intro.slides.sync.description',
    icon: 'cloud-done-outline' as const,
  },
};

export default function IntroCarouselScreen(props: Readonly<LocalIntroProps>) {
  const setIntroSeen = useStore((state) => state.setIntroSeen);
  const navigation = props.navigation;
  const handleComplete = useCallback(async () => {
    await setIntroSeen(true);
    navigation.replace('LocalTabs', {
      screen: 'DecksTab',
      params: { screen: 'DeckList' },
    });
  }, [navigation, setIntroSeen]);

  return <IntroCarouselContent onComplete={handleComplete} />;
}

export function HostedIntroCarouselScreen(props: Readonly<HostedIntroProps>) {
  const setIntroSeen = useStore((state) => state.setIntroSeen);
  const navigation = props.navigation;
  const handleComplete = useCallback(async () => {
    await setIntroSeen(true);
    navigation.replace('Auth', {});
  }, [navigation, setIntroSeen]);

  return <IntroCarouselContent onComplete={handleComplete} />;
}

function IntroCarouselContent(props: IntroCarouselContentProps) {
  const { t } = useTranslation();
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide> | null>(null);

  const containerStyle = useMemo(
    () =>
      StyleSheet.compose(styles.container, {
        backgroundColor: colors.background,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 16,
      }),
    [colors.background, insets.bottom, insets.top],
  );
  const textStyle = useMemo(() => ({ color: colors.text }), [colors.text]);
  const mutedTextStyle = useMemo(() => ({ color: colors.muted }), [colors.muted]);
  const primaryTextStyle = useMemo(() => ({ color: colors.primary }), [colors.primary]);
  const slideWidth = useMemo(() => Math.max(width - SCREEN_HORIZONTAL_PADDING * 2, 1), [width]);
  const slideStyle = useMemo(() => StyleSheet.compose(styles.slide, { width: slideWidth }), [slideWidth]);
  const slideTitleStyle = useMemo(() => StyleSheet.compose(styles.slideTitle, textStyle), [textStyle]);
  const slideSubtitleStyle = useMemo(() => StyleSheet.compose(styles.slideSubtitle, mutedTextStyle), [mutedTextStyle]);
  const languageLabelStyle = useMemo(() => StyleSheet.compose(styles.languageLabel, textStyle), [textStyle]);
  const personaAudienceStyle = useMemo(() => StyleSheet.compose(styles.personaAudience, textStyle), [textStyle]);
  const personaBenefitStyle = useMemo(() => StyleSheet.compose(styles.personaBenefit, mutedTextStyle), [mutedTextStyle]);
  const kickerStyle = useMemo(() => StyleSheet.compose(styles.kicker, primaryTextStyle), [primaryTextStyle]);
  const titleStyle = useMemo(() => StyleSheet.compose(styles.title, textStyle), [textStyle]);
  const subtitleStyle = useMemo(() => StyleSheet.compose(styles.subtitle, mutedTextStyle), [mutedTextStyle]);
  const secondaryButtonStyle = useMemo(
    () => StyleSheet.compose(styles.secondaryButton, { borderColor: colors.border }),
    [colors.border],
  );
  const secondaryButtonTextStyle = useMemo(
    () => StyleSheet.compose(styles.secondaryButtonText, mutedTextStyle),
    [mutedTextStyle],
  );
  const primaryButtonStyle = useMemo(
    () => StyleSheet.compose(styles.primaryButton, { backgroundColor: colors.primary }),
    [colors.primary],
  );
  const languageRowStyle = useMemo(
    () =>
      StyleSheet.compose(styles.languageRow, {
        borderColor: colors.border,
        backgroundColor: colors.card,
      }),
    [colors.border, colors.card],
  );
  const languageRowSelectedStyle = useMemo(
    () =>
      StyleSheet.compose(styles.languageRow, {
        borderColor: colors.border,
        backgroundColor: withAlpha(colors.primary, 0.12),
      }),
    [colors.border, colors.primary],
  );
  const personaCardStyle = useMemo(
    () =>
      StyleSheet.compose(styles.personaCard, {
        borderColor: colors.border,
        backgroundColor: colors.card,
      }),
    [colors.border, colors.card],
  );

  const slides = useMemo<Slide[]>(
    () => {
      const enabledSlideKeys = getIntroSlideKeys(APP_CAPABILITIES.sync);
      const slides: Slide[] = [
      {
        key: SLIDE_KEYS.language.key,
        type: 'language',
        titleKey: SLIDE_KEYS.language.titleKey,
        descriptionKey: SLIDE_KEYS.language.descriptionKey,
      },
      {
        key: SLIDE_KEYS.create.key,
        type: 'benefit',
        titleKey: SLIDE_KEYS.create.titleKey,
        descriptionKey: SLIDE_KEYS.create.descriptionKey,
        icon: SLIDE_KEYS.create.icon,
        accent: colors.primary,
        personas: [
          {
            audienceKey: 'mobile.intro.slides.create.personas.students.audience',
            benefitKey: 'mobile.intro.slides.create.personas.students.benefit',
          },
          {
            audienceKey: 'mobile.intro.slides.create.personas.languageLearners.audience',
            benefitKey: 'mobile.intro.slides.create.personas.languageLearners.benefit',
          },
          {
            audienceKey: 'mobile.intro.slides.create.personas.selfLearners.audience',
            benefitKey: 'mobile.intro.slides.create.personas.selfLearners.benefit',
          },
        ],
      },
      {
        key: SLIDE_KEYS.recall.key,
        type: 'benefit',
        titleKey: SLIDE_KEYS.recall.titleKey,
        descriptionKey: SLIDE_KEYS.recall.descriptionKey,
        icon: SLIDE_KEYS.recall.icon,
        accent: colors.accent,
        personas: [
          {
            audienceKey: 'mobile.intro.slides.recall.personas.examPrep.audience',
            benefitKey: 'mobile.intro.slides.recall.personas.examPrep.benefit',
          },
          {
            audienceKey: 'mobile.intro.slides.recall.personas.professionals.audience',
            benefitKey: 'mobile.intro.slides.recall.personas.professionals.benefit',
          },
          {
            audienceKey: 'mobile.intro.slides.recall.personas.teams.audience',
            benefitKey: 'mobile.intro.slides.recall.personas.teams.benefit',
          },
        ],
      },
      {
        key: SLIDE_KEYS.sync.key,
        type: 'benefit',
        titleKey: SLIDE_KEYS.sync.titleKey,
        descriptionKey: SLIDE_KEYS.sync.descriptionKey,
        icon: SLIDE_KEYS.sync.icon,
        accent: colors.text,
        personas: [
          {
            audienceKey: 'mobile.intro.slides.sync.personas.multiDevice.audience',
            benefitKey: 'mobile.intro.slides.sync.personas.multiDevice.benefit',
          },
          {
            audienceKey: 'mobile.intro.slides.sync.personas.busySchedules.audience',
            benefitKey: 'mobile.intro.slides.sync.personas.busySchedules.benefit',
          },
          {
            audienceKey: 'mobile.intro.slides.sync.personas.parents.audience',
            benefitKey: 'mobile.intro.slides.sync.personas.parents.benefit',
          },
        ],
      },
      ];
      return slides.filter((slide) => enabledSlideKeys.includes(slide.key));
    },
    [colors.accent, colors.primary, colors.text],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
      setIndex(nextIndex);
    },
    [slideWidth],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Slide> | null | undefined, itemIndex: number) => ({
      length: slideWidth,
      offset: slideWidth * itemIndex,
      index: itemIndex,
    }),
    [slideWidth],
  );

  const handleComplete = props.onComplete;

  const handleSelectLanguage = useCallback(
    async (code: string) => {
      await setLanguage(code);
    },
    [setLanguage],
  );
  const languagePressHandlers = useMemo(() => {
    const handlers = new Map<string, () => void>();
    supportedLanguages.forEach((lang) => {
      handlers.set(lang.code, () => {
        void handleSelectLanguage(lang.code);
      });
    });
    return handlers;
  }, [handleSelectLanguage]);
  const keyExtractor = useCallback((item: Slide) => item.key, []);
  const getIconBadgeStyle = useCallback(
    (accentColor: string) => StyleSheet.compose(styles.iconBadge, { backgroundColor: withAlpha(accentColor, 0.15) }),
    [],
  );
  const getPersonaDotStyle = useCallback(
    (accentColor: string) => StyleSheet.compose(styles.personaDot, { backgroundColor: withAlpha(accentColor, 0.35) }),
    [],
  );
  const getPaginationDotStyle = useCallback(
    (active: boolean) =>
      StyleSheet.compose(styles.dot, {
        backgroundColor: active ? colors.primary : colors.border,
        width: active ? 20 : 8,
      }),
    [colors.border, colors.primary],
  );
  const isLastSlide = index >= slides.length - 1;

  const renderSlide = useCallback(
    (info: ListRenderItemInfo<Slide>) => {
      const slide = info.item;
      const description = slide.descriptionKey ? t(slide.descriptionKey) : '';
      const accentColor = slide.accent ?? colors.primary;

      if (slide.type === 'language') {
        return (
          <View style={slideStyle}>
            <Text style={slideTitleStyle}>
              {t(slide.titleKey)}
            </Text>
            <Text style={slideSubtitleStyle}>
              {description}
            </Text>
            <View style={styles.languageList}>
              {supportedLanguages.map((lang) => {
                const isSelected = lang.code === language;
                const onPress = languagePressHandlers.get(lang.code);
                return (
                  <Pressable
                    key={lang.code}
                    style={isSelected ? languageRowSelectedStyle : languageRowStyle}
                    onPress={onPress}
                  >
                    <Text style={languageLabelStyle}>{t(lang.labelKey)}</Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      }

      return (
        <View style={slideStyle}>
          <View style={getIconBadgeStyle(accentColor)}>
            <Ionicons name={slide.icon ?? 'sparkles-outline'} size={28} color={accentColor} />
          </View>
          <Text style={slideTitleStyle}>
            {t(slide.titleKey)}
          </Text>
          <Text style={slideSubtitleStyle}>
            {description}
          </Text>
          <View style={styles.personaList}>
            {slide.personas?.map((persona) => (
              <View
                key={persona.audienceKey}
                style={personaCardStyle}
              >
                <View style={getPersonaDotStyle(accentColor)} />
                <View style={styles.personaText}>
                  <Text style={personaAudienceStyle}>
                    {t(persona.audienceKey)}
                  </Text>
                  <Text style={personaBenefitStyle}>
                    {t(persona.benefitKey)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    },
    [
      colors.primary,
      getIconBadgeStyle,
      getPersonaDotStyle,
      language,
      languageLabelStyle,
      languagePressHandlers,
      languageRowSelectedStyle,
      languageRowStyle,
      personaAudienceStyle,
      personaBenefitStyle,
      personaCardStyle,
      slideStyle,
      slideSubtitleStyle,
      slideTitleStyle,
      t,
    ],
  );
  const handlePrimaryAction = useCallback(() => {
    if (isLastSlide) {
      void handleComplete();
      return;
    }

    const nextIndex = Math.min(index + 1, slides.length - 1);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setIndex(nextIndex);
  }, [handleComplete, index, isLastSlide, slides.length]);

  return (
    <View style={containerStyle}>
      <View style={styles.header}>
        <Text style={kickerStyle}>{t('brand.name')}</Text>
        <Text style={titleStyle}>{t('mobile.intro.title')}</Text>
        <Text style={subtitleStyle}>{t('mobile.intro.subtitle')}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        renderItem={renderSlide}
        getItemLayout={getItemLayout}
        initialNumToRender={1}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      />

      <View style={styles.pagination}>
        {slides.map((slideItem, slideIndex) => (
          <View
            key={`intro-dot-${slideItem.key}`}
            style={getPaginationDotStyle(slideIndex === index)}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={secondaryButtonStyle}
          onPress={handleComplete}
        >
          <Text style={secondaryButtonTextStyle}>{t('mobile.intro.skip')}</Text>
        </Pressable>
        <Pressable
          style={primaryButtonStyle}
          onPress={handlePrimaryAction}
        >
          <Text style={styles.primaryButtonText}>
            {isLastSlide ? t('mobile.intro.getStarted') : t('common.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const alphaHex = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${alphaHex}`;
  }
  return color;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  kicker: {
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  slide: {
    paddingVertical: 24,
    paddingRight: 16,
    gap: 12,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  slideSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageList: {
    marginTop: 12,
    gap: 10,
  },
  languageRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  personaList: {
    gap: 10,
    marginTop: 6,
  },
  personaCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  personaDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },
  personaText: {
    flex: 1,
    gap: 4,
  },
  personaAudience: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  personaBenefit: {
    fontSize: 14,
    lineHeight: 20,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
