import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
};

function PageSidebarPopup({
  open,
  onClose,
  children,
  title = "Actions",
}: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const nextAnchor = document.querySelector(
      "[data-erp-header-action-trigger='true']",
    ) as HTMLElement | null;
    setAnchor(nextAnchor);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!anchor) return;
      const target = event.target as Node | null;
      if (!target) return;

      const popupElement = anchor.querySelector("[data-erp-dropdown='true']");
      if (!popupElement) return;

      if (
        popupElement.contains(target) ||
        anchor.contains(target)
      ) {
        return;
      }

      onClose();
    };

    window.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [anchor, onClose, open]);

  const content = useMemo(() => {
    if (!open || !anchor) return null;

    return (
      <div
        data-erp-dropdown="true"
        className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right"
      >
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white/98 shadow-[0_24px_65px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-950/5 backdrop-blur">
          <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white/98" />
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {title}
            </p>
          </div>
          <div className="max-h-[min(28rem,calc(100vh-10rem))] overflow-y-auto p-2">
            {children}
          </div>
        </div>
      </div>
    );
  }, [anchor, children, open, title]);

  if (!anchor || !content) return null;

  return createPortal(content, anchor);
}

export default PageSidebarPopup;
