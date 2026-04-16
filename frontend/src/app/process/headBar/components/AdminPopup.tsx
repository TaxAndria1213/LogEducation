import Popup from "../../../../components/popup/Popup";
import AdminCreateEtablissementOwner from "../../../../pages/admin/components/AdminCreateEtablissementOwner";
import EtablissementChoice from "../../../../pages/admin/components/EtablissementChoice";
import PendingOwnerApprovals from "../../../../pages/admin/components/PendingOwnerApprovals";

function AdminPopup({ isOpen, popupType, onClose }: { isOpen: boolean, popupType: "left" | "center" | "right" | null, onClose: () => void }) {
  return (
    <Popup isOpen={isOpen} position={popupType || "center"} onClose={onClose}>
      <div className="w-[min(28rem,calc(100vw-2rem))] space-y-4">
        <section className="rounded-[20px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Contexte administrateur
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Choisis un etablissement actif, puis traite les nouvelles demandes proprietaires.
          </p>
          <div className="mt-3">
            <EtablissementChoice />
          </div>
        </section>
        <AdminCreateEtablissementOwner />
        <PendingOwnerApprovals />
      </div>
    </Popup>
  );
}

export default AdminPopup;
