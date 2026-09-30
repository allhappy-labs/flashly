import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react', () => ({
  useEffect: (effect: () => void) => effect(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

vi.mock('react-native', () => ({
  Animated: {
    Value: class {
      setValue() {}
    },
    timing: () => ({ start: () => {} }),
  },
  Easing: {
    cubic: 'cubic',
    out: (value: string) => value,
  },
}));

import { useAnswerProgression } from './useAnswerProgression';

describe('useAnswerProgression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not auto-advance correct feedback that requires an immediate continue', () => {
    const onContinue = vi.fn();

    useAnswerProgression({
      feedback: 'correct',
      showImmediateContinue: true,
      onContinue,
    });
    vi.advanceTimersByTime(1_000);

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('keeps generic correct feedback on the existing auto-advance path', () => {
    const onContinue = vi.fn();

    useAnswerProgression({
      feedback: 'correct',
      showImmediateContinue: false,
      onContinue,
    });
    vi.advanceTimersByTime(1_000);

    expect(onContinue).toHaveBeenCalledOnce();
  });
});
