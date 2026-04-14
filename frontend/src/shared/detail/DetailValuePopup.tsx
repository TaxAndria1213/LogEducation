import React from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import TableActionButton from "../../components/actions/TableActionButton";

type Props = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  badge?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function DetailValuePopup({
  isOpen,
  title,
  subtitle,
  badge,
  onClose,
  children,
  footer,
}: Props) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const subtitleId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialogElement = dialogRef.current;
    const focusDialog = () => {
      dialogElement?.focus();
    };

    const frameId = window.requestAnimationFrame(focusDialog);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      } else if (event.shiftKey && (activeElement === firstElement || activeElement === dialogRef.current)) {
        event.preventDefault();
        lastElement.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className="flex max-h-[min(90vh,58rem)] w-[min(64rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_28px_80px_-32px_rgba(15,23,42,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-3.5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {badge ? (
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  {badge}
                </span>
              ) : null}
              <h3
                id={titleId}
                className={`${badge ? "mt-2" : ""} text-xl font-semibold tracking-tight`}
              >
                {title}
              </h3>
              {subtitle ? (
                <p
                  id={subtitleId}
                  className="mt-1 max-w-3xl text-xs leading-5 text-white/72"
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
            <TableActionButton
              variant="secondary"
              className="border-white/15 bg-white/10 px-3 py-2 text-white hover:bg-white/15"
              onClick={onClose}
            >
              <span className="inline-flex items-center gap-1.5">
                <FiX className="text-[14px]" />
                <span>Fermer</span>
              </span>
            </TableActionButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
