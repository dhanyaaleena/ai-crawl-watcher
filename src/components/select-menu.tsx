"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** Shown before the label, e.g. a platform colour dot or a site avatar. */
  leading?: ReactNode;
}

/**
 * A custom dropdown in Searchable's style: white rounded panel, hover row,
 * check mark on the right. Replaces native <select>, whose menu is drawn by
 * the OS and can't be styled.
 *
 * Accessible as a listbox: the trigger is a labelled button (aria-haspopup,
 * aria-expanded); options are role="option" with aria-selected; the active
 * option is announced via aria-activedescendant. Keys: ↑ ↓ Home End to move,
 * Enter to pick, Escape or Tab to close, letters to jump (or type in the
 * search box when `search` is on).
 */
export function SelectMenu({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose…",
  search,
  sectionLabel,
  footer,
  triggerClassName = "",
  fullWidth = false,
}: {
  /** Accessible name for the control, e.g. "Platform". */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show a search box; the string is its placeholder. */
  search?: string;
  /** Small heading above the options, e.g. "Your sites". */
  sectionLabel?: string;
  /** Extra row under the options, e.g. an "Add another site" link. Receives a close function. */
  footer?: (close: () => void) => ReactNode;
  triggerClassName?: string;
  fullWidth?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === value);

  function openMenu() {
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function close(refocus = true) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }
  function pick(o: SelectOption) {
    close();
    if (o.value !== value) onChange(o.value);
  }

  // Focus the search box (or the list) when opening; close on outside click.
  useEffect(() => {
    if (!open) return;
    (searchBox.current ?? list.current)?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the active option in view while moving with the keyboard.
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onListKey(e: React.KeyboardEvent) {
    const last = shown.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(last, a + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Enter":
        e.preventDefault();
        if (shown[active]) pick(shown[active]);
        return;
      case "Escape":
        e.preventDefault();
        close();
        return;
      case "Tab":
        close(false);
        return;
    }
    if (!search && e.key.length === 1 && /\S/.test(e.key)) {
      // Type-to-jump, like a native select.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = shown.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <div ref={root} className={`relative ${fullWidth ? "w-full" : "inline-block"}`}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
        className={`flex items-center gap-2 rounded-md border bg-surface text-left text-sm text-ink transition-shadow ${
          open ? "border-brand/60 shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_18%,transparent)]" : "border-line-strong hover:bg-surface-2"
        } ${fullWidth ? "w-full" : ""} ${triggerClassName}`}
      >
        {selected?.leading}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          // Full-width menus (the sidebar site picker) match the trigger exactly: a wider panel would make
          // the scrolling sidebar scroll sideways. Inline menus may grow to fit their longest option.
          className={`absolute left-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgb(0_0_0/0.10),0_2px_6px_rgb(0_0_0/0.06)] ${
            fullWidth ? "w-full" : "w-max min-w-full max-w-[min(20rem,calc(100vw-2rem))]"
          }`}
        >
          {search && (
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              <input
                ref={searchBox}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                placeholder={search}
                aria-label={search}
                aria-controls={listId}
                aria-activedescendant={shown[active] ? optionId(active) : undefined}
                // The open menu already shows focus (orange ring on the trigger); an inline style beats the global :focus-visible rule.
                style={{ outline: "none" }}
                className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-ink-3"
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto p-1">
            {sectionLabel && <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-ink-3">{sectionLabel}</p>}
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={search ? -1 : 0}
              aria-activedescendant={!search && shown[active] ? optionId(active) : undefined}
              onKeyDown={search ? undefined : onListKey}
              className="outline-none"
            >
              {shown.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onPointerMove={() => setActive(i)}
                    onClick={() => pick(o)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${
                      i === active ? "bg-surface-2" : ""
                    } ${isSelected ? "font-medium text-ink" : "text-ink-2"}`}
                  >
                    {o.leading}
                    <span className="min-w-0 flex-1 truncate" title={o.label}>
                      {o.label}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />}
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-2.5 py-2 text-sm text-ink-3">No matches</li>}
            </ul>
          </div>
          {footer && <div className="border-t border-line p-1">{footer(() => setOpen(false))}</div>}
        </div>
      )}
    </div>
  );
}
