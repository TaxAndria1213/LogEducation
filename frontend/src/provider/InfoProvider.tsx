import React, { useCallback, useRef, useState } from "react";
import { InfoContext, type InfoType } from "../hooks/useInfo";


type Toast = {
  id: number;
  message: string;
  type: InfoType;
};



const stylesByType: Record<InfoType, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  warning: "bg-amber-500 text-black",
  info: "bg-blue-600 text-white",
};

export function InfoProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const info = useCallback((message: string, type: InfoType = "info") => {
    idRef.current += 1;

    // reset timer si on réaffiche une alerte
    if (timerRef.current) window.clearTimeout(timerRef.current);

    setToast({ id: idRef.current, message, type });

    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, 3000);
  }, []);

  return (
    <InfoContext.Provider value={{ info }}>
      {children}

      {/* Toast flottant */}
      <div className="pointer-events-none fixed top-4 left-1/2 z-50 -translate-x-1/2">
        {toast ? (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ring-black/10
            ${stylesByType[toast.type]}`}
            role="status"
            aria-live="polite"
          >
            <Icon type={toast.type} />
            <span className="max-w-[80vw] break-words">{toast.message}</span>
          </div>
        ) : null}
      </div>
    </InfoContext.Provider>
  );
}



function Icon({ type }: { type: InfoType }) {
  // petites icônes inline (sans lib)
  const common = "h-4 w-4 opacity-90";
  if (type === "success")
    return (
      <svg className={common} viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 011.415-1.415l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  if (type === "error")
    return (
      <svg className={common} viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.707-10.707a1 1 0 00-1.414-1.414L10 7.172 8.707 5.879A1 1 0 107.293 7.293L8.586 8.586 7.293 9.879a1 1 0 101.414 1.414L10 10 11.293 11.293a1 1 0 001.414-1.414L11.414 8.586l1.293-1.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  if (type === "warning")
    return (
      <svg className={common} viewBox="0 0 20 20" fill="currentColor">
        <path d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l6.518 11.59C19.02 16.03 18.09 17.75 16.518 17.75H3.482C1.91 17.75.98 16.03 1.739 14.689l6.518-11.59z" />
        <path
          fillRule="evenodd"
          d="M10 6.75a1 1 0 01 1 1v3.5a1 1 0 11-2 0v-3.5a1 1 0 011-1zm0 8a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z"
          clipRule="evenodd"
        />
      </svg>
    );
  return (
    <svg className={common} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 112 0v6a1 1 0 11-2 0V9zm1-4a1.25 1.25 0 100 2.5A1.25 1.25 0 0010 5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
