/** Space-separated words match within one paragraph; quotes preserve exact phrases. */
export function splitSearchTerms(query: string, matchCase = false): string[] {
  const terms = query.trim().match(/"[^"]+"|“[^”]+”|[^\s]+/gu) ?? [];
  const seen = new Set<string>();
  return terms.map(term => term.replace(/^["“]|["”]$/gu, "")).filter(term => {
    const key = matchCase ? term : term.toLocaleLowerCase();
    if (!term || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
