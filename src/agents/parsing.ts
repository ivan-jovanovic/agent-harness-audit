export function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function extractFirstJsonBlock(raw: string): string | null {
  let start = -1;
  let openChar = "";
  let closeChar = "";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (start === -1 && (ch === "{" || ch === "[")) {
      start = i;
      openChar = ch;
      closeChar = ch === "{" ? "}" : "]";
      depth = 1;
      continue;
    }

    if (start === -1) continue;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
      continue;
    }

    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseJsonWithFallback<T>(raw: string): T | null {
  const direct = tryParseJson<T>(raw);
  if (direct !== null) return direct;

  const block = extractFirstJsonBlock(raw);
  if (!block) return null;

  return tryParseJson<T>(block);
}

