import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft } from "../../types";
import BlockActionSelector from "../shared/BlockActionSelector";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
};

export default function StepServicesAnnexes({ draft, setDraft }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Transport et cantine sont bien dans le parcours, mais restent volontairement differés
        tant que les regles d'acces et les catalogues financiers ne sont pas stabilises.
      </p>
      <BlockActionSelector
        value={draft.services_mode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            services_mode: value,
          }))
        }
      />
    </div>
  );
}
