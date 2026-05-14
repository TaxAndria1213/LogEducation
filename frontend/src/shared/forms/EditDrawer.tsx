import { useEffect } from "react";
import { createPortal } from "react-dom";
import DynamicEditForm from "./DynamicEditForm";
import type { ModelConfig } from "../model-config/types";

type EditDrawerProps<T extends object> = {
  open: boolean;
  record: T | null;
  modelConfig: ModelConfig<T>;
  onClose: () => void;
  onSuccess?: (updated: T) => void;
};

export default function EditDrawer<T extends object>({
  open,
  record,
  modelConfig,
  onClose,
  onSuccess,
}: EditDrawerProps<T>) {
  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!open || !record || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex">
      <button
        type="button"
        aria-label="Fermer l'edition"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[0_0_40px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Edition
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              Modifier {modelConfig.label}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          >
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <DynamicEditForm
            modelConfig={modelConfig}
            record={record}
            onCancel={onClose}
            onSuccess={(updated) => {
              onSuccess?.(updated);
              onClose();
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
