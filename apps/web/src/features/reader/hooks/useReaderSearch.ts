import {useCallback,useEffect,useRef,useState,type RefObject} from "react";
import {loadDrawFns,type FoliateView,type FoliateBook} from "../lib/foliate-engine";
import {captureReaderSearchScope} from "../lib/reader-search-scope";
import {DEFAULT_SEARCH_OPTIONS,readerSearchKey,readerSearchTerms,type ReaderSearchOptions} from "../lib/reader-search-query";
import {ReaderSearchSession,SEARCH_PAGE_SIZE,type ReaderSearchPage,type ReaderSearchResultItem} from "../lib/reader-search-session";
export {DEFAULT_SEARCH_OPTIONS,type ReaderSearchOptions,type ReaderSearchResultItem};
export const MAX_SEARCH_RESULTS=SEARCH_PAGE_SIZE;
type Phase="idle"|"queued"|"scanning"|"paused"|"done"|"failed";
export type ReaderSearchModel=ReaderSearchPage&{query:string;resultsQuery:string;options:ReaderSearchOptions;activeIndex:number;phase:Phase;visible:boolean;navRevision:number;intentRevision:number;scopeIndex:number|null};
const blankPage=():ReaderSearchPage=>({results:[],progress:null,complete:false,hasMore:false,limitReached:false,warningIndices:[],error:null});
export type ReaderSearchStateApi=ReaderSearchModel&{
  running:boolean;truncated:boolean;terms:string[];missingTerm:null;
  setQuery:(query:string)=>void;runSearch:(query:string,opts?:{navigate?:boolean})=>Promise<void>;
  setActiveIndex:(index:number)=>void;setOptions:(patch:Partial<ReaderSearchOptions>)=>void;
  clear:()=>void;dismiss:()=>void;resume:()=>Promise<void>;loadMore:()=>Promise<void>;notifyReady:()=>void;
  getSnapshot:()=>ReaderSearchModel;isReady:()=>boolean;
};
export type ReaderSearchApi=ReaderSearchStateApi&{jumpTo:(index:number)=>void;step:(direction:-1|1)=>void;wrappedDirection:-1|1|null;canReturn:boolean;returnToPosition:()=>void};
type Context={owner:FoliateBook;key:string;scopeIndex:number|null};
type Cache={context:Context;model:ReaderSearchModel};
/** Engine-bound local find session. No persisted library or progress writes occur here. */
export function useReaderSearch({viewRef,bookId}:{viewRef:RefObject<FoliateView|null>;bookId:string|null}):ReaderSearchStateApi{
  const [state,setState]=useState<ReaderSearchModel>(()=>({...blankPage(),query:"",resultsQuery:"",options:{...DEFAULT_SEARCH_OPTIONS},activeIndex:-1,phase:"idle",visible:false,navRevision:0,intentRevision:0,scopeIndex:null}));
  const model=useRef(state);
  const taskEpoch=useRef(0);
  const abort=useRef<AbortController|null>(null);
  const session=useRef<ReaderSearchSession|null>(null);
  const context=useRef<Context|null>(null);
  const ready=useRef<{view:FoliateView;owner:FoliateBook}|null>(null);
  const isReady=useCallback(()=>!!viewRef.current?.book&&ready.current?.view===viewRef.current&&ready.current.owner===viewRef.current.book,[viewRef]);
  const cache=useRef<Cache|null>(null);
  const painted=useRef(false);
  const resumePromise=useRef<Promise<void>|null>(null);
  const tail=useRef<Promise<void>>(Promise.resolve());
  const commit=useCallback((patch:Partial<ReaderSearchModel>)=>{model.current={...model.current,...patch};setState(model.current);},[]);
  const cancel=useCallback(()=>{
    taskEpoch.current++;abort.current?.abort();abort.current=null;painted.current=false;resumePromise.current=null;
    const old=session.current;session.current=null;
    const stopped=old?.stop()??Promise.resolve();
    tail.current=Promise.all([tail.current.catch(()=>{}),stopped]).then(()=>{});
    return taskEpoch.current;
  },[]);
  const applyPage=useCallback((page:ReaderSearchPage,token:number,view:FoliateView)=>{
    if(token!==taskEpoch.current||viewRef.current!==view||context.current?.owner!==view.book)return;
    commit({...page,phase:page.error?"failed":page.complete?"done":"scanning"});
    const cfi=page.results[model.current.activeIndex]?.cfi;
    if(cfi)void view.setSearchActive?.(cfi);
  },[commit,viewRef]);
  const start=useCallback((query:string,navigate:boolean,seed?:ReaderSearchPage):Promise<void>=>{
    const token=cancel();const current=model.current;const options=current.options;
    commit({...(seed??blankPage()),query,resultsQuery:query,activeIndex:seed?current.activeIndex:-1,visible:true,phase:"queued",scopeIndex:null,
      navRevision:current.navRevision+(navigate?1:0),intentRevision:current.intentRevision+(navigate?1:0)});
    if(!query.trim()){commit({phase:"idle",resultsQuery:""});viewRef.current?.clearSearch();return Promise.resolve();}
    const view=viewRef.current;
    if(!view?.book||!isReady())return Promise.resolve(); // notifyReady replays the queued intent after open.
    const owner=view.book;
    const next=tail.current.catch(()=>{}).then(async()=>{
      if(token!==taskEpoch.current)return;
      const controller=new AbortController();abort.current=controller;
      try{
        const scope=await captureReaderSearchScope(view,options);
        const scopeIndex=scope.index;
        const {highlight}=await loadDrawFns();
        if(token!==taskEpoch.current||controller.signal.aborted||viewRef.current!==view||view.book!==owner)return;
        context.current={owner,key:readerSearchKey(query,options,scope.key),scopeIndex};
        commit({scopeIndex,phase:"scanning"});
        const iterator=view.search({query:query.trim(),queryTerms:readerSearchTerms(query,options),matchCase:options.matchCase,matchWholeWords:options.matchWholeWords,
          scopeIndex:scope.span?undefined:scopeIndex??undefined,scopeSpan:scope.span,batchSize:50,draw:highlight,drawOptions:{color:"#f4d35e",activeColor:"#dfac45"},signal:controller.signal});
        const worker=new ReaderSearchSession(iterator,view.getSectionFractions?.()??[],page=>applyPage(page,token,view),seed);
        session.current=worker;const page=await worker.readMore();
        if(token===taskEpoch.current)commit({...page,phase:page.error?"failed":page.complete?"done":"paused"});
      }catch(cause){if(token===taskEpoch.current&&!controller.signal.aborted)commit({error:cause instanceof Error?cause.message:String(cause),phase:"failed",hasMore:false});}
    });
    tail.current=next.catch(()=>{});return next;
  },[cancel,commit,viewRef,applyPage,isReady]);
  const runSearch=useCallback((query:string,opts?:{navigate?:boolean})=>start(query,opts?.navigate??true),[start]);
  const setQuery=useCallback((query:string)=>{
    if(model.current.query===query)return;
    cancel();viewRef.current?.clearSearch();context.current=null;
    commit({...blankPage(),query,resultsQuery:"",activeIndex:-1,phase:"idle",intentRevision:model.current.intentRevision+1});
  },[cancel,commit,viewRef]);
  const clear=useCallback(()=>{cancel();viewRef.current?.clearSearch();cache.current=null;context.current=null;
    commit({...blankPage(),query:"",resultsQuery:"",activeIndex:-1,phase:"idle",intentRevision:model.current.intentRevision+1});
  },[cancel,commit,viewRef]);
  const dismiss=useCallback(()=>{
    if(context.current&&model.current.query===model.current.resultsQuery)cache.current={context:context.current,model:{...model.current}};
    cancel();viewRef.current?.clearSearch();
    commit({visible:false,phase:model.current.complete?"done":model.current.results.length?"paused":"idle",intentRevision:model.current.intentRevision+1});
  },[cancel,commit,viewRef]);
  const performResume=useCallback(async()=>{
    if(model.current.visible&&(session.current||painted.current))return;
    const query=model.current.query;commit({visible:true});if(!query.trim())return;
    const view=viewRef.current;const saved=cache.current;
    if(!view?.book||!isReady()||!saved||saved.context.owner!==view.book){await start(query,false);return;}
    const token=cancel();const options=model.current.options;
    try{
      const scope=await captureReaderSearchScope(view,options);
      if(token!==taskEpoch.current)return;
      if(readerSearchKey(query,options,scope.key)!==saved.context.key){await start(query,false);return;}
      const {highlight}=await loadDrawFns();if(token!==taskEpoch.current)return;
      if(!view.restoreSearchResults){await start(query,false);return;}
      context.current=saved.context;
      commit({...saved.model,query,resultsQuery:query,visible:true,options,intentRevision:model.current.intentRevision,navRevision:model.current.navRevision,
        phase:saved.model.error?"failed":saved.model.complete?"done":"paused"});
      const controller=new AbortController();abort.current=controller;
      await view.restoreSearchResults(saved.model.results.map(hit=>({index:hit.sectionIndex,cfi:hit.cfi})),{draw:highlight,drawOptions:{color:"#f4d35e",activeColor:"#dfac45"},
        activeCfi:saved.model.results[saved.model.activeIndex]?.cfi??null,signal:controller.signal});
      if(token===taskEpoch.current)painted.current=true;
    }catch(cause){if(token===taskEpoch.current)commit({error:cause instanceof Error?cause.message:String(cause),phase:"failed"});}
  },[cancel,commit,start,viewRef,isReady]);
  const resume=useCallback(()=>{
    if(resumePromise.current)return resumePromise.current;
    const promise=performResume();resumePromise.current=promise;
    void promise.finally(()=>{if(resumePromise.current===promise)resumePromise.current=null;}).catch(()=>{});
    return promise;
  },[performResume]);
  const loadMore=useCallback(async()=>{
    const current=model.current;const worker=session.current;const view=viewRef.current;
    if(!current.hasMore||current.limitReached)return;
    if(!worker||!view){await start(current.query,false,current);return;}
    const token=taskEpoch.current;commit({phase:"scanning"});const page=await worker.readMore();
    if(token===taskEpoch.current)commit({...page,phase:page.error?"failed":page.complete?"done":"paused"});
  },[commit,start,viewRef]);
  const setOptions=useCallback((patch:Partial<ReaderSearchOptions>)=>{
    const options={...model.current.options,...patch};
    if(JSON.stringify(options)===JSON.stringify(model.current.options))return;
    commit({options});if(model.current.query.trim())void start(model.current.query,true);
  },[commit,start]);
  const setActiveIndex=useCallback((index:number)=>{commit({activeIndex:index>=0&&index<model.current.results.length?index:-1});},[commit]);
  const notifyReady=useCallback(()=>{
    const view=viewRef.current;if(!view?.book)return;const previous=ready.current;ready.current={view,owner:view.book};
    if(!model.current.visible||!model.current.query.trim())return;
    if(model.current.phase==="queued"||(context.current&&context.current.owner!==view.book))void start(model.current.query,false);
    else if(previous?.view!==view&&context.current){cache.current={context:context.current,model:{...model.current}};cancel();void resume();}
  },[start,viewRef,cancel,resume]);
  const getSnapshot=useCallback(()=>model.current,[]);
  useEffect(()=>{clear();return()=>{cancel();viewRef.current?.clearSearch();};},[bookId,clear,cancel,viewRef]);
  return {...state,running:state.phase==="queued"||state.phase==="scanning",truncated:state.hasMore||state.limitReached,terms:readerSearchTerms(state.query,state.options),missingTerm:null,
    setQuery,runSearch,setActiveIndex,setOptions,clear,dismiss,resume,loadMore,notifyReady,getSnapshot,isReady};
}
