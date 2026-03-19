import { useEffect, useState, type ReactNode } from "react";
import { FiX } from "react-icons/fi";

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
  title = "Actions de la page",
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
    const timeout = window.setTimeout(() => setShouldRender(false), 240);
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
    <div
      className="fixed inset-y-0 right-0 z-50"
      style={{ left: "var(--app-sidebar-offset, 0px)" }}
    >
      <div className="relative flex h-full w-full items-start justify-end p-4 sm:p-6">
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className={`absolute inset-0 bg-slate-950/30 backdrop-blur-[2px] transition-opacity duration-200 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_90px_-36px_rgba(15,23,42,0.6)] transition-all duration-300 ease-out sm:max-h-[calc(100vh-3rem)] ${
            isVisible
              ? "translate-x-0 scale-100 opacity-100"
              : "translate-x-8 scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Menu
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <FiX />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default PageSidebarPopup;
