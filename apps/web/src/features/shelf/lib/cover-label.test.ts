import { describe, expect, test } from "bun:test";
import { coverLabel } from "./cover-label";

describe("coverLabel", () => {
  test("a plain title and author pass through", () => {
    expect(coverLabel("认知觉醒", "周岭")).toEqual({ title: "认知觉醒", author: "周岭" });
  });

  test("a dumped filename becomes a title plus the author it names", () => {
    expect(coverLabel("【COSER美母的堕落】（1-60）作者：贴身侍卫")).toEqual({
      title: "COSER美母的堕落",
      author: "贴身侍卫",
    });
  });

  test("serial brackets and 书名号 are dropped, not printed on the cover", () => {
    expect(coverLabel("《高冷警花的堕落事件簿》作者：徒花[更新至第三案七日计画#7极乐真相]")).toEqual({
      title: "高冷警花的堕落事件簿",
      author: "徒花",
    });
  });

  test("control characters (a stray NUL byte) never reach the cover", () => {
    expect(coverLabel("《人月神话 40周年中文纪念版》\u0000", "Unknown author")).toEqual({
      title: "人月神话 40周年中文纪念版",
    });
  });

  test("an overlong title is clipped with an ellipsis", () => {
    const label = coverLabel("书".repeat(200));
    expect(label.title.length).toBeLessThanOrEqual(65);
    expect(label.title.endsWith("…")).toBe(true);
  });
});
