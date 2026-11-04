import type {FoliateSearchYield} from "./foliate-engine";
export const SEARCH_PAGE_SIZE=500;
export const SEARCH_RESULT_LIMIT=10000;
export type ReaderSearchResultItem={cfi:string;pre:string;match:string;post:string;sectionIndex:number;chapter:string;fraction:number|null};
export type ReaderSearchPage={results:ReaderSearchResultItem[];progress:number|null;complete:boolean;hasMore:boolean;limitReached:boolean;warningIndices:number[];error:string|null};
/** Deterministic page coordinator; all engine work is injected through the iterator. */
export class ReaderSearchSession {
  private results:ReaderSearchResultItem[];
  private seen:Set<string>;
  private pending:ReaderSearchResultItem[]=[];
  private warnings:Set<number>;
  private progress:number|null=null;
  private done=false;
  private stopped=false;
  private error:string|null=null;
  private busy:Promise<ReaderSearchPage>|null=null;
  constructor(private iterator:AsyncIterator<FoliateSearchYield>,private fractions:number[],private changed:(page:ReaderSearchPage)=>void,
    seed:Pick<ReaderSearchPage,"results"|"warningIndices">={results:[],warningIndices:[]}){
    this.results=[...seed.results];this.seen=new Set(this.results.map(hit=>hit.cfi));this.warnings=new Set(seed.warningIndices);
  }
  snapshot():ReaderSearchPage{return {results:[...this.results],progress:this.progress,complete:this.done&&this.error===null,hasMore:!this.done&&!this.stopped&&this.results.length<SEARCH_RESULT_LIMIT,
    limitReached:!this.done&&this.results.length>=SEARCH_RESULT_LIMIT,warningIndices:[...this.warnings],error:this.error};}
  readMore(size=SEARCH_PAGE_SIZE):Promise<ReaderSearchPage>{
    if(this.busy)return this.busy;
    this.busy=this.readPage(Math.min(SEARCH_RESULT_LIMIT,this.results.length+Math.max(1,size))).finally(()=>{this.busy=null});
    return this.busy;
  }
  private publish(){if(!this.stopped)this.changed(this.snapshot());}
  private async readPage(target:number):Promise<ReaderSearchPage>{
    try{
      while(!this.done&&!this.stopped&&this.results.length<target){
        while(this.pending.length&&this.results.length<target){
          const item=this.pending.shift()!;if(this.seen.has(item.cfi))continue;this.seen.add(item.cfi);this.results.push(item);
        }
        this.publish();
        if(this.results.length>=target)break;
        const next=await this.iterator.next();if(this.stopped)break;
        if(next.done||next.value==="done"){this.done=true;await this.iterator.return?.();break;}
        const event=next.value;
        if("progress" in event)this.progress=event.progress;
        else if("warning" in event)this.warnings.add(event.index);
        else if("subitems" in event){
          const index=event.index;
          if(index==null)continue;
          this.pending.push(...event.subitems.filter(hit=>!!hit.cfi).map(hit=>({cfi:hit.cfi,...hit.excerpt,sectionIndex:index,chapter:event.label??"",fraction:this.fractions[index]??null})));
        }
      }
      if(this.results.length>=SEARCH_RESULT_LIMIT&&!this.done)await this.iterator.return?.();
    }catch(cause){if(!this.stopped){this.error=cause instanceof Error?cause.message:String(cause);this.done=true;await this.iterator.return?.().catch(()=>{});}}
    this.publish();return this.snapshot();
  }
  async stop():Promise<void>{this.stopped=true;this.pending=[];await this.iterator.return?.().catch(()=>{});}
}
