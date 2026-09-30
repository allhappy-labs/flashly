type Translator = (key: string, options?: Record<string, unknown>) => string;

export function formatDuration(ms: number, t: Translator) {
  if (!Number.isFinite(ms) || ms <= 0) return t("study.timeSeconds", { seconds: "0" });
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return t("study.timeSeconds", { seconds: String(totalSeconds) });
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  return t("study.timeMinutesSeconds", { minutes, seconds: paddedSeconds });
}

export function formatWaitLabel(due: number, now: number, t: Translator) {
  const deltaMs = due - now;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return t("study.nextReviewNow", { defaultValue: "Now" });
  const minutes = Math.max(1, Math.round(deltaMs / 60000));
  if (minutes < 60) return t("study.nextReviewMinutes", { count: minutes });
  const hours = Math.round(deltaMs / (60 * 60000));
  if (hours < 24) return t("study.nextReviewHours", { count: hours });
  const days = Math.round(deltaMs / (24 * 60 * 60000));
  return t("study.nextReviewDays", { count: Math.max(1, days) });
}
