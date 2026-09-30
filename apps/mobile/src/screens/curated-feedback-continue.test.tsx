import { describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { Animated } from 'react-native';
import { createInstance } from 'i18next';
import { LearnModeSessionView } from './learn-mode/LearnModeSessionView';
import { LearnModeCompletionView } from './learn-mode/LearnModeCompletionView';
import { TestModeQuestionView } from './test-mode/TestModeQuestionView';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
  };
});
vi.mock('react-native', () => ({
  Animated: {
    Value: class {
      interpolate() {
        return 0;
      }
    },
    createAnimatedComponent: (component: string) => component,
    View: 'Animated.View',
  },
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: 'Ionicons' }));
vi.mock('../components/AnswerOptionList', () => ({ default: 'AnswerOptionList' }));
vi.mock('../components/AudioProgressButton', () => ({ default: 'AudioProgressButton' }));
vi.mock('../components/FeedbackTextInput', () => ({ default: 'FeedbackTextInput' }));
vi.mock('../components/MarkdownText', () => ({ default: 'MarkdownText' }));
vi.mock('../components/ProgressBar', () => ({ default: 'ProgressBar' }));
vi.mock('../services/audioPlayer', () => ({ toggleAudioPlayback: vi.fn() }));

const colors = {
  background: '#fff', card: '#fff', text: '#111', muted: '#666', primary: '#00f', primarySoft: '#eef', secondary: '#eee',
  border: '#ddd', accent: '#0af', danger: '#f00',
};
const translation = createInstance();
void translation.init({
  resources: { eng: { translation: { learn: { continue: 'learn.continue' } } } },
  lng: 'eng',
  initAsync: false,
});

function hasChildren(node: ReactNode): node is ReactElement<{ children?: ReactNode }> {
  return isValidElement(node);
}

function isContinueButton(node: ReactNode): node is ReactElement<{ onPress: () => void; children?: ReactNode }> {
  return (
    hasChildren(node) &&
    node.type === 'TouchableOpacity' &&
    hasChildren(node.props.children) &&
    node.props.children.props.children === 'learn.continue'
  );
}

function findContinueButton(node: ReactNode): ReactElement<{ onPress: () => void; children?: ReactNode }> | undefined {
  if (!hasChildren(node)) {
    return undefined;
  }
  const element = node;
  if (isContinueButton(element)) {
    return element;
  }
  const children = element.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const button = findContinueButton(child);
      if (button) {
        return button;
      }
    }
    return undefined;
  }
  return findContinueButton(children);
}

function findContinueLabel(node: ReactNode): ReactElement<{ style?: unknown; children?: ReactNode }> | undefined {
  if (!hasChildren(node)) {
    return undefined;
  }
  const element = node;
  if (element.type === 'Text' && element.props.children === 'learn.continue') {
    return element;
  }
  const children = element.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const label = findContinueLabel(child);
      if (label) {
        return label;
      }
    }
    return undefined;
  }
  return findContinueLabel(children);
}

function isStyleObject(value: unknown): value is { height?: unknown; paddingVertical?: unknown } {
  return typeof value === 'object' && value !== null;
}

describe('curated feedback continuation', () => {
  it('keeps the completion Continue label free of independent vertical sizing', () => {
    const element = LearnModeCompletionView({
      colors,
      t: translation.t,
      totalCount: 12,
      correctCount: 11,
      startTime: Date.now() - 60_000,
      onBackToDeck: vi.fn(),
      onRestart: vi.fn(),
    });

    const continueLabel = findContinueLabel(element);
    expect(continueLabel).toBeDefined();
    expect(isStyleObject(continueLabel?.props.style)).toBe(true);
    if (isStyleObject(continueLabel?.props.style)) {
      expect(continueLabel.props.style.height).toBeUndefined();
      expect(continueLabel.props.style.paddingVertical).toBeUndefined();
    }
  });

  it('shows an explicit Learn continue action for correct curated feedback and invokes it', () => {
    const onContinue = vi.fn();
    const element = LearnModeSessionView({
      colors,
      t: translation.t,
      currentCard: {
        id: 'card-1', deckId: 'deck-1', front: 'Vater', back: 'father', createdAt: 1, updatedAt: 1, due: 1,
        stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 'new',
      },
      question: {
        prompt: 'Which article?', answer: 'der', directionLabel: 'definition', type: 'multiple_choice',
        scheduledType: 'multiple_choice', answerSide: 'back', options: ['der', 'die'], explanation: 'Vater is masculine.', source: 'curated',
      },
      progressCounts: { notStudied: 1, learning: 0, mastered: 0, total: 1 },
      typedAnswer: '', setTypedAnswer: vi.fn(), selectedOption: 'der', feedback: 'correct', submitOption: vi.fn(),
      onToggleStar: vi.fn(), onOverrideCorrect: vi.fn(), onContinue, onDontKnow: vi.fn(), onSubmit: vi.fn(),
      showRetype: false, showOverrideCorrect: false, showImmediateContinue: true, continueAnim: new Animated.Value(1),
      retypeAnswer: '', setRetypeAnswer: vi.fn(), retypeBorderColor: '#ddd',
    });

    const continueButton = findContinueButton(element);
    expect(continueButton).toBeDefined();
    continueButton?.props.onPress();
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows an explicit Test continue action for correct curated feedback and invokes it', () => {
    const onContinue = vi.fn();
    const element = TestModeQuestionView({
      colors,
      t: translation.t,
      question: {
        id: 'question-1', cardId: 'card-1', type: 'mcq', prompt: 'Which article?', correctAnswer: 'der', isStarred: false,
        options: ['der', 'die'], explanation: 'Vater is masculine.', source: 'curated', isCorrect: true,
      },
      progress: 0.5, index: 0, totalQuestions: 2, answered: true, feedback: 'correct', selectedOption: 'der', typedAnswer: '',
      setTypedAnswer: vi.fn(), onSelectOption: vi.fn(), onToggleStar: vi.fn(), onOverrideCorrect: vi.fn(),
      onDontKnow: vi.fn(), onSubmit: vi.fn(), onContinue, continueAnim: new Animated.Value(1), showImmediateContinue: true,
    });

    const continueButton = findContinueButton(element);
    expect(continueButton).toBeDefined();
    continueButton?.props.onPress();
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
