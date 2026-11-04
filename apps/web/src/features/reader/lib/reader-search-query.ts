import {splitSearchTerms} from "./search-terms";
export type ReaderSearchOptions={matchCase:boolean;matchWholeWords:boolean;mode:"phrase"|"all";scope:"book"|"chapter"};
export const DEFAULT_SEARCH_OPTIONS:ReaderSearchOptions={matchCase:false,matchWholeWords:false,mode:"phrase",scope:"book"};
export function readerSearchTerms(query:string,options:ReaderSearchOptions):string[]{
  const value=query.trim();
  return !value?[]:options.mode==="all"?splitSearchTerms(value,options.matchCase):[value];
}
export function readerSearchKey(query:string,options:ReaderSearchOptions,section:number|string|null):string{
  return JSON.stringify([query.trim(),options.matchCase,options.matchWholeWords,options.mode,options.scope,section]);
}
