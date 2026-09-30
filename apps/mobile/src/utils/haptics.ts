import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";

type HapticType = "correct" | "wrong";

let supportsHapticsCache: boolean | null = null;
let supportsHapticsPromise: Promise<boolean> | null = null;

async function getSupportsHaptics() {
  if (Platform.OS !== "ios") return true;
  if (supportsHapticsCache !== null) return supportsHapticsCache;
  if (!supportsHapticsPromise) {
    const isAvailableAsync = (Haptics as { isAvailableAsync?: () => Promise<boolean> }).isAvailableAsync;
    supportsHapticsPromise = (isAvailableAsync ? isAvailableAsync() : Promise.resolve(true))
      .then((value: unknown) => {
        supportsHapticsCache = Boolean(value);
        return supportsHapticsCache;
      })
      .catch(() => {
        supportsHapticsCache = true;
        return supportsHapticsCache;
      });
  }
  return supportsHapticsPromise;
}

export async function triggerHaptic(type: HapticType, enabled: boolean) {
  if (!enabled) return;
  if (Platform.OS === "ios") {
    const supportsHaptics = await getSupportsHaptics();
    if (!supportsHaptics) return;
  }
  if (type === "correct") {
    Vibration.vibrate(10);
    return;
  }
  Vibration.vibrate([0, 20, 30, 20]);
}
