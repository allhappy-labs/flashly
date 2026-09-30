import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

type FeedbackState = "correct" | "incorrect" | null;

type Options = {
  feedback: FeedbackState;
  showImmediateContinue: boolean;
  onContinue: () => void;
};

export function useAnswerProgression({ feedback, showImmediateContinue, onContinue }: Options) {
  const continueAnim = useRef(new Animated.Value(0)).current;
  const continueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (continueTimerRef.current) {
      clearTimeout(continueTimerRef.current);
      continueTimerRef.current = null;
    }
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    continueAnim.setValue(0);

    if (feedback === "correct" && !showImmediateContinue) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        onContinue();
      }, 1000);
    } else if (feedback === "incorrect") {
      if (showImmediateContinue) {
        continueAnim.setValue(1);
      } else {
        continueTimerRef.current = setTimeout(() => {
          Animated.timing(continueAnim, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }, 1000);
      }
    }

    return () => {
      if (continueTimerRef.current) {
        clearTimeout(continueTimerRef.current);
        continueTimerRef.current = null;
      }
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [continueAnim, feedback, onContinue, showImmediateContinue]);

  return { continueAnim };
}
