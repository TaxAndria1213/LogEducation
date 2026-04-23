import { createPortal } from "react-dom";
import Title1 from "../text/Title1";

function FlyPopup({
  isOpen,
  setIsOpen,
  title,
  headerActions,
  panelClassName,
  children,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  title?: string;
  headerActions?: React.ReactNode;
  panelClassName?: string;
  children?: React.ReactNode;
}) {
  if (!isOpen) return null;

  const hasCustomMaxWidth = panelClassName?.includes("max-w-") ?? false;

  const content = (
    <div
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <button
          type="button"
          className="absolute inset-0 h-full w-full cursor-default"
          aria-label="Fermer le popup"
          onClick={() => setIsOpen(false)}
        />

        <div className="relative z-10 w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-2rem)]">
          <div
            className={`mx-auto flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-[28px] bg-white shadow-xl sm:max-h-[calc(100vh-2rem)] ${
              hasCustomMaxWidth ? "" : "max-w-md"
            } ${panelClassName ?? ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1 break-words">
                {title ? <Title1 title={title} /> : <div />}
              </div>
              {headerActions ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {headerActions}
                </div>
              ) : null}
              <button
                type="button"
                className="shrink-0 text-2xl font-bold text-slate-500 transition hover:text-slate-900"
                onClick={() => setIsOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="min-w-0 overflow-x-hidden break-words">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}

export default FlyPopup;
