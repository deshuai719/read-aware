/** Device-local font assets. Existing font cache storage; no source file is modified. */
import { invoke } from "@tauri-apps/api/core";
import {
  getDesktopBlob,
  putDesktopBlob,
  putDesktopBlobFromPath,
  deleteDesktopBlob,
} from "../../../platform/blob-store";
import { localKV, replaceLocalKVPrefix } from "../../../platform/local-store";
import { isTauri } from "../../../platform/environment";
import { emitAppEvent } from "../../../platform/app-events";
import {
  localFontFormat,
  localFontFamily,
  LOCAL_FONT_MAX_BYTES,
  type LocalFontFormat,
} from "./local-font-format";
export type LocalReadingFont = {
  id: string;
  name: string;
  format: LocalFontFormat;
  sha256: string;
  byteSize: number;
};
const PREFIX = "read-aware-local-font.";
const key = (id: string) => "font:local:" + id;
let tail = Promise.resolve();
const cssCache = new Map<string, { url: string; css: string }>();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.catch(() => {}).then(work);
  tail = result.then(
    () => {},
    () => {},
  );
  return result;
}
export function listLocalReadingFonts(): LocalReadingFont[] {
  return Object.values(localKV.entries(PREFIX))
    .flatMap((value) => {
      try {
        const item = JSON.parse(value) as LocalReadingFont;
        return localFontFamily("local:" + item.id) &&
          typeof item.name === "string"
          ? [item]
          : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
async function save(items: LocalReadingFont[]) {
  await replaceLocalKVPrefix(
    PREFIX,
    Object.fromEntries(items.map((item) => [item.id, JSON.stringify(item)])),
  );
  emitAppEvent("local-fonts-changed", {});
}
export function importLocalReadingFont(
  input: { path: string } | { file: File },
): Promise<LocalReadingFont> {
  return serial(async () => {
    if (!isTauri()) throw new Error("font-desktop-only");
    const size =
      "file" in input
        ? input.file.size
        : await invoke<number>("book_file_size", { path: input.path });
    if (size < 12 || size > LOCAL_FONT_MAX_BYTES)
      throw new Error("font-invalid-size");
    const id = crypto.randomUUID(),
      blobKey = key(id);
    let bytes: Uint8Array;
    const name = (
      "file" in input
        ? input.file.name
        : (input.path.split(/[\\/]/).pop() ?? "Local font")
    )
      .replace(/\.[^.]+$/, "")
      .slice(0, 120);
    try {
      const stored =
        "file" in input
          ? await putDesktopBlob(
              blobKey,
              new Uint8Array(await input.file.arrayBuffer()),
              "application/octet-stream",
            )
          : await putDesktopBlobFromPath(
              blobKey,
              input.path,
              "application/octet-stream",
            );
      bytes = (await getDesktopBlob(blobKey)) ?? new Uint8Array();
      const format = localFontFormat(bytes);
      const face = new FontFace(
        localFontFamily("local:" + id)!,
        bytes.buffer as ArrayBuffer,
      );
      await face.load();
      const prior = listLocalReadingFonts(),
        duplicate = prior.find((font) => font.sha256 === stored.sha256);
      if (duplicate) {
        await deleteDesktopBlob(blobKey);
        return duplicate;
      }
      const font = {
        id,
        name,
        format,
        sha256: stored.sha256,
        byteSize: stored.byteSize,
      };
      await save([...prior, font]);
      return font;
    } catch (error) {
      await deleteDesktopBlob(blobKey).catch(() => {});
      throw error;
    }
  });
}
export function removeLocalReadingFont(id: string): Promise<void> {
  return serial(async () => {
    const prior = listLocalReadingFonts();
    if (!prior.some((font) => font.id === id)) return;
    await deleteDesktopBlob(key(id));
    await save(prior.filter((font) => font.id !== id));
    const cached = cssCache.get(id);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      cssCache.delete(id);
    }
    document.getElementById("local-font-" + id)?.remove();
  });
}
export function ensureLocalFontFaceCss(value: string): Promise<string> {
  return serial(async () => {
    const family = localFontFamily(value);
    if (!family) return "";
    const id = value.slice(6);
    if (!listLocalReadingFonts().some((font) => font.id === id)) return "";
    const cached = cssCache.get(id);
    if (cached) return cached.css;
    const bytes = await getDesktopBlob(key(id));
    if (!bytes) throw new Error("font-file-missing");
    localFontFormat(bytes);
    const face = new FontFace(family, bytes.buffer as ArrayBuffer);
    await face.load();
    if (!listLocalReadingFonts().some((font) => font.id === id)) return "";
    const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
    const css =
      '@font-face{font-family:"' +
      family +
      '";src:url("' +
      url +
      '");font-display:swap;}';
    cssCache.set(id, { url, css });
    return css;
  });
}
export async function exportLocalFonts(): Promise<
  { font: LocalReadingFont; bytes: number[] }[]
> {
  const out = [];
  for (const font of listLocalReadingFonts()) {
    const bytes = await getDesktopBlob(key(font.id));
    if (bytes) out.push({ font, bytes: Array.from(bytes) });
  }
  return out;
}
export function restoreLocalFonts(
  items: { font: LocalReadingFont; bytes: number[] }[],
): Promise<void> {
  return serial(async () => {
    const existing = listLocalReadingFonts();
    for (const item of items) {
      if (!localFontFamily("local:" + item.font.id))
        throw new Error("font-invalid-id");
      const cached = cssCache.get(item.font.id);
      if (cached) {
        URL.revokeObjectURL(cached.url);
        cssCache.delete(item.font.id);
      }
      document.getElementById("local-font-" + item.font.id)?.remove();
      const bytes = new Uint8Array(item.bytes);
      const format = localFontFormat(bytes);
      const face = new FontFace(
        localFontFamily("local:" + item.font.id)!,
        bytes.buffer as ArrayBuffer,
      );
      await face.load();
      const stored = await putDesktopBlob(
        key(item.font.id),
        bytes,
        "application/octet-stream",
      );
      const restored = {
        ...item.font,
        format,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
      };
      const index = existing.findIndex((f) => f.id === item.font.id);
      if (index < 0) existing.push(restored);
      else existing[index] = restored;
    }
    await save(existing);
  });
}
