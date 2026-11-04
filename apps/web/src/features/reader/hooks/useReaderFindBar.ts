import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ReaderSearchApi, ReaderSearchOptions } from "./useReaderSearch";
import {readerFindDirection} from "../lib/reader-find-keys";
const DEBOUNCE_MS = 300;
export function useReaderFindBar({ open, search, focusRequestId, onClose }: {
  open: boolean; search: ReaderSearchApi; focusRequestId: number; onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);
  const composing = useRef(false);
  const handledRevision = useRef(search.navRevision);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const currentResults = search.query === search.resultsQuery;
  const hasResults = currentResults && search.results.length > 0;
  const cancelTimer = useCallback(() => { if (timer.current !== null) window.clearTimeout(timer.current); timer.current = null; }, []);
  useEffect(() => {
    if (!open) { cancelTimer(); return; }
    const frame = window.requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
    return () => { window.cancelAnimationFrame(frame); cancelTimer(); };
  }, [open, cancelTimer]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open, focusRequestId]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-reader-search-toggle]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onClose]);
  useEffect(() => {
    if (!resultsOpen) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:"nearest"});
  }, [resultsOpen, search.activeIndex]);
  const select = useCallback((index: number) => {
    if (!hasResults) return;
    search.jumpTo(index); setResultsOpen(false); inputRef.current?.focus();
  }, [hasResults, search.jumpTo]);
  const step=useCallback((direction:-1|1)=>{search.step(direction);setResultsOpen(false);inputRef.current?.focus();},[search.step]);
  useEffect(()=>{
    if(!open||!hasResults||handledRevision.current===search.navRevision)return;
    handledRevision.current=search.navRevision;select(0);
  },[open,hasResults,search.navRevision,select]);
  useEffect(()=>{if(open)void search.resume();},[open,search.resume]);
  useEffect(()=>{
    if(!open)return;
    const key=(event:globalThis.KeyboardEvent)=>{const direction=readerFindDirection(event);if(direction==null)return;event.preventDefault();event.stopPropagation();step(direction);};
    document.addEventListener("keydown",key,true);return()=>document.removeEventListener("keydown",key,true);
  },[open,step]);
  const schedule = useCallback((query: string) => {
    cancelTimer();
    timer.current = window.setTimeout(() => { timer.current = null; search.runSearch(query); }, DEBOUNCE_MS);
  }, [cancelTimer, search.runSearch]);
  const change = useCallback((query: string) => {
    setResultsOpen(false); search.setQuery(query);
    if (!query.trim()) { cancelTimer(); search.clear(); }
    else if (!composing.current) schedule(query);
  }, [search.setQuery, search.clear, cancelTimer, schedule]);
  const keyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.nativeEvent.isComposing || composing.current) return;
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.defaultPrevented) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hasResults) return;
      event.preventDefault(); step(event.key === "ArrowDown" ? 1 : -1);
    }
  }, [hasResults, onClose, step]);
  const inputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || composing.current || event.key !== "Enter") return;
    event.preventDefault(); event.stopPropagation(); cancelTimer();
    if (!search.query.trim()) return;
    if (currentResults) step(event.shiftKey ? -1 : 1);
    else if (!search.running) void search.runSearch(search.query);
  }, [currentResults, step, cancelTimer, search.running, search.runSearch, search.query]);
  const changeOptions = useCallback((patch: Partial<ReaderSearchOptions>) => {
    cancelTimer(); setResultsOpen(false); search.setOptions(patch);
  }, [cancelTimer, search.setOptions]);
  const toggleResults = useCallback(() => { setOptionsOpen(false); setResultsOpen(value => !value); }, []);
  return {containerRef,inputRef,listRef,resultsOpen,optionsOpen,setOptionsOpen,toggleResults,hasResults,currentResults,
    change,keyDown,inputKeyDown,step,select,changeOptions,
    compositionStart: () => { composing.current = true; cancelTimer(); },
    compositionEnd: (query: string) => { composing.current = false; if (query.trim()) schedule(query); },
  };
}
