import { useEffect, useState, type ReactNode } from "react";

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
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timeout = window.setTimeout(() => setShouldRender(false), 180);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!shouldRender) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className="absolute inset-0 bg-transparent"
      />

      <div
        className={`absolute right-4 top-[7.25rem] w-[min(22rem,calc(100vw-2rem))] origin-top-right transition-all duration-200 ease-out sm:right-6 ${
          isVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-2 scale-95 opacity-0"
        }`}
        style={{ left: "auto" }}
      >
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white/98 shadow-[0_24px_65px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-950/5 backdrop-blur">
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
    </div>
  );
}

export default PageSidebarPopup;
