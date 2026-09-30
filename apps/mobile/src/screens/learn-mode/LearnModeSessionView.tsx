import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { TFunction } from 'i18next';
import AnswerOptionList from '../../components/AnswerOptionList';
import AudioProgressButton from '../../components/AudioProgressButton';
import { APP_CAPABILITIES } from '../../config/app-mode';
import FeedbackTextInput from '../../components/FeedbackTextInput';
import { toggleAudioPlayback } from '../../services/audioPlayer';
import type { Palette } from '../../theme';
import type { Card } from '../../types/models';
import { usableMediaUri } from '../../utils/media-policy';
import type { LearnQuestion } from './learn-mode-utils';

type FeedbackState = 'correct' | 'incorrect' | null;

type ProgressCounts = {
  notStudied: number;
  learning: number;
  mastered: number;
  total: number;
};

type Props = {
  colors: Palette;
  t: TFunction;
  currentCard: Card;
  question: LearnQuestion;
  progressCounts: ProgressCounts;
  typedAnswer: string;
  setTypedAnswer: (text: string) => void;
  selectedOption: string | null;
  feedback: FeedbackState;
  submitOption: (option: string) => void;
  onToggleStar: () => void;
  onOverrideCorrect: () => void;
  onContinue: () => void;
  onDontKnow: () => void;
  onSubmit: () => void;
  showRetype: boolean;
  showOverrideCorrect: boolean;
  showImmediateContinue: boolean;
  continueAnim: Animated.Value;
  retypeAnswer: string;
  setRetypeAnswer: (text: string) => void;
  retypeBorderColor: string | Animated.AnimatedInterpolation<string | number>;
};

export function LearnModeSessionView({
  colors,
  t,
  currentCard,
  question,
  progressCounts,
  typedAnswer,
  setTypedAnswer,
  selectedOption,
  feedback,
  submitOption,
  onToggleStar,
  onOverrideCorrect,
  onContinue,
  onDontKnow,
  onSubmit,
  showRetype,
  showOverrideCorrect,
  showImmediateContinue,
  continueAnim,
  retypeAnswer,
  setRetypeAnswer,
  retypeBorderColor,
}: Props) {
  const AnimatedTextInput = useMemo(() => Animated.createAnimatedComponent(TextInput), []);
  const audioUri = usableMediaUri(currentCard.audioUrl, APP_CAPABILITIES.remoteMedia);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.progressRow}>
        {[
          { label: t('learn.notStudied', { defaultValue: 'Not studied' }), value: progressCounts.notStudied },
          {
            label: t('learn.stillLearning', { defaultValue: 'Still learning' }),
            value: progressCounts.learning,
          },
          { label: t('learn.mastered', { defaultValue: 'Mastered' }), value: progressCounts.mastered },
        ].map((stat) => (
          <View key={stat.label} style={[styles.progressChip, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.progressValue, { color: colors.text }]}>{stat.value}</Text>
            <Text style={[styles.progressLabel, { color: colors.muted }]}>{stat.label}</Text>
          </View>
        ))}
        <View style={styles.cardActions}>
          {audioUri ? (
            <AudioProgressButton
              uri={audioUri}
              backgroundColor={colors.card}
              borderColor={colors.border}
              iconColor={colors.primary}
              size={32}
              iconSize={18}
              onPress={() => void toggleAudioPlayback(audioUri)}
            />
          ) : null}
          <TouchableOpacity onPress={onToggleStar} style={styles.starButton}>
            <Ionicons name={currentCard.isStarred ? 'star' : 'star-outline'} size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.questionLabel, { color: colors.muted }]}>
          {question.directionLabel === 'term'
            ? t('learn.answerWithTerm', { defaultValue: 'Answer with term' })
            : question.directionLabel === 'cloze'
              ? t('learn.clozePrompt', { defaultValue: 'Fill in the blank' })
              : t('learn.answerWithDefinition', { defaultValue: 'Answer with definition' })}
        </Text>
        <Text style={[styles.prompt, { color: colors.text }]}>{question.prompt}</Text>
      </View>

      {question.type === 'multiple_choice' ? (
        <AnswerOptionList
          options={question.options ?? []}
          selectedOption={selectedOption}
          correctOption={question.answer}
          showFeedback={Boolean(feedback)}
          disabled={Boolean(feedback)}
          colors={colors}
          onSelect={submitOption}
        />
      ) : (
        <FeedbackTextInput
          style={styles.input}
          placeholder={t('learn.answerPlaceholder', { defaultValue: 'Type your answer' })}
          placeholderTextColor={colors.muted}
          value={typedAnswer}
          onChangeText={setTypedAnswer}
          editable={!feedback}
          feedback={feedback}
          colors={colors}
        />
      )}

      {feedback ? (
        <View style={styles.feedbackBox}>
          {feedback === 'incorrect' && question.type === 'written' ? (
            <Text style={[styles.answerReveal, { color: colors.text }]}>
              {t('learn.correctAnswer', { defaultValue: 'Correct answer:' })} {question.answer}
            </Text>
          ) : null}
          {question.explanation ? (
            <Text style={[styles.explanation, { color: colors.muted }]}>{question.explanation}</Text>
          ) : null}
          {showOverrideCorrect ? (
            <TouchableOpacity style={styles.overrideButton} onPress={onOverrideCorrect}>
              <Text style={[styles.overrideText, { color: colors.muted }]}>
                {t('learn.overrideCorrect', { defaultValue: 'My answer was correct' })}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showRetype ? (
            <AnimatedTextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: retypeBorderColor,
                  marginTop: 12,
                },
              ]}
              placeholder={t('learn.retypePlaceholder', { defaultValue: 'Retype the correct answer' })}
              placeholderTextColor={colors.muted}
              value={retypeAnswer}
              onChangeText={setRetypeAnswer}
            />
          ) : null}
          {feedback === 'incorrect' || (feedback === 'correct' && showImmediateContinue) ? (
            <Animated.View
              style={[
                styles.continueWrap,
                {
                  opacity: showImmediateContinue ? 1 : continueAnim,
                  transform: [
                    {
                      translateY: showImmediateContinue
                        ? 0
                        : continueAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [6, 0],
                          }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: showRetype && !retypeAnswer.trim() ? 0.6 : 1,
                  },
                ]}
                onPress={onContinue}
              >
                <Text style={styles.primaryButtonText}>{t('learn.continue')}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </View>
      ) : question.type === 'written' ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
            onPress={onDontKnow}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {t('learn.dontKnow', { defaultValue: "Don't know" })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={onSubmit}>
            <Text style={styles.primaryButtonText}>{t('learn.submit', { defaultValue: 'Check' })}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  progressChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 2,
  },
  progressValue: { fontSize: 16, fontWeight: '700' },
  progressLabel: { fontSize: 11, fontWeight: '600' },
  cardActions: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  starButton: { padding: 6 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  questionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  prompt: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16, lineHeight: 20, textAlign: 'center' },
  secondaryButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { fontWeight: '700' },
  feedbackBox: { gap: 12 },
  answerReveal: { fontSize: 14, fontWeight: '600' },
  explanation: { fontSize: 14, lineHeight: 20 },
  continueWrap: { width: '100%' },
  overrideButton: { alignSelf: 'flex-start' },
  overrideText: { fontSize: 13, fontWeight: '600' },
});
