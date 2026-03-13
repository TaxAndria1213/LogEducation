import type { JSX } from "react"
import { useEffect, useRef } from "react"

type PopupPosition = "left" | "center" | "right"

type PopupProps = {
  position?: PopupPosition
  isOpen: boolean
  onClose: () => void
  children?: JSX.Element
}

function Popup({position = "center", isOpen, onClose, children }: PopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      const el = popupRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        onClose()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const positionClass =
    position === "left"
      ? "left-0"
      : position === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2"

  return (
    <div
      ref={popupRef}
      className={`absolute top-14 z-50 ${positionClass} bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-[200px]`}
    >
      {children}
    </div>
  )
}

export default Popup