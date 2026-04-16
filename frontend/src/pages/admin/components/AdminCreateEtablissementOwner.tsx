import { useCallback, useState } from "react";
import FlyPopup from "../../../components/popup/FlyPopup";
import CreateAccount from "../../account/CreateAccount";
import { useEtablissementChoiceStore } from "../store/EtablissementChoiceStore";

type CreationResult = {
  etablissement?: {
    id?: string;
    nom?: string | null;
  } | null;
} | null;

export default function AdminCreateEtablissementOwner() {
  const [isOpen, setIsOpen] = useState(false);
  const getEtablissementList = useEtablissementChoiceStore(
    (state) => state.getEtablissementList,
  );
  const setEtablissementId = useEtablissementChoiceStore(
    (state) => state.setEtablissementId,
  );

  const handleSuccess = useCallback(
    (result: CreationResult) => {
      const etablissementId = result?.etablissement?.id ?? null;
      if (etablissementId) {
        setEtablissementId(etablissementId);
      }
      getEtablissementList();
      setIsOpen(false);
    },
    [getEtablissementList, setEtablissementId],
  );

  return (
    <>
      <section className="rounded-[20px] border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Creation admin
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Cree directement un etablissement avec son proprietaire principal
              et son role DIRECTION.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Nouvel etablissement
          </button>
        </div>
      </section>

      <FlyPopup
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        title="Nouvel etablissement"
        panelClassName="max-w-6xl p-0"
      >
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <CreateAccount mode="admin" onSuccess={handleSuccess} />
        </div>
      </FlyPopup>
    </>
  );
}
