import {useCallback,useEffect,useRef,useState,type UIEvent} from "react";
export const READER_SEARCH_ROW_HEIGHT=64;
const OVERSCAN=4;
/** Measure and position only the bounded rendered result window. */
export function useReaderSearchResultWindow(count:number,activeIndex:number){
  const viewport=useRef<HTMLDivElement|null>(null);
  const [scroll,setScroll]=useState(0),[height,setHeight]=useState(192);
  useEffect(()=>{
    const node=viewport.current;if(!node)return;
    const visibleHeight=node.clientHeight||192;setHeight(visibleHeight);
    const top=Math.max(0,activeIndex)*READER_SEARCH_ROW_HEIGHT,bottom=top+READER_SEARCH_ROW_HEIGHT;
    if(top<node.scrollTop)node.scrollTop=top;
    else if(bottom>node.scrollTop+visibleHeight)node.scrollTop=Math.max(0,bottom-visibleHeight);
    setScroll(node.scrollTop);
  },[activeIndex]);
  const onScroll=useCallback((event:UIEvent<HTMLDivElement>)=>setScroll(event.currentTarget.scrollTop),[]);
  return {viewport,onScroll,start:Math.max(0,Math.floor(scroll/READER_SEARCH_ROW_HEIGHT)-OVERSCAN),
    end:Math.min(count,Math.ceil((scroll+height)/READER_SEARCH_ROW_HEIGHT)+OVERSCAN)};
}
