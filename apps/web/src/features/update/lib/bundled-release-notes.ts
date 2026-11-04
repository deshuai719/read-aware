import type { WhatsNewEntry } from "./changelog-feed";
/** Local builds carry their notes even before a GitHub release exists. */
export function bundledReleaseNotes(version: string, locale: string): WhatsNewEntry | null {
  if (version.replace(/^v/, "") === "0.5.0-19") {
    const chinese=locale.startsWith("zh");
    return {version,codename:null,date:"2026-11-03",text:{
      summary:chinese?"重整书内查找的匹配、范围、分页和会话生命周期，保留轻量界面。":"Reliable scoped, incremental in-book find with recoverable local sessions.",
      groups:[{kind:"improved",items:(chinese?[
        "默认完整短语匹配；同段全部关键词是明确选项。修复跨标签漏字、段落拼接和末尾命中报错。",
        "全书或当前章节范围；目录锚点与跨文件章节都按真实边界搜索。",
        "首个命中边扫描边可跳转，500条后可继续加载，不把显示预算当最终总数。",
        "关闭清除搜索标记但保留查询；缓存重开不强制跳页，旧书源不会被误恢复。",
        "坏章节和读取超时给出部分覆盖提示，快速改词、取消和早期查找具有状态保护。",
        "结果列表虚拟化；支持F3/Shift+F3、Ctrl或Cmd+G连续查找，以及明确的已加载边界。",
        "预览不覆盖原阅读进度，接受落点或精确回位后提交；新查找不复用旧回位原点。"
      ]:[
        "Default phrase matching and explicit paragraph-AND; correct inline excerpts and final offsets.",
        "Whole-book or chapter scope follows TOC anchors and multi-file chapters.",
        "First hits stream early, with continuation beyond the first500 matches.",
        "Dismiss removes markers but remembers the query; valid cached sessions reopen without navigation.",
        "Partial warnings, timeouts, cancellation and queued reader readiness are explicit.",
        "Virtualized results and F3/Shift+F3 or Ctrl/Cmd+G respect loaded result boundaries.",
        "Preview, accept and exact return preserve progress; every new find gets a fresh origin."
      ]).map(body=>({body}))}]
    }};
  }
  if (version.replace(/^v/, "") === "0.5.0-18") {
    const chinese = locale.startsWith("zh");
    return { version, codename: null, date: "2026-11-03", text: {
      summary: chinese ? "书内查找改为常见的紧凑页内查找方式，消除提前遮挡和永久红框高亮。" : "Compact page-find with on-demand controls and transient background highlights.",
      groups: [{kind:"improved",items:(chinese ? [
        "Ctrl+F只打开一行查找条，不再强制展开整条阅读器工具栏。",
        "结果与匹配选项需主动展开，输入或聚焦不再提前出现长框。",
        "首个结果定位、Enter/Shift+Enter和上下箭头逐条跳转，保留精确回位。",
        "搜索命中使用柔和黄色底色，当前项稍深，不使用红色描边。",
        "关闭、清空或点正文退出时清除搜索标记；异步扫描也不会把标记画回来。"
      ] : [
        "Ctrl+F opens only a single find row, not the full reader toolbar.",
        "Results and match options are shown only when explicitly requested.",
        "First-hit navigation, Enter/Shift+Enter and previous/next preserve the return anchor.",
        "Soft yellow backgrounds replace red outline boxes; the active hit is subtly darker.",
        "Closing or clearing find removes markers and invalidates in-flight paints."
      ]).map(body=>({body}))}]
    }};
  }
  if (version.replace(/^v/, "") !== "0.5.0-17") return null;
  const chinese = locale.startsWith("zh");
  return { version, codename: null, date: "2026-11-03", text: {
    summary: chinese ? "修复书内查找、阅读进度、合集锁保护与合并，并改善章节识别。" : "Reliable in-book find, reading progress, protected collections and chapter detection.",
    groups: [{kind:"fixed",items:(chinese ? [
      "书内查找改为轻量浮动条；跳转后收起结果，支持逐条跳转与精确回到原位置。",
      "同段落多词匹配、引号短语、旧查询取消和截断处理，不再按CFI错误求交。",
      "搜索预览不修改已保存书籍进度，关闭或回位后提交确认的落点。",
      "合集合并在单次事件事务中完成，锁定合集不可经新增入口绕过。",
      "合集资料同步、网格自选封面、导入归档失败提示以及真实短章保留。"
    ] : [
      "Compact find bar, sequential navigation and exact return to the original reading anchor.",
      "Single-pass same-paragraph multi-term matching, quoted phrases and stale-query cancellation.",
      "Search previews do not overwrite durable reading progress.",
      "Atomic collection merges and lock-checked collection actions.",
      "Preserved synchronized profiles, chosen grid covers, honest import errors and short chapters."
    ]).map(body=>({body}))}]
  }};
}
