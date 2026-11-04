export function readerFindTarget(count:number,active:number,direction:-1|1,hasMore:boolean):{index:number|null;loadMore:boolean;wrapped:boolean}{
  if(count===0)return {index:null,loadMore:hasMore,wrapped:false};
  if(active<0)return {index:direction===1?0:count-1,loadMore:false,wrapped:false};
  const next=active+direction;
  if(next>=count&&hasMore)return {index:null,loadMore:true,wrapped:false};
  if(next>=count)return {index:0,loadMore:false,wrapped:true};
  if(next<0)return {index:count-1,loadMore:false,wrapped:true};
  return {index:next,loadMore:false,wrapped:false};
}
