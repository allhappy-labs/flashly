import { useCallback, useEffect, useRef, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

type Options = Readonly<{
  storageKey: string;
  dismissAfter?: number;
}>;

export function useSwipeHints(options: Options) {
  const [showSwipeHints, setShowSwipeHints] = useState(true);
  const swipeCountRef = useRef(0);
  const dismissAfter = options.dismissAfter ?? 5;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(options.storageKey).then((stored) => {
      if (!active) return;
      if (stored === "true") setShowSwipeHints(false);
    });
    return () => {
      active = false;
    };
  }, [options.storageKey]);

  const registerSwipe = useCallback(() => {
    if (!showSwipeHints) return;
    swipeCountRef.current += 1;
    if (swipeCountRef.current < dismissAfter) return;
    setShowSwipeHints(false);
    void AsyncStorage.setItem(options.storageKey, "true");
  }, [dismissAfter, options.storageKey, showSwipeHints]);

  return { showSwipeHints, registerSwipe };
}
