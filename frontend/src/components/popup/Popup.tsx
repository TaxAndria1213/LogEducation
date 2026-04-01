import type { JSX } from "react";
import { useEffect, useRef } from "react";

type PopupPosition = "left" | "center" | "right";

type PopupProps = {
  position?: PopupPosition;
  isOpen: boolean;
  onClose: () => void;
  children?: JSX.Element;
};

function Popup({ position = "center", isOpen, onClose, children }: PopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const el = popupRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionClass =
    position === "left"
      ? "left-0"
      : position === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div
      ref={popupRef}
      className={`absolute top-[calc(100%+14px)] z-50 ${positionClass} min-w-[260px] overflow-hidden rounded-[24px] border border-white/80 bg-white/95 p-3 shadow-[0_24px_50px_rgba(15,23,42,0.16)] backdrop-blur-2xl`}
    >
      {children}
    </div>
  );
}

export default Popup;
