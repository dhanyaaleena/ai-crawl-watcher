"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Small ⓘ that reveals extra detail. Opens on hover (pointer devices), on
 * keyboard focus, and on tap (touch, where hover doesn't exist). Escape or a
 * tap outside closes it. It nudges itself sideways to stay on screen.
 */
export function InfoTip({ label, children, align = "left" }: { label: string; children: React.ReactNode; align?: "left" | "right" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  // Escape hides it even while the button keeps keyboard focus or the pointer.
  const [dismissed, setDismissed] = useState(false);

  // Closed panels aren't rendered (display: none), so they never widen the page.
  // Once one shows, measure it on the next frame and keep it 12px inside the
  // viewport.
  const fit = () => {
    setDismissed(false);
    requestAnimationFrame(() => {
      const el = tipRef.current;
      const anchor = ref.current;
      if (!el || !anchor || !el.offsetWidth) return;
      // Where the panel sits before any shift (computed from the anchor, so
      // repeated calls give the same answer).
      const a = anchor.getBoundingClientRect();
      const w = el.offsetWidth;
      const base = align === "right" ? a.right - w : a.left;
      const screen = document.documentElement.clientWidth;
      setShift(Math.round(Math.min(Math.max(base, 12), screen - 12 - w) - base));
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setDismissed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <span ref={ref} className="group/tip relative inline-flex" data-open={open || undefined}
      data-dismissed={dismissed || undefined}
      onPointerEnter={fit}
      onFocus={fit}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => {
          fit();
          setOpen((o) => !o);
        }}
        className="-m-1 inline-flex rounded p-1 text-ink-3 hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        ref={tipRef}
        role="tooltip"
        id={id}
        style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        className={`hidden absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-lg border border-line-strong bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink-2 shadow-lg group-has-[:focus-visible]/tip:block group-hover/tip:block group-data-[open]/tip:block group-data-[dismissed]/tip:hidden! ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
