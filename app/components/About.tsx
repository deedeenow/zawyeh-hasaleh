'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Dictionary } from '@/lib/i18n';

interface AboutProps {
  dict: Dictionary;
  open: boolean;
  onClose: () => void;
}

/** Elements that can hold focus inside the dialog. */
const FOCUSABLE = 'a[href], button:not([disabled])';

export default function About({ dict, open, onClose }: AboutProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** Whatever had focus before opening, so it can be handed back on close. */
  const returnTo = useRef<HTMLElement | null>(null);

  const trapFocus = useCallback((event: KeyboardEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    const targets = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (targets.length === 0) return;

    const first = targets[0];
    const last = targets[targets.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        trapFocus(event);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // The page behind must not scroll while the dialog owns the screen.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus();
    };
  }, [open, onClose, trapFocus]);

  if (!open) return null;

  return (
    <div className="scrim" onClick={onClose}>
      {/* Stop clicks inside the panel from reaching the scrim's close handler. */}
      <div
        className="dialog"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <h2 className="eyebrow" id="about-title">
            {dict.aboutTitle}
          </h2>
          <button className="dialog-close" type="button" onClick={onClose} ref={closeRef}>
            {dict.aboutClose}
          </button>
        </header>

        <div className="dialog-body">
          {dict.aboutBody.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
