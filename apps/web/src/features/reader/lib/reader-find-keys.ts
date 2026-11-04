type Key={key:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean;isComposing?:boolean};
export function readerFindDirection(event:Key):-1|1|null{
  if(event.altKey||event.isComposing)return null;
  return event.key==="F3"||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="g")?event.shiftKey?-1:1:null;
}
