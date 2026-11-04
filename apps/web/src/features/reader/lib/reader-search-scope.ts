import type {FoliateView,FoliateTocItem,FoliateSearchScopeSpan} from "./foliate-engine";
import type {ReaderSearchOptions} from "./reader-search-query";
function chapterAnchor(view:FoliateView,href:string,anchor:unknown):(doc:Document)=>unknown{
  const parts=view.book?.splitTOCHref?.(href);
  const fragment=parts?parts[1]:href.includes("#")?href.slice(href.indexOf("#")+1):null;
  const documentStart=fragment==null||fragment==="";
  if(typeof anchor==="function")return doc=>{const target=anchor(doc);return target==null&&documentStart?0:target;};
  if(anchor===0||anchor==null&&documentStart)return ()=>0;
  return ()=>null;
}
function flatten(items:FoliateTocItem[]):FoliateTocItem[]{return items.flatMap(item=>[item,...flatten(item.subitems??[])]);}
export async function captureReaderSearchScope(view:FoliateView,options:ReaderSearchOptions):Promise<{index:number|null;key:number|string|null;span?:FoliateSearchScopeSpan}>{
  if(options.scope==="book")return {index:null,key:null};
  const location=view.lastLocation;
  const current=location?.cfi?await view.resolveNavigation?.(location.cfi):null;
  const currentIndex=current?.index??view.renderer?.getContents?.()[0]?.index;
  if(currentIndex==null)throw new Error("Current search chapter unavailable");
  const href=location?.tocItem?.href;
  if(!href)return {index:currentIndex,key:currentIndex};
  const items=flatten(view.book?.toc??[]).filter(item=>item.href);
  const position=items.findIndex(item=>item.href===href);
  if(position<0)return {index:currentIndex,key:currentIndex};
  const next=items.slice(position+1).find(item=>item.href!==href);
  const start=await view.resolveNavigation?.(href);
  const end=next?.href?await view.resolveNavigation?.(next.href):null;
  if(start?.index==null||(next&&end?.index==null))throw new Error("Chapter boundaries unavailable");
  const span:FoliateSearchScopeSpan={startIndex:start.index,endIndex:end?.index??null};
  if(span.endIndex!==null&&span.endIndex<span.startIndex)throw new Error("Invalid chapter boundaries");
  span.startAnchor=chapterAnchor(view,href,start.anchor);
  if(next?.href&&end)span.endAnchor=chapterAnchor(view,next.href,end.anchor);
  return {index:start.index,key:href+"::"+(next?.href??""),span};
}
