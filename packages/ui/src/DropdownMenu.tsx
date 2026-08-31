import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocalAtom } from "./lib/useLocalAtom";
import { cn } from "./lib/cn";
import { useHorizontalViewportCollision } from "./lib/useHorizontalViewportCollision";

type DropdownItem = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
};

/** Visual gap between the pointer and a fixed-positioned (context) menu. */
const POSITION_GAP = 6;

type DropdownMenuProps = {
  /** Omit to run fully controlled (e.g. a long-press-opened menu). */
  trigger?: ReactNode;
  /** Accessible name for an icon-only trigger. */
  triggerLabel?: string;
  items: DropdownItem[];
  align?: "left" | "right";
  /** Side of the trigger the menu opens toward. */
  side?: "top" | "bottom";
  className?: string;
  /** Controlled open state; leave undefined for internal (trigger-driven) state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Anchor the panel to fixed viewport coordinates (context menus). When set,
   * trigger/align/side are ignored, the panel is portaled to `document.body`
   * (transformed or `content-visibility` ancestors would otherwise become its
   * fixed-position containing block), and it is measured once after render to
   * flip above the anchor when it would overflow the viewport bottom and to
   * shift left when it would overflow the right edge. Fully controlled use:
   * pass `open` + `onOpenChange` alongside the coordinates.
   */
  position?: { x: number; y: number };
};

export function DropdownMenu({
  trigger,
  triggerLabel,
  items,
  align = "left",
  side = "bottom",
  className,
  open: controlledOpen,
  onOpenChange,
  position,
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useLocalAtom(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const [activeIndex, setActiveIndex] = useLocalAtom(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const menuId = `${id}-menu`;
  // In fixed position mode the trigger-relative collision hook is disabled
  // (open is suppressed); only its ref is reused for measuring.
  const { floatingRef, positionStyle } = useHorizontalViewportCollision(
    position ? false : open,
    align,
  );

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [isControlled],
  );

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }, [setOpen]);

  // Context-menu mode: one-shot viewport correction for the fixed panel. The
  // pop-in animation scales the panel on entrance, so re-measure once it
  // settles; a ResizeObserver covers item-count-driven size changes while
  // open, and translateY(-100%) keeps the flip anchored to the pointer.
  const positionX = position?.x;
  const positionY = position?.y;
  const [positionShift, setPositionShift] = useState<{
    flipY: boolean;
    shiftX: number;
  } | null>(null);

  const measurePosition = useCallback(() => {
    const floating = floatingRef.current;
    if (!floating) return;
    const rect = floating.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportRight =
      viewportLeft + (viewport?.width ?? document.documentElement.clientWidth);
    const viewportBottom =
      viewportTop + (viewport?.height ?? document.documentElement.clientHeight);
    setPositionShift((current) => {
      const next = {
        flipY: rect.bottom + POSITION_GAP > viewportBottom,
        shiftX:
          rect.right + POSITION_GAP > viewportRight
            ? viewportRight - POSITION_GAP - rect.right
            : 0,
      };
      // Keep the reference stable when nothing changed so repeated measures
      // (resize observer, animationend) do not churn renders.
      return current &&
        current.flipY === next.flipY &&
        Math.abs(current.shiftX - next.shiftX) < 0.5
        ? current
        : next;
    });
  }, [floatingRef]);

  useLayoutEffect(() => {
    if (!open || positionX === undefined || positionY === undefined) return;
    measurePosition();
    const floating = floatingRef.current;
    if (!floating) return;
    floating.addEventListener("animationend", measurePosition);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measurePosition);
    resizeObserver?.observe(floating);
    window.addEventListener("resize", measurePosition);
    return () => {
      floating.removeEventListener("animationend", measurePosition);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measurePosition);
    };
  }, [open, positionX, positionY, measurePosition, floatingRef]);

  // Context menus start with focus so arrow-key navigation and Escape work
  // immediately, matching native context-menu behavior.
  useEffect(() => {
    if (open && positionX !== undefined && positionY !== undefined) {
      floatingRef.current?.focus({ preventScroll: true });
    }
  }, [open, positionX, positionY, floatingRef]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      // The fixed-position panel is portaled to the body, so it is outside the
      // container — count it as inside the menu.
      if (floatingRef.current?.contains(target)) return;
      // Body-portaled floating UI opened from a menu item is logically inside.
      if (target instanceof Element && target.closest("[data-ui-portal]")) return;
      setOpen(false);
      setActiveIndex(-1);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen, floatingRef]);

  // Focus active item
  useEffect(() => {
    if (open && activeIndex >= 0) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  function findNextEnabled(from: number, direction: 1 | -1): number {
    let idx = from;
    for (let i = 0; i < items.length; i++) {
      idx = (idx + direction + items.length) % items.length;
      if (!items[idx].disabled) return idx;
    }
    return from;
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(findNextEnabled(-1, 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(findNextEnabled(items.length, -1));
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => findNextEnabled(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => findNextEnabled(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(findNextEnabled(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(findNextEnabled(items.length, -1));
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
    }
  }

  const panelStyle: CSSProperties = position
    ? {
        left: position.x + (positionShift?.shiftX ?? 0),
        top: position.y,
        transform: positionShift?.flipY
          ? `translateY(calc(-100% - ${POSITION_GAP}px))`
          : undefined,
      }
    : positionStyle;

  const panel = open && (
    <div
      ref={floatingRef}
      id={menuId}
      role="menu"
      tabIndex={position ? -1 : undefined}
      style={panelStyle}
      onKeyDown={handleMenuKeyDown}
      className={cn(
        "ra-motion-overlay-pop z-50 min-w-[184px] max-w-[calc(100vw-1rem)] rounded-md border border-border bg-[var(--ra-main-surface-color)] p-1",
        position
          ? "fixed outline-none"
          : "absolute",
        !position && (side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"),
        !position && (align === "left" ? "left-0" : "right-0"),
        !position &&
          (side === "top"
            ? align === "left"
              ? "origin-bottom-left"
              : "origin-bottom-right"
            : align === "left"
              ? "origin-top-left"
              : "origin-top-right"),
      )}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          ref={(el) => { itemRefs.current[i] = el; }}
          role="menuitem"
          tabIndex={i === activeIndex ? 0 : -1}
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            close();
          }}
          onMouseEnter={() => setActiveIndex(i)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
            item.destructive
              ? cn(
                  "text-red-700 dark:text-red-400",
                  i === activeIndex
                    ? "bg-red-50 dark:bg-red-500/15"
                    : "hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-500/15 dark:focus:bg-red-500/15",
                )
              : cn("text-fg-muted", i === activeIndex ? "bg-fill text-fg" : "hover:bg-fill focus:bg-fill"),
            item.disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {item.icon && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-subtle">
              {item.icon}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {trigger != null && (
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={triggerLabel}
          title={triggerLabel}
          aria-controls={open ? menuId : undefined}
          onClick={() => {
            if (open) {
              close();
            } else {
              setOpen(true);
              setActiveIndex(findNextEnabled(-1, 1));
            }
          }}
          onKeyDown={handleTriggerKeyDown}
          className="inline-flex"
        >
          {trigger}
        </button>
      )}
      {position ? createPortal(panel, document.body) : panel}
    </div>
  );
}
