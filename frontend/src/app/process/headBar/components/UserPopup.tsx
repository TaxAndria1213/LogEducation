import type { JSX } from "react";
import Popup from "../../../../components/popup/Popup";

function UserPopup({
  isOpen,
  popupType,
  onClose,
  component,
}: {
  isOpen: boolean;
  popupType: "left" | "center" | "right" | null;
  onClose: () => void;
  component: JSX.Element;
}) {
  return (
    <div>
      <Popup isOpen={isOpen} position={popupType || "center"} onClose={onClose}>
        <>
          {component}
        </>
      </Popup>
    </div>
  );
}

export default UserPopup;
