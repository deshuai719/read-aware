export const LOCAL_FONT_MAX_BYTES = 32 * 1024 * 1024;
export type LocalFontFormat = "ttf" | "otf" | "woff" | "woff2";
export function localFontFormat(bytes: Uint8Array): LocalFontFormat {
  if (bytes.length < 12 || bytes.length > LOCAL_FONT_MAX_BYTES)
    throw new Error("font-invalid-size");
  const signature = String.fromCharCode(...bytes.subarray(0, 4));
  if (signature === "OTTO") return "otf";
  if (signature === "wOFF") return "woff";
  if (signature === "wOF2") return "woff2";
  if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)
    return "ttf";
  throw new Error("font-invalid-format");
}
export function localFontId(value: unknown): string | null {
  return typeof value === "string" && /^local:[a-f0-9-]{36}$/.test(value)
    ? value.slice(6)
    : null;
}
export function localFontFamily(value: string): string | null {
  const id = localFontId(value);
  return id ? "ReadAwareLocal_" + id.replace(/-/g, "") : null;
}
