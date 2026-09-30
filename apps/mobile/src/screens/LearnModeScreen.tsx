import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    completeStudySession,
    createStudySession,
    getLearnProgressCounts,
    listLearnCards,
    logStudyResult,
    recordLearnAnswer,
    setCardStarred,
} from '../db/deckRepositorySafe';
import type { DeckStackParamList } from '../navigation/types';
import { usePalette } from '../theme';
import type { Card } from '../types/models';
import type { LearnQuestionType } from '../types/learn';
import { isAnswerCorrect } from '../utils/learn';
import { Rating } from 'ts-fsrs';
import { useStore } from '../store/useStore';
import { useAnswerController } from '../hooks/useAnswerController';
import { useAnswerProgression } from '../hooks/useAnswerProgression';
import { stopAudioPlayback } from '../services/audioPlayer';
import { logger } from '../utils/logger';
import {
    buildInitialLearnQueue,
    buildLearnQuestion,
    advanceLearnQueue,
    consumeScheduledLearnQuestionType,
    getLearnAnswerPool,
    pickLearnQuestionType,
    seedPendingLearnQuestionTypes,
    type LearnQuestion,
} from './learn-mode/learn-mode-utils';
import { LearnModeCompletionView } from './learn-mode/LearnModeCompletionView';
import { LearnModeSessionView } from './learn-mode/LearnModeSessionView';

type Props = NativeStackScreenProps<DeckStackParamList, 'Learn'>;

export default function LearnModeScreen({ route, navigation }: Props) {
    const { deckId, options } = route.params;
    const { t } = useTranslation();
    const colors = usePalette();
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<Card[]>([]);
    const [, setQueue] = useState<string[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [questionAttempt, setQuestionAttempt] = useState(0);
    const [question, setQuestion] = useState<LearnQuestion | null>(null);
    const [retypeAnswer, setRetypeAnswer] = useState('');
    const [retypeErrorCount, setRetypeErrorCount] = useState(0);
    const [progressCounts, setProgressCounts] = useState({ notStudied: 0, learning: 0, mastered: 0, total: 0 });
    const [correctCount, setCorrectCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [finished, setFinished] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const cardsRef = useRef<Card[]>([]);
    const seenRef = useRef(new Set<string>());
    const missedRef = useRef(new Set<string>());
    const correctedRef = useRef(new Set<string>());
    const pendingMasteryRef = useRef(new Set<string>());
    const pendingTypesRef = useRef(new Map<string, LearnQuestionType[]>());
    const sessionIdRef = useRef<string | null>(null);
    const sessionEndedRef = useRef(false);
    const recordedRef = useRef(false);
    const retypeBlink = useRef(new Animated.Value(0)).current;
    const recordStudy = useStore((state) => state.recordStudy);
    const userId = useStore((state) => state.userId);

    const cardMap = useMemo(() => {
        const map = new Map<string, Card>();
        cards.forEach((card) => map.set(card.id, card));
        return map;
    }, [cards]);

    const currentCard = currentId ? (cardMap.get(currentId) ?? null) : null;

    useEffect(() => {
        void stopAudioPlayback();
        return () => {
            void stopAudioPlayback();
        };
    }, [currentId]);

    const {
        typedAnswer,
        setTypedAnswer,
        selectedOption,
        feedback,
        submitOption,
        submitWritten,
        dontKnow,
        markCorrect,
        reset: resetAnswer,
    } = useAnswerController({
        correctAnswer: question?.answer ?? '',
        grading: options.grading,
        resetKey: currentId ?? null,
    });

    const refreshProgress = useCallback(async () => {
        const result = await getLearnProgressCounts(deckId);
        if (result.isErr()) {
            logger.error('Failed to get learn progress counts:', result.error.message);
            return;
        }
        setProgressCounts(result.value);
    }, [deckId]);

    const finalizeSession = useCallback(async () => {
        if (!sessionIdRef.current || sessionEndedRef.current) return;
        const result = await completeStudySession(sessionIdRef.current, userId);
        if (result.isErr()) {
            logger.error('Failed to complete study session:', result.error.message);
        }
        sessionEndedRef.current = true;
        sessionIdRef.current = null;
    }, [userId]);

    const buildInitialQueue = useCallback(
        (list: Card[]) => {
            return buildInitialLearnQueue(list, options.familiarity);
        },
        [options.familiarity],
    );

    const loadCards = useCallback(async () => {
        setLoading(true);
        await finalizeSession();
        const listResult = await listLearnCards(deckId, { scope: options.scope, starredOnly: options.starredOnly });
        if (listResult.isErr()) {
            logger.error('Failed to list learn cards:', listResult.error.message);
            setLoading(false);
            return;
        }
        const list = listResult.value;
        cardsRef.current = list;
        const nextQueue = buildInitialQueue(list);
        setCards(list);
        setQueue(nextQueue);
        setCurrentId(nextQueue[0] ?? null);
        setQuestionAttempt((attempt) => attempt + 1);
        setQuestion(null);
        resetAnswer();
        setRetypeAnswer('');
        setCorrectCount(0);
        setTotalCount(0);
        setFinished(false);
        seenRef.current = new Set();
        missedRef.current = new Set();
        correctedRef.current = new Set();
        pendingMasteryRef.current = new Set(list.map((card) => card.id));
        pendingTypesRef.current = seedPendingLearnQuestionTypes(list, options.questionTypes);
        if (list.length) {
            const sessionResult = await createStudySession(deckId);
            if (sessionResult.isErr()) {
                logger.error('Failed to create study session:', sessionResult.error.message);
                sessionIdRef.current = null;
                sessionEndedRef.current = true;
                setLoading(false);
                return;
            }
            const id = sessionResult.value;
            sessionIdRef.current = id;
            sessionEndedRef.current = false;
        } else {
            sessionIdRef.current = null;
            sessionEndedRef.current = true;
        }
        recordedRef.current = false;
        setStartTime(Date.now());
        await refreshProgress();
        setLoading(false);
    }, [buildInitialQueue, deckId, finalizeSession, options.scope, options.starredOnly, refreshProgress, resetAnswer]);

    useEffect(() => {
        navigation.setOptions({ title: t('learn.title', { defaultValue: 'Learn' }) });
        loadCards();
    }, [loadCards, navigation, t]);

    useEffect(() => {
        if (!currentId) return;
        const nextCard = cardsRef.current.find((card) => card.id === currentId);
        if (!nextCard) return;
        const pendingTypes = pendingTypesRef.current.get(nextCard.id);
        const type = pendingTypes && pendingTypes.length ? pendingTypes[0] : pickLearnQuestionType(options);
        const preferTerm = options.formatPreset === 'Mixed' ? Math.random() > 0.5 : false;
        let next = buildLearnQuestion(nextCard, options, type, preferTerm);
        if (type === 'multiple_choice') {
            const others = getLearnAnswerPool(cardsRef.current, nextCard.id, next.answerSide);
            next = buildLearnQuestion(nextCard, options, type, preferTerm, others);
        }
        setQuestion(next);
        resetAnswer();
        setRetypeAnswer('');
        setRetypeErrorCount(0);
        retypeBlink.setValue(0);
    }, [currentId, options, questionAttempt, resetAnswer]);

    const handleToggleStar = useCallback(async () => {
        if (!currentCard) return;
        const nextStarred = !currentCard.isStarred;
        const result = await setCardStarred(currentCard.id, nextStarred);
        if (result.isErr()) {
            logger.error('Failed to set card starred:', result.error.message);
            return;
        }
        setCards((prev) => {
            const next = prev.map((card) => (card.id === currentCard.id ? { ...card, isStarred: nextStarred } : card));
            cardsRef.current = next;
            return next;
        });
    }, [currentCard]);

    const handleDontKnow = () => {
        if (!currentCard || !question || feedback) return;
        dontKnow();
    };

    const advanceQueue = useCallback(
        (shouldRepeat: boolean) => {
            setQueue((prev) => {
                const next = advanceLearnQueue({
                    queue: prev,
                    currentId,
                    shouldRepeat,
                    questionAttempt,
                });
                setCurrentId(next.currentId);
                setQuestionAttempt(next.questionAttempt);
                return next.queue;
            });
        },
        [currentId, questionAttempt],
    );

    const applyAnswer = useCallback(
        async (isCorrect: boolean) => {
            if (!currentCard || !question) return;
            const logResult = await logStudyResult({
                card: currentCard,
                deckId,
                rating: isCorrect ? Rating.Good : Rating.Again,
                sessionId: sessionIdRef.current,
                userId,
            });
            if (logResult.isErr()) {
                logger.error('Failed to log study result:', logResult.error.message);
                return;
            }
            const masteryStreak = options.goal === 'cram' ? 1 : 2;
            const updatedResult = await recordLearnAnswer({
                cardId: currentCard.id,
                deckId,
                correct: isCorrect,
                masteryStreak,
                userId,
            });
            if (updatedResult.isErr()) {
                logger.error('Failed to record learn answer:', updatedResult.error.message);
                return;
            }
            const updated = updatedResult.value;
            if (updated) {
                setCards((prev) => {
                    const next = prev.map((card) => (card.id === updated.id ? updated : card));
                    cardsRef.current = next;
                    return next;
                });
            }
            await refreshProgress();

            seenRef.current.add(currentCard.id);
            if (!isCorrect) missedRef.current.add(currentCard.id);
            if (isCorrect && missedRef.current.has(currentCard.id)) correctedRef.current.add(currentCard.id);

            if (options.goal === 'memorize') {
                if (updated?.learnState === 'mastered') pendingMasteryRef.current.delete(currentCard.id);
            }

            if (isCorrect) {
                const pending = pendingTypesRef.current.get(currentCard.id);
                if (pending) {
                    const remaining = consumeScheduledLearnQuestionType(pending, question.scheduledType);
                    if (remaining.length) {
                        pendingTypesRef.current.set(currentCard.id, remaining);
                    } else {
                        pendingTypesRef.current.delete(currentCard.id);
                    }
                }
            }

            const completeCram =
                options.goal === 'cram' &&
                seenRef.current.size >= cards.length &&
                missedRef.current.size === correctedRef.current.size &&
                pendingTypesRef.current.size === 0;
            const completeMemorize =
                options.goal === 'memorize' &&
                pendingMasteryRef.current.size === 0 &&
                pendingTypesRef.current.size === 0;

            if (completeCram || completeMemorize) {
                setFinished(true);
                return;
            }

            const shouldRepeatForTypes = pendingTypesRef.current.has(currentCard.id);
            const shouldRepeatForGoal = options.goal === 'memorize' ? updated?.learnState !== 'mastered' : !isCorrect;
            const shouldRepeat = shouldRepeatForTypes || shouldRepeatForGoal;
            advanceQueue(Boolean(shouldRepeat));
        },
        [advanceQueue, cards.length, currentCard, deckId, options.goal, question, refreshProgress, userId],
    );

    const handleContinue = async () => {
        if (!currentCard || !question || !feedback) return;
        if (
            feedback === 'incorrect' &&
            options.retypeAfterMiss &&
            question.type === 'written' &&
            !isAnswerCorrect(retypeAnswer, question.answer, 'strict')
        ) {
            setRetypeErrorCount((count) => {
                const next = count + 1;
                if (next >= 2) {
                    retypeBlink.setValue(0);
                    Animated.sequence([
                        Animated.timing(retypeBlink, { toValue: 1, duration: 120, useNativeDriver: false }),
                        Animated.timing(retypeBlink, { toValue: 0, duration: 120, useNativeDriver: false }),
                        Animated.timing(retypeBlink, { toValue: 1, duration: 120, useNativeDriver: false }),
                        Animated.timing(retypeBlink, { toValue: 0, duration: 120, useNativeDriver: false }),
                    ]).start();
                }
                return next;
            });
            return;
        }
        const isCorrect = feedback === 'correct';
        setTotalCount((count) => count + 1);
        if (isCorrect) setCorrectCount((count) => count + 1);
        await applyAnswer(isCorrect);
    };

    const handleSubmit = async () => {
        submitWritten();
    };

    const handleRestart = () => {
        loadCards();
    };

    useEffect(() => {
        if (!finished || recordedRef.current || totalCount <= 0) return;
        recordedRef.current = true;
        void recordStudy(deckId);
    }, [deckId, finished, recordStudy, totalCount]);

    useEffect(() => {
        if (!finished) return;
        void finalizeSession();
    }, [finalizeSession, finished]);

    useEffect(() => {
        const sub = navigation.addListener('beforeRemove', async () => {
            if (totalCount > 0 && !recordedRef.current) {
                await recordStudy(deckId);
                recordedRef.current = true;
            }
            await finalizeSession();
        });
        return sub;
    }, [deckId, finalizeSession, navigation, recordStudy, totalCount]);

    useEffect(() => {
        return () => {
            void finalizeSession();
        };
    }, [finalizeSession]);

    const handleOverrideCorrect = async () => {
        if (!currentCard || !question || !showOverrideCorrect) return;
        markCorrect();
        setTotalCount((count) => count + 1);
        setCorrectCount((count) => count + 1);
        await applyAnswer(true);
    };

    const showRetype = feedback === 'incorrect' && options.retypeAfterMiss && question?.type === 'written';
    const showImmediateContinue =
        (feedback === 'incorrect' && question?.type === 'written') ||
        (feedback !== null && question?.source === 'curated' && Boolean(question.explanation));
    const showOverrideCorrect = feedback === 'incorrect' && question?.type === 'written';
    const retypeBorderColor =
        retypeErrorCount > 0
            ? retypeBlink.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.danger, colors.border],
              })
            : colors.border;

    useEffect(() => {
        if (!showRetype) {
            setRetypeErrorCount(0);
            retypeBlink.setValue(0);
            return;
        }
        if (question && retypeAnswer.trim() && isAnswerCorrect(retypeAnswer, question.answer, 'strict')) {
            setRetypeErrorCount(0);
            retypeBlink.setValue(0);
        }
    }, [question, retypeAnswer, retypeBlink, showRetype]);

    const { continueAnim } = useAnswerProgression({
        feedback,
        showImmediateContinue,
        onContinue: handleContinue,
    });

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator />
            </View>
        );
    }

    if (!cards.length) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.text }}>{t('learn.empty', { defaultValue: 'No cards to study.' })}</Text>
            </View>
        );
    }

    if (finished) {
        return (
            <LearnModeCompletionView
                colors={colors}
                t={t}
                totalCount={totalCount}
                correctCount={correctCount}
                startTime={startTime}
                onBackToDeck={() => navigation.goBack()}
                onRestart={handleRestart}
            />
        );
    }

    if (!currentCard || !question) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <LearnModeSessionView
            colors={colors}
            t={t}
            currentCard={currentCard}
            question={question}
            progressCounts={progressCounts}
            typedAnswer={typedAnswer}
            setTypedAnswer={setTypedAnswer}
            selectedOption={selectedOption}
            feedback={feedback}
            submitOption={submitOption}
            onToggleStar={handleToggleStar}
            onOverrideCorrect={handleOverrideCorrect}
            onContinue={handleContinue}
            onDontKnow={handleDontKnow}
            onSubmit={handleSubmit}
            showRetype={showRetype}
            showOverrideCorrect={showOverrideCorrect}
            showImmediateContinue={showImmediateContinue}
            continueAnim={continueAnim}
            retypeAnswer={retypeAnswer}
            setRetypeAnswer={setRetypeAnswer}
            retypeBorderColor={retypeBorderColor}
        />
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
