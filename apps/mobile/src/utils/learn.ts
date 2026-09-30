export function normalizeAnswer(value: string) {
  const stripped = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return stripped.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function levenshtein(a: string, b: string) {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const dp = Array.from({ length: aLen + 1 }, () => Array.from({ length: bLen + 1 }, () => 0));
  for (let i = 0; i <= aLen; i += 1) dp[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) dp[0][j] = j;
  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[aLen][bLen];
}

export function isAnswerCorrect(answer: string, expected: string, mode: "strict" | "smart") {
  const user = normalizeAnswer(answer);
  const target = normalizeAnswer(expected);
  if (!user || !target) return false;
  if (user === target) return true;
  if (mode === "strict") return false;
  if (user.length <= 4 || target.length <= 4) return false;
  const distance = levenshtein(user, target);
  return distance <= 1;
}

export function maskExample(example: string, term: string) {
  if (!example.trim() || !term.trim()) return example;
  const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
  return example.replace(pattern, "_____");
}
