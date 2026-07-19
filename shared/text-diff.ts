export type DiffPart = { type: "same" | "add" | "del"; text: string };

/** Simple word-level diff for amendment debate / voting. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.length ? before.split(/(\s+)/) : [];
  const b = after.length ? after.split(/(\s+)/) : [];
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j]
          ? (dp[i + 1]![j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(parts, "same", a[i]!);
      i++;
      j++;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      push(parts, "del", a[i]!);
      i++;
    } else {
      push(parts, "add", b[j]!);
      j++;
    }
  }
  while (i < n) {
    push(parts, "del", a[i]!);
    i++;
  }
  while (j < m) {
    push(parts, "add", b[j]!);
    j++;
  }
  return parts;
}

function push(parts: DiffPart[], type: DiffPart["type"], text: string): void {
  const last = parts[parts.length - 1];
  if (last && last.type === type) {
    last.text += text;
  } else {
    parts.push({ type, text });
  }
}
