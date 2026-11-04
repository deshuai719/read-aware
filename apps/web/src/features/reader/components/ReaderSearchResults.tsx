import {useReaderSearchResultWindow,READER_SEARCH_ROW_HEIGHT as ROW} from "../hooks/useReaderSearchResultWindow";
import {Body,Button,Caption} from "@read-aware/ui";
import {cn} from "@read-aware/ui/cn";
import {useTranslation} from "../../../i18n";
import type {ReaderSearchApi} from "../hooks/useReaderSearch";
import {SEARCH_PAGE_SIZE,SEARCH_RESULT_LIMIT} from "../lib/reader-search-session";
/** Bounded result DOM: thousands of hits retain ordered access without thousands of buttons. */
export function ReaderSearchResults({search,onSelect}:{search:ReaderSearchApi;onSelect:(index:number)=>void}){
  const {t}=useTranslation("reader");
  const {viewport,onScroll,start,end}=useReaderSearchResultWindow(search.results.length,search.activeIndex);
  return <div data-reader-find-results role="region" aria-label={t("search.showResults")}
    className="absolute right-0 top-full z-40 mt-1 w-full rounded-md border border-border bg-[var(--ra-main-surface-color)] shadow-md">
    <div ref={viewport} className="max-h-[min(12rem,30vh)] overflow-y-auto" onScroll={onScroll}>
      <div role="list" className="relative" style={{height:search.results.length*ROW}}>
        {search.results.slice(start,end).map((item,offset)=>{const index=start+offset;return <div key={item.cfi} role="listitem" aria-posinset={index+1} aria-setsize={search.results.length}
          className="absolute left-0 right-0" style={{top:index*ROW,height:ROW}}>
          <Button variant="ghost" data-search-result={index} data-active={index===search.activeIndex?"true":undefined} onClick={()=>onSelect(index)}
            className={cn("block h-full w-full overflow-hidden rounded-none px-2.5 py-1 text-left",index===search.activeIndex?"bg-fill text-fg":"text-fg-muted")}>
            <Caption className="block truncate text-[10px] text-fg-subtle">{item.chapter||t("search.chapter",{index:item.sectionIndex+1})}</Caption>
            <span className="line-clamp-2 text-xs leading-4">{item.pre}<mark className="rounded-sm bg-[#f4d35e]/35 text-inherit">{item.match}</mark>{item.post}</span>
          </Button>
        </div>})}
      </div>
    </div>
    <div className="border-t border-border px-2 py-1.5">
      {search.warningIndices.length>0&&<Body className="text-xs text-fg-muted">{t("search.partialCoverage",{count:search.warningIndices.length})}</Body>}
      {search.limitReached&&<Body className="text-xs text-fg-muted">{t("search.limitReached",{count:SEARCH_RESULT_LIMIT})}</Body>}
      {search.hasMore&&<Button size="sm" variant="ghost" className="h-7 w-full text-xs" disabled={search.running} onClick={()=>void search.loadMore()}>
        {search.running?t("search.running"):t("search.loadMore",{count:SEARCH_PAGE_SIZE})}
      </Button>}
      {!search.running&&!search.hasMore&&!search.limitReached&&!search.error&&<Caption className="text-xs text-fg-subtle">{t("search.resultCount",{count:search.results.length})}</Caption>}
    </div>
  </div>;
}
