/**
 * What a cover-less book prints on its placeholder cover.
 *
 * Imported files carry their name in the title — 《书名》（1-60）作者：某某, a
 * stray NUL byte, a "[前传 1-15章 未完结]" tail. Printed verbatim across five
 * clamped lines that reads as a wall of text, not as a cover. A cover shows a
 * title and an author, so this reduces the metadata to exactly that.
 */

export type CoverLabel = { title: string; author?: string };

/** How much of a title a placeholder cover can show before it stops reading as one. */
const MAX_TITLE_CHARS = 64;
const MAX_AUTHOR_CHARS = 40;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const SPACES = /[\s\u3000]+/g;

function tidy(text: string): string {
  return text.replace(CONTROL_CHARS, " ").replace(SPACES, " ").trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/** 作者：某某 / 作者:某某 / 作者 某某 — how a dumped .txt names its author. */
const AUTHOR_IN_TITLE = /(?:作者|著者|作\s*者)\s*[:：]?\s*([^\]】\[（(）)]{1,40})/;

/** Serial metadata that belongs in the library row, not on the cover. */
const NOISE_GROUPS = [
  /【[^】]{0,60}】/g,
  /\[[^\]]{0,60}\]/g,
  // （1-60）/（全3册）— ranges and counts
  /[（(]\s*(?:全\s*)?\d{1,4}\s*[-–~至]\s*\d{1,4}\s*[）)]/g,
  /[（(][^）)]{0,60}(?:章|回|节|话|更新至|未完结|完结|全|番外|整合|排版|校对|完本|连载)[^）)]{0,20}[）)]/g,
];

/**
 * Split a dumped title into the two things a cover shows.
 *
 * The author is preferred from its own field; when that field is the
 * importer's "Unknown author" placeholder, an `作者：` marker inside the title
 * is used instead. Bracketed serial metadata is dropped from the title only —
 * the library row keeps the full value.
 */
export function coverLabel(rawTitle: string, rawAuthor?: string): CoverLabel {
  let title = tidy(rawTitle ?? "");
  let author = tidy(rawAuthor ?? "");

  if (!author || /^unknown author$/i.test(author) || /^未知作者$/.test(author)) author = "";

  const tagged = AUTHOR_IN_TITLE.exec(title);
  if (tagged) {
    if (!author) author = tidy(tagged[1]!);
    title = tidy(title.slice(0, tagged.index));
  }

  // A bracket-wrapped opening is the book name itself — 【书名】(1-60) and
  // 《书名》 are the two shapes dumps use. Take the name, drop the wrapper.
  const wrapped = /^[【[]([^】\]]{1,60})[】\]]/.exec(title) ?? /^《([^》]{1,60})》/.exec(title);
  if (wrapped) title = wrapped[1]!.trim();
  else {
    for (const pattern of NOISE_GROUPS) title = title.replace(pattern, " ");
    // 书名号 left mid-title reads as a filename, not as cover typography.
    title = title.replace(/[《》〈〉]/g, " ");
  }
  title = title.replace(SPACES, " ").trim();
  // A trailing separator left behind by the removals above.
  title = title.replace(/[\s·・:：,，、\-—_]+$/g, "").trim();

  if (!title) title = tidy(rawTitle ?? "");
  return {
    title: clip(title, MAX_TITLE_CHARS),
    ...(author ? { author: clip(author, MAX_AUTHOR_CHARS) } : {}),
  };
}
