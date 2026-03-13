import { getComponentById } from "../../../../components/components.build";
import Popup from "../../../../components/popup/Popup";

function AdminPopup({ isOpen, popupType, onClose }: { isOpen: boolean, popupType: "left" | "center" | "right" | null, onClose: () => void }) {
  const AdminSelectEtablissementButton = getComponentById(
    "ADM.PROFILE.SELECT.ETABLISSEMENT",
  );
  return (
    <div>
      <Popup
        components={[<AdminSelectEtablissementButton />]}
        isOpen={isOpen}
        position={popupType || "center"}
        onClose={onClose}
      />
    </div>
  );
}

export default AdminPopup;
