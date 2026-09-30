import { useEffect, useMemo, useState } from "react";

import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";

type Options = Readonly<{
  enabled: boolean;
  cardWidth: number;
  onSwipe: (direction: "left" | "right") => void;
  currentIndex: number;
  totalCards: number;
  enforceBounds?: boolean;
  resetKey?: string | number | null;
}>;

export function useSwipeCardStack(options: Options) {
  const enabled = options.enabled;
  const onSwipe = options.onSwipe;
  const cardWidth = options.cardWidth;
  const currentIndex = options.currentIndex;
  const totalCards = options.totalCards;
  const enforceBounds = options.enforceBounds ?? false;
  const resetKey = options.resetKey;
  const translateX = useSharedValue(0);
  const indexValue = useSharedValue(currentIndex);
  const totalValue = useSharedValue(totalCards);
  const [isAnimating, setIsAnimating] = useState(false);
  const swipeThreshold = cardWidth ? Math.max(90, cardWidth * 0.25) : 90;
  const maxTranslate = cardWidth ? cardWidth + 80 : 420;

  useEffect(() => {
    translateX.value = 0;
    setIsAnimating(false);
  }, [resetKey, translateX]);

  useEffect(() => {
    indexValue.value = currentIndex;
    totalValue.value = totalCards;
  }, [currentIndex, indexValue, totalCards, totalValue]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          translateX.value = event.translationX;
        })
        .onEnd(() => {
          if (Math.abs(translateX.value) > swipeThreshold) {
            const direction = translateX.value > 0 ? "right" : "left";
            const allowed = enforceBounds
              ? direction === "left"
                ? indexValue.value < Math.max(0, totalValue.value - 1)
                : indexValue.value > 0
              : true;
            if (!allowed) {
              translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
              runOnJS(setIsAnimating)(false);
              return;
            }
            runOnJS(setIsAnimating)(true);
            translateX.value = withTiming(
              direction === "right" ? maxTranslate : -maxTranslate,
              { duration: 180 },
              (isFinished) => {
                if (isFinished) {
                  runOnJS(onSwipe)(direction);
                }
              },
            );
          } else {
            translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
            runOnJS(setIsAnimating)(false);
          }
        }),
    [enabled, indexValue, maxTranslate, onSwipe, swipeThreshold, totalValue, translateX],
  );

  const activeCardStyle = useAnimatedStyle(() => {
    const rotation = (translateX.value / Math.max(1, cardWidth)) * 6;
    return {
      transform: [{ translateX: translateX.value }, { rotateZ: `${rotation}deg` }],
    };
  }, [cardWidth]);

  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / Math.max(1, swipeThreshold), 1);
    const scale = 0.96 + progress * 0.04;
    const opacity = 0.7 + progress * 0.3;
    return {
      transform: [{ scale }],
      opacity,
    };
  }, [swipeThreshold]);

  return { gesture, activeCardStyle, nextCardStyle, isAnimating, translateX, swipeThreshold };
}
