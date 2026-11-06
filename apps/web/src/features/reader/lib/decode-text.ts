/** Encoding detection is evidence, not certainty: ambiguous legacy files retain alternatives. */
export const TEXT_ENCODINGS = [
  "auto",
  "utf-8",
  "utf-16le",
  "utf-16be",
  "gb18030",
  "big5",
  "shift_jis",
  "euc-kr",
  "windows-1252",
] as const;
export type TextEncoding = (typeof TEXT_ENCODINGS)[number];
export type TextDecoding = {
  text: string;
  encoding: Exclude<TextEncoding, "auto">;
  confidence: "high" | "low";
  reason:
    | "override"
    | "bom"
    | "utf16-pattern"
    | "declaration"
    | "utf8"
    | "legacy"
    | "fallback";
  candidates: string[];
};
export function normalizeTextEncoding(value: unknown): TextEncoding {
  return typeof value === "string" &&
    (TEXT_ENCODINGS as readonly string[]).includes(value)
    ? (value as TextEncoding)
    : "auto";
}
const BOMS: [number[], Exclude<TextEncoding, "auto">][] = [
  [[239, 187, 191], "utf-8"],
  [[255, 254], "utf-16le"],
  [[254, 255], "utf-16be"],
];
function decode(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, "");
  } catch {
    return null;
  }
}
export function detectTextBook(
  bytes: Uint8Array,
  {
    encoding = "auto",
    html = false,
  }: { encoding?: TextEncoding; html?: boolean } = {},
): TextDecoding {
  const result = (
    text: string,
    selected: Exclude<TextEncoding, "auto">,
    reason: TextDecoding["reason"],
    confidence: TextDecoding["confidence"] = "high",
    candidates: string[] = [selected],
  ): TextDecoding => ({
    text,
    encoding: selected,
    reason,
    confidence,
    candidates,
  });
  if (encoding !== "auto") {
    const text = decode(bytes, encoding);
    if (text === null) throw new Error("text-decoding-failed");
    return result(text, encoding, "override");
  }
  for (const [bom, selected] of BOMS) {
    if (bom.every((v, i) => bytes[i] === v)) {
      const text = decode(bytes, selected);
      if (text === null) throw new Error("text-decoding-failed");
      return result(text, selected, "bom");
    }
  }
  if (bytes.length >= 8 && bytes.length % 2 === 0) {
    let even = 0,
      odd = 0;
    const length = Math.min(bytes.length, 4096);
    for (let i = 0; i < length; i++) {
      if (bytes[i] === 0) {
        if (i % 2) odd++;
        else even++;
      }
    }
    const pairs = length / 2;
    const selected =
      odd > pairs * 0.4 && even < pairs * 0.05
        ? "utf-16le"
        : even > pairs * 0.4 && odd < pairs * 0.05
          ? "utf-16be"
          : null;
    if (selected) {
      const text = decode(bytes, selected);
      if (text !== null) return result(text, selected, "utf16-pattern");
    }
  }
  if (html) {
    const head = new TextDecoder("windows-1252").decode(
      bytes.subarray(0, 4096),
    );
    const declared = head
      .match(/charset\s*=\s*["']?\s*([a-zA-Z0-9_-]+)/i)?.[1]
      ?.toLowerCase();
    const aliases: Record<string, TextEncoding> = {
      gbk: "gb18030",
      gb2312: "gb18030",
      big5: "big5",
      utf8: "utf-8",
      latin1: "windows-1252",
      "iso-8859-1": "windows-1252",
    };
    const selected = declared
      ? (aliases[declared] ?? normalizeTextEncoding(declared))
      : "auto";
    if (selected !== "auto") {
      const text = decode(bytes, selected);
      if (text !== null) return result(text, selected, "declaration");
    }
  }
  const utf = decode(bytes, "utf-8");
  if (utf !== null) return result(utf, "utf-8", "utf8");
  const candidates = (
    ["gb18030", "big5", "shift_jis", "euc-kr", "windows-1252"] as const
  )
    .flatMap((selected) => {
      const text = decode(bytes, selected);
      return text === null
        ? []
        : [{ selected, text, score: plausibility(text) }];
    })
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best)
    return result(
      best.text,
      best.selected,
      "legacy",
      "low",
      candidates.map((c) => c.selected),
    );
  return result(
    new TextDecoder("windows-1252").decode(bytes),
    "windows-1252",
    "fallback",
    "low",
    [],
  );
}
function plausibility(text: string): number {
  let score = 0;
  for (const char of text.slice(0, 4096)) {
    const c = char.codePointAt(0)!;
    if (
      c === 65533 ||
      (c >= 0xe000 && c <= 0xf8ff) ||
      (c < 32 && !"\n\r\t".includes(char))
    )
      score -= 20;
    else if (c >= 0x3400 && c <= 0x9fff) score += 1;
    else if (c >= 0x3040 && c <= 0x30ff) score += 1.2;
    else if (c >= 0xac00 && c <= 0xd7af) score += 1;
    else if (c >= 0x80 && c <= 0x9f) score -= 10;
  }
  return score;
}
export function decodeTextBook(
  bytes: Uint8Array,
  options?: { encoding?: TextEncoding; html?: boolean },
): string {
  return detectTextBook(bytes, options).text;
}
