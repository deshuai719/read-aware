import {useCallback,useEffect,useRef,useState} from "react";
import type {ReaderSearchStateApi} from "./useReaderSearch";
import {readerFindTarget} from "../lib/reader-find-target";
/** Serial result commands read fresh snapshots, never a stale render's result array. */
export function useReaderFindNavigation(search:ReaderSearchStateApi,onSelect:(cfi:string)=>void){
  const [wrappedDirection,setWrapped]=useState<-1|1|null>(null);
  const tail=useRef<Promise<void>>(Promise.resolve());
  const manualToken=useRef(0);
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  const apiRef=useRef(search);apiRef.current=search;
  const pending=useRef<{direction:-1|1;revision:number}|null>(null);
  const select=useCallback((index:number)=>{
    const api=apiRef.current,snapshot=api.getSnapshot();const item=snapshot.results[index];
    if(!api.isReady()||!snapshot.visible||snapshot.query!==snapshot.resultsQuery||!item)return;
    api.setActiveIndex(index);selectRef.current(item.cfi);
  },[]);
  const jumpTo=useCallback((index:number)=>{manualToken.current++;pending.current=null;setWrapped(null);select(index);},[select]);
  const step=useCallback((direction:-1|1)=>{
    const revision=apiRef.current.getSnapshot().intentRevision;const token=manualToken.current;
    tail.current=tail.current.catch(()=>{}).then(async()=>{
      const api=apiRef.current;
      if(api.getSnapshot().intentRevision!==revision||manualToken.current!==token)return;
      if(!api.getSnapshot().visible)await api.resume();
      let state=api.getSnapshot();
      if(state.intentRevision!==revision||!state.visible||manualToken.current!==token)return;
      if(!state.results.length&&(state.phase==="queued"||state.phase==="scanning")){
        pending.current={direction,revision};return;
      }
      let target=readerFindTarget(state.results.length,state.activeIndex,direction,state.hasMore);
      if(target.loadMore){
        const oldCount=state.results.length;await api.loadMore();state=api.getSnapshot();
        if(state.intentRevision!==revision||!state.visible||manualToken.current!==token)return;
        target=state.results.length>oldCount?{index:oldCount,loadMore:false,wrapped:false}:readerFindTarget(state.results.length,state.activeIndex,direction,false);
      }
      if(target.index!=null){setWrapped(target.wrapped?direction:null);select(target.index);}
    });
  },[select]);
  useEffect(()=>{
    const request=pending.current;
    if(!request)return;
    if(request.revision!==search.intentRevision||!search.visible){pending.current=null;return;}
    if(search.results.length){pending.current=null;step(request.direction);}
  },[search.results.length,search.intentRevision,search.visible,step]);
  return {jumpTo,step,wrappedDirection};
}
