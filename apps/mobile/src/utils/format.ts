import i18n from "../i18n";

export function formatRelative(timestamp?: number | null) {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return i18n.t("relativeTime.today");
  if (diffDays < 7) return i18n.t("relativeTime.daysAgo", { count: diffDays });
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return i18n.t("relativeTime.weeksAgo", { count: diffWeeks });
  const diffMonths = Math.floor(diffDays / 30);
  return i18n.t("relativeTime.monthsAgo", { count: diffMonths });
}
