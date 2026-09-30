import AsyncStorage from "@react-native-async-storage/async-storage";
import { TIME_GRADING_EMA_KEY_PREFIX } from "../constants";

export async function loadDeckTimeGradingEma(deckId: string) {
  const raw = await AsyncStorage.getItem(`${TIME_GRADING_EMA_KEY_PREFIX}${deckId}`);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function saveDeckTimeGradingEma(deckId: string, emaMs: number) {
  if (!Number.isFinite(emaMs)) return;
  await AsyncStorage.setItem(`${TIME_GRADING_EMA_KEY_PREFIX}${deckId}`, String(Math.round(emaMs)));
}
